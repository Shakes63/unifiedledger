import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { accounts, transactions, budgetCategories, bills } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { isTestMode } from '@/lib/test-mode';

export async function GET(request: Request) {
  try {
    // This endpoint is strictly for development/test environments.
    // Never expose user data via debug endpoints in normal mode.
    if (!isTestMode()) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    // Fetch user's data to verify access
    const [userAccounts, userTransactions, userBudgets, userBills] = await Promise.all([
      db
        .select()
        .from(accounts)
        .where(and(eq(accounts.userId, userId), eq(accounts.householdId, householdId))),
      db
        .select()
        .from(transactions)
        .where(and(eq(transactions.userId, userId), eq(transactions.householdId, householdId)))
        .orderBy(desc(transactions.date))
        .limit(10),
      db
        .select()
        .from(budgetCategories)
        .where(
          and(
            eq(budgetCategories.userId, userId),
            eq(budgetCategories.householdId, householdId)
          )
        ),
      db
        .select()
        .from(bills)
        .where(and(eq(bills.userId, userId), eq(bills.householdId, householdId))),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Test-mode data access check',
      dataSummary: {
        accounts: userAccounts.length,
        transactions: userTransactions.length,
        budgetCategories: userBudgets.length,
        bills: userBills.length,
      },
      sampleData: {
        accounts: userAccounts.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          currentBalance: a.currentBalance,
        })),
        recentTransactions: userTransactions.slice(0, 5).map((t) => ({
          id: t.id,
          description: t.description,
          amount: t.amount,
          date: t.date,
          type: t.type,
        })),
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message === 'Household ID is required') {
        return NextResponse.json({ error: 'Household ID is required' }, { status: 400 });
      }
      if (error.message.startsWith('Unauthorized:')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    console.error('Data access test error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
