import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { accountBalanceHistory, accounts } from '@/lib/db/schema';
import { eq, and, gte, inArray } from 'drizzle-orm';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import Decimal from 'decimal.js';

export const dynamic = 'force-dynamic';

interface BalanceDataPoint {
  date: string;
  balance: number;
  availableCredit: number;
  accountId: string;
  accountName: string;
  accountColor: string;
}

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    // Get and validate household
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);

    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const accountId = searchParams.get('accountId'); // optional - filter to single account
    const accountType = searchParams.get('type'); // 'credit' | 'line_of_credit' | 'all' | null

    // Calculate start date
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Build account type filter
    type AccountType = 'checking' | 'savings' | 'credit' | 'line_of_credit' | 'investment' | 'cash';
    const typeFilter: AccountType[] = accountType === 'credit' 
      ? ['credit'] 
      : accountType === 'line_of_credit' 
      ? ['line_of_credit']
      : ['credit', 'line_of_credit'];

    // Get credit accounts for metadata
    const creditAccounts = await db
      .select({ 
        id: accounts.id, 
        name: accounts.name, 
        color: accounts.color,
        creditLimit: accounts.creditLimit,
        currentBalance: accounts.currentBalance,
      })
      .from(accounts)
      .where(
        and(
          eq(accounts.householdId, householdId),
          inArray(accounts.type, typeFilter),
          eq(accounts.isActive, true)
        )
      );

    const accountMetaMap = new Map(creditAccounts.map(a => [a.id, { 
      name: a.name, 
      color: a.color || '#ef4444',
      creditLimit: a.creditLimit || 0,
      currentBalance: a.currentBalance || 0,
    }]));
    const accountIds = creditAccounts.map(a => a.id);

    if (accountIds.length === 0) {
      return Response.json({
        history: [],
        aggregated: [],
        accounts: [],
        message: 'No credit accounts found',
      });
    }

    // Build query conditions
    const conditions = [
      eq(accountBalanceHistory.householdId, householdId),
      gte(accountBalanceHistory.snapshotDate, startDate.toISOString().split('T')[0]),
    ];

    if (accountId && accountIds.includes(accountId)) {
      conditions.push(eq(accountBalanceHistory.accountId, accountId));
    } else {
      conditions.push(inArray(accountBalanceHistory.accountId, accountIds));
    }

    // Fetch history
    const history = await db
      .select()
      .from(accountBalanceHistory)
      .where(and(...conditions))
      .orderBy(accountBalanceHistory.snapshotDate, accountBalanceHistory.accountId);

    // Transform to response format
    const historyData: BalanceDataPoint[] = history.map((h) => {
      const meta = accountMetaMap.get(h.accountId) || { name: 'Unknown', color: '#ef4444', creditLimit: 0 };
      return {
        date: h.snapshotDate,
        balance: h.balance,
        availableCredit: h.availableCredit || 0,
        accountId: h.accountId,
        accountName: meta.name,
        accountColor: meta.color,
      };
    });

    // Aggregate by date for stacked view
    const dateMap = new Map<string, Map<string, number>>();
    
    for (const point of history) {
      if (!dateMap.has(point.snapshotDate)) {
        dateMap.set(point.snapshotDate, new Map());
      }
      const accountBalances = dateMap.get(point.snapshotDate)!;
      accountBalances.set(point.accountId, point.balance);
    }

    // Build aggregated data with each account as a separate key
    const aggregatedData: { date: string; total: number; [key: string]: string | number }[] = [];
    
    for (const [date, balances] of dateMap.entries()) {
      const point: { date: string; total: number; [key: string]: string | number } = { 
        date, 
        total: 0 
      };
      
      for (const [accId, balance] of balances.entries()) {
        const meta = accountMetaMap.get(accId);
        if (meta) {
          point[meta.name] = balance;
          point.total = new Decimal(point.total).plus(new Decimal(balance)).toNumber();
        }
      }
      
      aggregatedData.push(point);
    }

    // Sort by date
    aggregatedData.sort((a, b) => a.date.localeCompare(b.date));

    // If no historical data, generate current snapshot
    if (aggregatedData.length === 0) {
      const today = new Date().toISOString().split('T')[0];
      const point: { date: string; total: number; [key: string]: string | number } = { 
        date: today, 
        total: 0 
      };

      for (const acc of creditAccounts) {
        const balance = Math.abs(acc.currentBalance || 0);
        point[acc.name] = balance;
        point.total = new Decimal(point.total).plus(new Decimal(balance)).toNumber();
      }

      aggregatedData.push(point);
    }

    return Response.json({
      history: historyData,
      aggregated: aggregatedData,
      accounts: creditAccounts.map(a => ({ 
        id: a.id, 
        name: a.name, 
        color: a.color || '#ef4444',
      })),
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0],
        days,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Balance history fetch error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

