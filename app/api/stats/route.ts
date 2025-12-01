import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { transactions, accounts, budgetCategories, bills, savingsGoals, debts } from '@/lib/db/schema';
import { eq, and, count } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stats
 * Returns count statistics for various database entities
 * Used by the Advanced settings tab to display database statistics
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    // Get and validate household
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);

    // TypeScript: householdId is guaranteed to be non-null after requireHouseholdAuth
    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    // Parallel COUNT queries for efficiency
    const [
      transactionCount,
      accountCount,
      categoryCount,
      billCount,
      goalCount,
      debtCount,
    ] = await Promise.all([
      // Transactions count
      db
        .select({ count: count() })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.householdId, householdId)
          )
        ),
      // Accounts count
      db
        .select({ count: count() })
        .from(accounts)
        .where(
          and(
            eq(accounts.userId, userId),
            eq(accounts.householdId, householdId)
          )
        ),
      // Categories count
      db
        .select({ count: count() })
        .from(budgetCategories)
        .where(
          and(
            eq(budgetCategories.userId, userId),
            eq(budgetCategories.householdId, householdId)
          )
        ),
      // Bills count
      db
        .select({ count: count() })
        .from(bills)
        .where(
          and(
            eq(bills.userId, userId),
            eq(bills.householdId, householdId)
          )
        ),
      // Goals count
      db
        .select({ count: count() })
        .from(savingsGoals)
        .where(
          and(
            eq(savingsGoals.userId, userId),
            eq(savingsGoals.householdId, householdId)
          )
        ),
      // Debts count
      db
        .select({ count: count() })
        .from(debts)
        .where(
          and(
            eq(debts.userId, userId),
            eq(debts.householdId, householdId)
          )
        ),
    ]);

    return Response.json({
      transactions: transactionCount[0]?.count ?? 0,
      accounts: accountCount[0]?.count ?? 0,
      categories: categoryCount[0]?.count ?? 0,
      bills: billCount[0]?.count ?? 0,
      goals: goalCount[0]?.count ?? 0,
      debts: debtCount[0]?.count ?? 0,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Stats fetch error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}



