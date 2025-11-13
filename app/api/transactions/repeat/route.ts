import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import {
  transactionTemplates,
  transactions,
  accounts,
  budgetCategories,
  merchants,
  usageAnalytics,
  ruleExecutionLog,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';
import { findMatchingRule } from '@/lib/rules/rule-matcher';
import { TransactionData } from '@/lib/rules/condition-evaluator';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const { templateId, date, amount, description } = body;

    if (!templateId) {
      return Response.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    // Get template
    const template = await db
      .select()
      .from(transactionTemplates)
      .where(
        and(
          eq(transactionTemplates.id, templateId),
          eq(transactionTemplates.userId, userId)
        )
      )
      .limit(1);

    if (template.length === 0) {
      return Response.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    const tmpl = template[0];

    // Validate account still exists
    const account = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.id, tmpl.accountId),
          eq(accounts.userId, userId)
        )
      )
      .limit(1);

    if (account.length === 0) {
      return Response.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Use provided values or fall back to template values
    const transactionDate = date || new Date().toISOString().split('T')[0];
    const transactionAmount = amount !== undefined ? amount : tmpl.amount;
    const transactionDescription = description || tmpl.description || tmpl.name;
    const categoryId = tmpl.categoryId;

    // Create transaction
    const transactionId = nanoid();
    const decimalAmount = new Decimal(transactionAmount);

    // Apply categorization rules if no category in template
    let appliedCategoryId = categoryId;
    let appliedRuleId: string | null = null;

    if (
      !appliedCategoryId &&
      tmpl.type !== 'transfer_in' &&
      tmpl.type !== 'transfer_out'
    ) {
      try {
        const transactionData: TransactionData = {
          description: transactionDescription,
          amount: parseFloat(transactionAmount.toString()),
          accountName: account[0].name,
          date: transactionDate,
          notes: tmpl.notes || undefined,
        };

        const ruleMatch = await findMatchingRule(userId, transactionData);

        if (ruleMatch.matched && ruleMatch.rule) {
          // Extract categoryId from actions (find first set_category action)
          const setCategoryAction = ruleMatch.rule.actions.find(a => a.type === 'set_category');
          if (setCategoryAction && setCategoryAction.value) {
            appliedCategoryId = setCategoryAction.value;
          }
          appliedRuleId = ruleMatch.rule.ruleId;
        }
      } catch (error) {
        console.error('Error applying categorization rules:', error);
      }
    }

    // Insert transaction
    await db.insert(transactions).values({
      id: transactionId,
      userId,
      accountId: tmpl.accountId,
      categoryId: appliedCategoryId || null,
      date: transactionDate,
      amount: decimalAmount.toNumber(),
      description: transactionDescription,
      notes: tmpl.notes || null,
      type: tmpl.type,
      isPending: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Update account balance and usage
    const newBalance = new Decimal(account[0].currentBalance || 0);
    const updatedBalance =
      tmpl.type === 'expense' || tmpl.type === 'transfer_out'
        ? newBalance.minus(decimalAmount)
        : newBalance.plus(decimalAmount);

    await db
      .update(accounts)
      .set({
        currentBalance: updatedBalance.toNumber(),
        lastUsedAt: new Date().toISOString(),
        usageCount: (account[0].usageCount || 0) + 1,
      })
      .where(eq(accounts.id, tmpl.accountId));

    // Update template usage
    await db
      .update(transactionTemplates)
      .set({
        usageCount: (tmpl.usageCount || 0) + 1,
        lastUsedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(transactionTemplates.id, templateId));

    // Update category usage if provided
    if (appliedCategoryId) {
      const category = await db
        .select()
        .from(budgetCategories)
        .where(eq(budgetCategories.id, appliedCategoryId))
        .limit(1);

      if (category.length > 0) {
        await db
          .update(budgetCategories)
          .set({
            lastUsedAt: new Date().toISOString(),
            usageCount: (category[0].usageCount || 0) + 1,
          })
          .where(eq(budgetCategories.id, appliedCategoryId));

        // Track in usage analytics
        const analyticsId = nanoid();
        const existingAnalytics = await db
          .select()
          .from(usageAnalytics)
          .where(
            and(
              eq(usageAnalytics.userId, userId),
              eq(usageAnalytics.itemType, 'category'),
              eq(usageAnalytics.itemId, appliedCategoryId)
            )
          )
          .limit(1);

        if (existingAnalytics.length > 0 && existingAnalytics[0]) {
          await db
            .update(usageAnalytics)
            .set({
              usageCount: (existingAnalytics[0].usageCount || 0) + 1,
              lastUsedAt: new Date().toISOString(),
            })
            .where(
              and(
                eq(usageAnalytics.userId, userId),
                eq(usageAnalytics.itemType, 'category'),
                eq(usageAnalytics.itemId, appliedCategoryId)
              )
            );
        } else {
          await db.insert(usageAnalytics).values({
            id: analyticsId,
            userId,
            itemType: 'category',
            itemId: appliedCategoryId,
            usageCount: 1,
            lastUsedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    // Create or update merchant and track usage
    const normalizedDescription = transactionDescription.toLowerCase().trim();
    const existingMerchant = await db
      .select()
      .from(merchants)
      .where(
        and(
          eq(merchants.userId, userId),
          eq(merchants.normalizedName, normalizedDescription)
        )
      )
      .limit(1);

    if (existingMerchant.length > 0 && existingMerchant[0]) {
      const currentSpent = new Decimal(existingMerchant[0].totalSpent || 0);
      const newSpent = currentSpent.plus(decimalAmount);
      const usageCount = (existingMerchant[0].usageCount || 0);
      const avgTransaction = newSpent.dividedBy(usageCount + 1);

      await db
        .update(merchants)
        .set({
          usageCount: usageCount + 1,
          lastUsedAt: new Date().toISOString(),
          totalSpent: newSpent.toNumber(),
          averageTransaction: avgTransaction.toNumber(),
        })
        .where(
          and(
            eq(merchants.userId, userId),
            eq(merchants.normalizedName, normalizedDescription)
          )
        );
    } else {
      const merchantId = nanoid();
      await db.insert(merchants).values({
        id: merchantId,
        userId,
        name: transactionDescription,
        normalizedName: normalizedDescription,
        categoryId: appliedCategoryId || null,
        usageCount: 1,
        lastUsedAt: new Date().toISOString(),
        totalSpent: decimalAmount.toNumber(),
        averageTransaction: decimalAmount.toNumber(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Log rule execution if a rule was applied
    if (appliedRuleId && appliedCategoryId) {
      try {
        await db.insert(ruleExecutionLog).values({
          id: nanoid(),
          userId,
          ruleId: appliedRuleId,
          transactionId,
          appliedCategoryId,
          matched: true,
          executedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error logging rule execution:', error);
      }
    }

    return Response.json(
      {
        id: transactionId,
        message: 'Transaction repeated successfully',
        appliedCategoryId,
        appliedRuleId,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Transaction repeat error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
