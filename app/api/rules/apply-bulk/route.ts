import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { transactions, budgetCategories, ruleExecutionLog } from '@/lib/db/schema';
import { eq, and, isNull, ne, gte, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { findMatchingRule } from '@/lib/rules/rule-matcher';
import { TransactionData } from '@/lib/rules/condition-evaluator';
export const dynamic = 'force-dynamic';

interface BulkApplyResult {
  totalProcessed: number;
  totalUpdated: number;
  errors: { transactionId: string; error: string }[];
  appliedRules: { transactionId: string; ruleId: string; categoryId: string }[];
}

/**
 * POST /api/rules/apply-bulk - Apply rules to existing transactions without categories
 *
 * Query parameters:
 * - ruleId: Optional - only apply specific rule
 * - categoryId: Optional - only apply to transactions without this category
 * - startDate: Optional - YYYY-MM-DD format
 * - endDate: Optional - YYYY-MM-DD format
 * - limit: Optional - max transactions to process (default 100)
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const ruleId = url.searchParams.get('ruleId');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);

    // Get transactions without categories (or filter by criteria)
    let query = db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
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

    // Get all accounts for name lookup
    const { accounts } = await import('@/lib/db/schema');
    const accountList = await db.select().from(accounts).where(eq(accounts.userId, userId));
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

        // Find matching rule
        const ruleMatch = await findMatchingRule(userId, transactionData);

        if (ruleMatch.matched && ruleMatch.rule) {
          // Skip if ruleId filter is specified and doesn't match
          if (ruleId && ruleMatch.rule.ruleId !== ruleId) {
            continue;
          }

          // Update transaction with category from rule
          await db
            .update(transactions)
            .set({
              categoryId: ruleMatch.rule.categoryId,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(transactions.id, txn.id));

          // Log the rule execution
          await db.insert(ruleExecutionLog).values({
            id: nanoid(),
            userId,
            ruleId: ruleMatch.rule.ruleId,
            transactionId: txn.id,
            appliedCategoryId: ruleMatch.rule.categoryId,
            matched: true,
            executedAt: new Date().toISOString(),
          });

          result.totalUpdated++;
          result.appliedRules.push({
            transactionId: txn.id,
            ruleId: ruleMatch.rule.ruleId,
            categoryId: ruleMatch.rule.categoryId,
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
    console.error('Bulk rule application error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
