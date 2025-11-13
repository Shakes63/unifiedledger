import { auth } from '@/lib/better-auth';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { accounts, transactions, budgetCategories, bills } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - No Better Auth session found' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Fetch user's data to verify access
    const [userAccounts, userTransactions, userBudgets, userBills] = await Promise.all([
      db.select().from(accounts).where(eq(accounts.userId, userId)),
      db.select().from(transactions).where(eq(transactions.userId, userId)).limit(10),
      db.select().from(budgetCategories).where(eq(budgetCategories.userId, userId)),
      db.select().from(bills).where(eq(bills.userId, userId)),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Data access successful with Better Auth!',
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      },
      dataSummary: {
        accounts: userAccounts.length,
        transactions: userTransactions.length,
        budgetCategories: userBudgets.length,
        bills: userBills.length,
      },
      sampleData: {
        accounts: userAccounts.map(a => ({
          id: a.id,
          name: a.name,
          type: a.type,
          currentBalance: a.currentBalance,
        })),
        recentTransactions: userTransactions.slice(0, 5).map(t => ({
          id: t.id,
          description: t.description,
          amount: t.amount,
          date: t.date,
          type: t.type,
        })),
      },
    });
  } catch (error) {
    console.error('Data access test error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
