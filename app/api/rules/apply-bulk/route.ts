import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { transactions, budgetCategories, merchants, ruleExecutionLog } from '@/lib/db/schema';
import { eq, and, isNull, ne, gte, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { findMatchingRule } from '@/lib/rules/rule-matcher';
import { TransactionData } from '@/lib/rules/condition-evaluator';
import { executeRuleActions } from '@/lib/rules/actions-executor';
import { handleTransferConversion } from '@/lib/rules/transfer-action-handler';
import { handleSplitCreation } from '@/lib/rules/split-action-handler';
import { handleAccountChange } from '@/lib/rules/account-action-handler';
import type { AppliedAction } from '@/lib/rules/types';
export const dynamic = 'force-dynamic';

interface BulkApplyResult {
  totalProcessed: number;
  totalUpdated: number;
  errors: { transactionId: string; error: string }[];
  appliedRules: {
    transactionId: string;
    ruleId: string;
    categoryId: string | null;
    appliedActions: AppliedAction[];
  }[];
}

/**
 * POST /api/rules/apply-bulk - Apply rules to existing transactions without categories
 *
 * Query parameters:
 * - ruleId: Optional - only apply specific rule
 * - startDate: Optional - YYYY-MM-DD format
 * - endDate: Optional - YYYY-MM-DD format
 * - limit: Optional - max transactions to process (default 100)
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json().catch(() => ({}));
    const { householdId } = await getAndVerifyHousehold(request, userId, body);

    const url = new URL(request.url);
    const ruleId = url.searchParams.get('ruleId');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);

    // Get transactions without categories (or filter by criteria) - filtered by household
    let query = db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.householdId, householdId),
          isNull(transactions.categoryId),
          ne(transactions.type, 'transfer_in'),
          ne(transactions.type, 'transfer_out')
        )
      );

    // Apply date filters if provided
    if (startDate) {
      query = db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.householdId, householdId),
            isNull(transactions.categoryId),
            ne(transactions.type, 'transfer_in'),
            ne(transactions.type, 'transfer_out'),
            gte(transactions.date, startDate)
          )
        );
    }

    if (endDate) {
      query = db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.householdId, householdId),
            isNull(transactions.categoryId),
            ne(transactions.type, 'transfer_in'),
            ne(transactions.type, 'transfer_out'),
            lte(transactions.date, endDate)
          )
        );
    }

    if (startDate && endDate) {
      query = db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.householdId, householdId),
            isNull(transactions.categoryId),
            ne(transactions.type, 'transfer_in'),
            ne(transactions.type, 'transfer_out'),
            gte(transactions.date, startDate),
            lte(transactions.date, endDate)
          )
        );
    }

    const targetTransactions = await query.limit(limit);

    if (targetTransactions.length === 0) {
      return Response.json({
        totalProcessed: 0,
        totalUpdated: 0,
        errors: [],
        appliedRules: [],
      } as BulkApplyResult);
    }

    // Get all accounts for name lookup (filtered by household)
    const { accounts } = await import('@/lib/db/schema');
    const accountList = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId)
        )
      );
    const accountMap = new Map(accountList.map(a => [a.id, a.name]));

    const result: BulkApplyResult = {
      totalProcessed: targetTransactions.length,
      totalUpdated: 0,
      errors: [],
      appliedRules: [],
    };

    // Process each transaction
    for (const txn of targetTransactions) {
      try {
        const accountName = accountMap.get(txn.accountId) || 'Unknown';

        // Build transaction data for rule matching
        const transactionData: TransactionData = {
          description: txn.description,
          amount: txn.amount,
          accountName,
          date: txn.date,
          notes: txn.notes || undefined,
        };

        // Find matching rule (filtered by household)
        const ruleMatch = await findMatchingRule(userId, householdId, transactionData);

        if (ruleMatch.matched && ruleMatch.rule) {
          // Skip if ruleId filter is specified and doesn't match
          if (ruleId && ruleMatch.rule.ruleId !== ruleId) {
            continue;
          }

          // Get merchant info if exists (for action context)
          let merchantInfo = null;
          if (txn.merchantId) {
            const merchantResult = await db
              .select()
              .from(merchants)
              .where(
                and(
                  eq(merchants.id, txn.merchantId),
                  eq(merchants.userId, userId),
                  eq(merchants.householdId, householdId)
                )
              )
              .limit(1);
            if (merchantResult.length > 0) {
              merchantInfo = {
                id: merchantResult[0].id,
                name: merchantResult[0].name,
              };
            }
          }

          // Get category info if exists (for action context)
          let categoryInfo = null;
          if (txn.categoryId) {
            const categoryResult = await db
              .select()
              .from(budgetCategories)
              .where(
                and(
                  eq(budgetCategories.id, txn.categoryId),
                  eq(budgetCategories.userId, userId),
                  eq(budgetCategories.householdId, householdId)
                )
              )
              .limit(1);
            if (categoryResult.length > 0) {
              categoryInfo = {
                id: categoryResult[0].id,
                name: categoryResult[0].name,
                type: categoryResult[0].type,
              };
            }
          }

          // Execute rule actions
          const executionResult = await executeRuleActions(
            userId,
            ruleMatch.rule.actions,
            {
              categoryId: txn.categoryId || null,
              description: txn.description,
              merchantId: txn.merchantId || null,
              accountId: txn.accountId,
              amount: txn.amount,
              date: txn.date,
              type: txn.type || 'expense',
              isTaxDeductible: txn.isTaxDeductible || false,
            },
            merchantInfo,
            categoryInfo,
            householdId
          );

          // Build update object with only changed fields
          const updates: Partial<typeof transactions.$inferInsert> = {
            updatedAt: new Date().toISOString(),
          };

          if (executionResult.mutations.categoryId !== undefined) {
            updates.categoryId = executionResult.mutations.categoryId;
          }
          if (executionResult.mutations.description) {
            updates.description = executionResult.mutations.description;
          }
          if (executionResult.mutations.merchantId !== undefined) {
            updates.merchantId = executionResult.mutations.merchantId;
          }
          if (executionResult.mutations.isTaxDeductible !== undefined) {
            updates.isTaxDeductible = executionResult.mutations.isTaxDeductible;
          }

          // Update transaction with all mutations
          if (Object.keys(updates).length > 1) { // More than just updatedAt
            await db
              .update(transactions)
              .set(updates)
              .where(eq(transactions.id, txn.id));
          }

          // Handle post-creation actions (convert to transfer, create splits)
          if (executionResult.mutations.convertToTransfer) {
            try {
              const transferResult = await handleTransferConversion(
                userId,
                txn.id,
                executionResult.mutations.convertToTransfer
              );
              if (!transferResult.success) {
                console.error(`Transfer conversion failed for ${txn.id}:`, transferResult.error);
              }
            } catch (error) {
              console.error(`Transfer conversion error for ${txn.id}:`, error);
            }
          }

          if (executionResult.mutations.createSplits) {
            try {
              const splitResult = await handleSplitCreation(
                userId,
                txn.id,
                executionResult.mutations.createSplits
              );
              if (!splitResult.success) {
                console.error(`Split creation failed for ${txn.id}:`, splitResult.error);
              }
            } catch (error) {
              console.error(`Split creation error for ${txn.id}:`, error);
            }
          }

          if (executionResult.mutations.changeAccount) {
            try {
              const accountResult = await handleAccountChange(
                userId,
                txn.id,
                executionResult.mutations.changeAccount.targetAccountId
              );
              if (!accountResult.success) {
                console.error(`Account change failed for ${txn.id}:`, accountResult.error);
              }
            } catch (error) {
              console.error(`Account change error for ${txn.id}:`, error);
            }
          }

          // Log the rule execution with applied actions
          await db.insert(ruleExecutionLog).values({
            id: nanoid(),
            userId,
            householdId,
            ruleId: ruleMatch.rule.ruleId,
            transactionId: txn.id,
            appliedCategoryId: executionResult.mutations.categoryId || null,
            appliedActions: executionResult.appliedActions.length > 0
              ? JSON.stringify(executionResult.appliedActions)
              : null,
            matched: true,
            executedAt: new Date().toISOString(),
          });

          result.totalUpdated++;
          result.appliedRules.push({
            transactionId: txn.id,
            ruleId: ruleMatch.rule.ruleId,
            categoryId: executionResult.mutations.categoryId || null,
            appliedActions: executionResult.appliedActions,
          });
        }
      } catch (error) {
        result.errors.push({
          transactionId: txn.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return Response.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Bulk rule application error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
