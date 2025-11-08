import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { transactions, accounts, budgetCategories, merchants, usageAnalytics, ruleExecutionLog } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';
import { findMatchingRule } from '@/lib/rules/rule-matcher';
import { TransactionData } from '@/lib/rules/condition-evaluator';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      accountId,
      categoryId,
      date,
      amount,
      description,
      notes,
      type = 'expense',
      isPending = false,
    } = body;

    // Validate required fields
    if (!accountId || !date || !amount || !description) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate account belongs to user
    const account = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.id, accountId),
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

    // Validate category if provided
    if (categoryId) {
      const category = await db
        .select()
        .from(budgetCategories)
        .where(
          and(
            eq(budgetCategories.id, categoryId),
            eq(budgetCategories.userId, userId)
          )
        )
        .limit(1);

      if (category.length === 0) {
        return Response.json(
          { error: 'Category not found' },
          { status: 404 }
        );
      }
    }

    // Apply categorization rules if no category provided
    let appliedCategoryId = categoryId;
    let appliedRuleId: string | null = null;

    if (!appliedCategoryId && type !== 'transfer_in' && type !== 'transfer_out') {
      try {
        const transactionData: TransactionData = {
          description,
          amount: parseFloat(amount),
          accountName: account[0].name,
          date,
          notes: notes || undefined,
        };

        const ruleMatch = await findMatchingRule(userId, transactionData);

        if (ruleMatch.matched && ruleMatch.rule) {
          appliedCategoryId = ruleMatch.rule.categoryId;
          appliedRuleId = ruleMatch.rule.ruleId;
        }
      } catch (error) {
        // Log error but don't fail transaction creation
        console.error('Error applying categorization rules:', error);
      }
    }

    // Create transaction
    const transactionId = nanoid();
    const decimalAmount = new Decimal(amount);

    const result = await db.insert(transactions).values({
      id: transactionId,
      userId,
      accountId,
      categoryId: appliedCategoryId || null,
      date,
      amount: decimalAmount.toNumber(),
      description,
      notes: notes || null,
      type,
      isPending,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Update account balance and usage
    const newBalance = new Decimal(account[0].currentBalance || 0);
    const updatedBalance =
      type === 'expense' || type === 'transfer_out'
        ? newBalance.minus(decimalAmount)
        : newBalance.plus(decimalAmount);

    await db
      .update(accounts)
      .set({
        currentBalance: updatedBalance.toNumber(),
        lastUsedAt: new Date().toISOString(),
        usageCount: (account[0].usageCount || 0) + 1,
      })
      .where(eq(accounts.id, accountId));

    // Update category usage if provided
    if (categoryId) {
      const category = await db
        .select()
        .from(budgetCategories)
        .where(eq(budgetCategories.id, categoryId))
        .limit(1);

      await db
        .update(budgetCategories)
        .set({
          lastUsedAt: new Date().toISOString(),
          usageCount: (category.length > 0 ? category[0].usageCount : 0) + 1,
        })
        .where(eq(budgetCategories.id, categoryId));

      // Track in usage analytics
      const analyticsId = nanoid();
      const existingAnalytics = await db
        .select()
        .from(usageAnalytics)
        .where(
          and(
            eq(usageAnalytics.userId, userId),
            eq(usageAnalytics.itemType, 'category'),
            eq(usageAnalytics.itemId, categoryId)
          )
        )
        .limit(1);

      if (existingAnalytics.length > 0) {
        await db
          .update(usageAnalytics)
          .set({
            usageCount: existingAnalytics[0].usageCount + 1,
            lastUsedAt: new Date().toISOString(),
          })
          .where(
            and(
              eq(usageAnalytics.userId, userId),
              eq(usageAnalytics.itemType, 'category'),
              eq(usageAnalytics.itemId, categoryId)
            )
          );
      } else {
        await db.insert(usageAnalytics).values({
          id: analyticsId,
          userId,
          itemType: 'category',
          itemId: categoryId,
          usageCount: 1,
          lastUsedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Create or update merchant and track usage
    const normalizedDescription = description.toLowerCase().trim();
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

    if (existingMerchant.length > 0) {
      const currentSpent = new Decimal(existingMerchant[0].totalSpent || 0);
      const newSpent = currentSpent.plus(decimalAmount);
      const avgTransaction = newSpent.dividedBy(
        existingMerchant[0].usageCount + 1
      );

      await db
        .update(merchants)
        .set({
          usageCount: existingMerchant[0].usageCount + 1,
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
        name: description,
        normalizedName: normalizedDescription,
        categoryId: categoryId || null,
        usageCount: 1,
        lastUsedAt: new Date().toISOString(),
        totalSpent: decimalAmount.toNumber(),
        averageTransaction: decimalAmount.toNumber(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Track merchant in usage analytics
    const merchantAnalyticsId = nanoid();
    const existingMerchantAnalytics = await db
      .select()
      .from(usageAnalytics)
      .where(
        and(
          eq(usageAnalytics.userId, userId),
          eq(usageAnalytics.itemType, 'merchant'),
          eq(usageAnalytics.itemId, existingMerchant.length > 0 ? existingMerchant[0].id : normalizedDescription)
        )
      )
      .limit(1);

    if (existingMerchantAnalytics.length > 0) {
      await db
        .update(usageAnalytics)
        .set({
          usageCount: existingMerchantAnalytics[0].usageCount + 1,
          lastUsedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(usageAnalytics.userId, userId),
            eq(usageAnalytics.itemType, 'merchant'),
            eq(usageAnalytics.itemId, existingMerchant.length > 0 ? existingMerchant[0].id : normalizedDescription)
          )
        );
    } else {
      await db.insert(usageAnalytics).values({
        id: merchantAnalyticsId,
        userId,
        itemType: 'merchant',
        itemId: existingMerchant.length > 0 ? existingMerchant[0].id : normalizedDescription,
        usageCount: 1,
        lastUsedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
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
        // Log error but don't fail transaction creation
        console.error('Error logging rule execution:', error);
      }
    }

    return Response.json(
      {
        id: transactionId,
        message: 'Transaction created successfully',
        appliedCategoryId: appliedCategoryId ? appliedCategoryId : undefined,
        appliedRuleId: appliedRuleId ? appliedRuleId : undefined,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Transaction creation error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const userTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(transactions.date)
      .limit(limit)
      .offset(offset);

    return Response.json(userTransactions);
  } catch (error) {
    console.error('Transaction fetch error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
