import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import {
  transactionTemplates,
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
import { executeRuleActions } from '@/lib/rules/actions-executor';
import type { TransactionMutations } from '@/lib/rules/types';
import { handleTransferConversion } from '@/lib/rules/transfer-action-handler';
import { handleSplitCreation } from '@/lib/rules/split-action-handler';
import { handleAccountChange } from '@/lib/rules/account-action-handler';
import { getTodayLocalDateString } from '@/lib/utils/local-date';
import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import {
  amountToCents,
  getAccountBalanceCents,
  insertTransactionMovement,
  updateScopedAccountBalance,
} from '@/lib/transactions/money-movement-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const { templateId, date, amount, description } = body;

    // Get and validate household
    const householdId = getHouseholdIdFromRequest(request, body);
    await requireHouseholdAuth(userId, householdId);

    // TypeScript: householdId is guaranteed to be non-null after requireHouseholdAuth
    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

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

    // Validate account still exists AND belongs to household
    const account = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.id, tmpl.accountId),
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId)
        )
      )
      .limit(1);

    if (account.length === 0) {
      return Response.json(
        { error: 'Account not found in household' },
        { status: 404 }
      );
    }

    // Use provided values or fall back to template values
    const transactionDate = date || getTodayLocalDateString();
    const transactionAmount = amount !== undefined ? amount : tmpl.amount;
    const transactionDescription = description || tmpl.description || tmpl.name;
    const categoryId = tmpl.categoryId;

    // Create transaction
    const transactionId = nanoid();
    const decimalAmount = new Decimal(transactionAmount);
    const amountCents = amountToCents(decimalAmount);

    // Apply categorization rules if no category in template
    let appliedCategoryId = categoryId;
    let appliedRuleId: string | null = null;
    let appliedActions: unknown[] = [];
    let finalDescription = transactionDescription;
    let finalMerchantId: string | null = null;
    let postCreationMutations: TransactionMutations | null = null;
    let finalIsTaxDeductible = false;
    let finalIsSalesTaxable = false;

    if (
      !appliedCategoryId &&
      tmpl.type !== 'transfer_in' &&
      tmpl.type !== 'transfer_out'
    ) {
      try {
        const transactionData: TransactionData = {
          description: finalDescription,
          amount: parseFloat(transactionAmount.toString()),
          accountName: account[0].name,
          date: transactionDate,
          notes: tmpl.notes || undefined,
        };

        const ruleMatch = await findMatchingRule(userId, householdId, transactionData);

        if (ruleMatch.matched && ruleMatch.rule) {
          appliedRuleId = ruleMatch.rule.ruleId;

          const executionResult = await executeRuleActions(
            userId,
            ruleMatch.rule.actions,
            {
              categoryId: appliedCategoryId || null,
              description: finalDescription,
              merchantId: finalMerchantId,
              accountId: tmpl.accountId,
              amount: parseFloat(transactionAmount.toString()),
              date: transactionDate,
              type: tmpl.type,
              isTaxDeductible: false,
            },
            null,
            null,
            householdId
          );

          // Apply mutations
          if (executionResult.mutations.categoryId !== undefined) {
            appliedCategoryId = executionResult.mutations.categoryId;
          }
          if (executionResult.mutations.description) {
            finalDescription = executionResult.mutations.description;
          }
          if (executionResult.mutations.merchantId !== undefined) {
            finalMerchantId = executionResult.mutations.merchantId;
          }
          if (executionResult.mutations.isTaxDeductible !== undefined) {
            finalIsTaxDeductible = executionResult.mutations.isTaxDeductible;
          }
          if (executionResult.mutations.isSalesTaxable !== undefined) {
            finalIsSalesTaxable = executionResult.mutations.isSalesTaxable;
          }

          appliedActions = executionResult.appliedActions;
          postCreationMutations = executionResult.mutations;

          if (executionResult.errors && executionResult.errors.length > 0) {
            console.warn('Rule action execution errors:', executionResult.errors);
          }
        }
      } catch (error) {
        console.error('Error applying categorization rules:', error);
      }
    }

    // Validate rule-provided merchantId before inserting transaction
    if (finalMerchantId) {
      const merchantExists = await db
        .select()
        .from(merchants)
        .where(
          and(
            eq(merchants.id, finalMerchantId),
            eq(merchants.userId, userId),
            eq(merchants.householdId, householdId)
          )
        )
        .limit(1);

      if (merchantExists.length === 0) {
        console.warn('Rule set merchantId but merchant not found; ignoring merchant mutation');
        finalMerchantId = null;
      }
    }

    await runInDatabaseTransaction(async (tx) => {
      const nowIso = new Date().toISOString();
      await insertTransactionMovement(tx, {
        id: transactionId,
        userId,
        householdId,
        accountId: tmpl.accountId,
        categoryId: appliedCategoryId || null,
        date: transactionDate,
        amountCents,
        description: finalDescription,
        merchantId: finalMerchantId,
        notes: tmpl.notes || null,
        type: tmpl.type,
        isPending: false,
        isTaxDeductible: finalIsTaxDeductible,
        isSalesTaxable: finalIsSalesTaxable,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      const currentBalanceCents = getAccountBalanceCents(account[0]);
      const updatedBalanceCents =
        tmpl.type === 'expense' || tmpl.type === 'transfer_out'
          ? currentBalanceCents - amountCents
          : currentBalanceCents + amountCents;

      await updateScopedAccountBalance(tx, {
        accountId: tmpl.accountId,
        userId,
        householdId,
        balanceCents: updatedBalanceCents,
        lastUsedAt: nowIso,
        usageCount: (account[0].usageCount || 0) + 1,
      });
    });

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
        .where(
          and(
            eq(budgetCategories.id, appliedCategoryId),
            eq(budgetCategories.userId, userId),
            eq(budgetCategories.householdId, householdId)
          )
        )
        .limit(1);

      if (category.length > 0) {
        await db
          .update(budgetCategories)
          .set({
            lastUsedAt: new Date().toISOString(),
            usageCount: (category[0].usageCount || 0) + 1,
          })
          .where(
            and(
              eq(budgetCategories.id, appliedCategoryId),
              eq(budgetCategories.userId, userId),
              eq(budgetCategories.householdId, householdId)
            )
          );

        // Track in usage analytics
        const analyticsId = nanoid();
        const existingAnalytics = await db
          .select()
          .from(usageAnalytics)
          .where(
            and(
              eq(usageAnalytics.userId, userId),
              eq(usageAnalytics.householdId, householdId),
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
                eq(usageAnalytics.householdId, householdId),
                eq(usageAnalytics.itemType, 'category'),
                eq(usageAnalytics.itemId, appliedCategoryId)
              )
            );
        } else {
          await db.insert(usageAnalytics).values({
            id: analyticsId,
            userId,
            householdId,
            itemType: 'category',
            itemId: appliedCategoryId,
            usageCount: 1,
            lastUsedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    // Create or update merchant and track usage (household-scoped)
    // - If a rule explicitly set a merchantId, update that merchant directly.
    // - Otherwise keep the existing "normalized description" merchant upsert behavior.
    if (finalMerchantId) {
      const merchantById = await db
        .select()
        .from(merchants)
        .where(
          and(
            eq(merchants.id, finalMerchantId),
            eq(merchants.userId, userId),
            eq(merchants.householdId, householdId)
          )
        )
        .limit(1);

      if (merchantById.length > 0 && merchantById[0]) {
        const currentSpent = new Decimal(merchantById[0].totalSpent || 0);
        const newSpent = currentSpent.plus(decimalAmount);
        const usageCount = (merchantById[0].usageCount || 0);
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
              eq(merchants.id, finalMerchantId),
              eq(merchants.userId, userId),
              eq(merchants.householdId, householdId)
            )
          );
      }
    }

    if (!finalMerchantId) {
      const normalizedDescription = finalDescription.toLowerCase().trim();
      const existingMerchant = await db
        .select()
        .from(merchants)
        .where(
          and(
            eq(merchants.userId, userId),
            eq(merchants.householdId, householdId),
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
              eq(merchants.householdId, householdId),
              eq(merchants.normalizedName, normalizedDescription)
            )
          );
      } else {
        const merchantId = nanoid();
        await db.insert(merchants).values({
          id: merchantId,
          userId,
          householdId,
          name: finalDescription,
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
    }

    // Log rule execution if a rule was applied
    if (appliedRuleId) {
      try {
        await db.insert(ruleExecutionLog).values({
          id: nanoid(),
          userId,
          householdId,
          ruleId: appliedRuleId,
          transactionId,
          appliedCategoryId: appliedCategoryId || null,
          appliedActions: appliedActions.length > 0 ? JSON.stringify(appliedActions) : null,
          matched: true,
          executedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error logging rule execution:', error);
      }
    }

    // Handle post-creation actions (convert to transfer, splits, account change)
    if (postCreationMutations?.convertToTransfer) {
      try {
        const transferResult = await handleTransferConversion(
          userId,
          transactionId,
          postCreationMutations.convertToTransfer
        );

        if (!transferResult.success) {
          console.warn('Repeat transaction transfer conversion failed:', transferResult.error);
        }
      } catch (error) {
        console.error('Error converting repeated transaction to transfer:', error);
      }
    }

    if (postCreationMutations?.createSplits) {
      try {
        const splitResult = await handleSplitCreation(
          userId,
          transactionId,
          postCreationMutations.createSplits
        );

        if (!splitResult.success) {
          console.warn('Repeat transaction split creation failed:', splitResult.error);
        }
      } catch (error) {
        console.error('Error creating splits for repeated transaction:', error);
      }
    }

    if (postCreationMutations?.changeAccount) {
      try {
        const accountResult = await handleAccountChange(
          userId,
          transactionId,
          postCreationMutations.changeAccount.targetAccountId
        );

        if (!accountResult.success) {
          console.warn('Repeat transaction account change failed:', accountResult.error);
        }
      } catch (error) {
        console.error('Error changing account for repeated transaction:', error);
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
    if (error instanceof Error && (
      error.message.includes('Household') ||
      error.message.includes('member')
    )) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Transaction repeat error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
    }
}
