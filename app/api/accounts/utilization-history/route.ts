import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { accountBalanceHistory, accounts } from '@/lib/db/schema';
import { eq, and, gte, inArray, desc } from 'drizzle-orm';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import Decimal from 'decimal.js';
import { format, startOfDay, subDays } from 'date-fns';

export const dynamic = 'force-dynamic';

interface UtilizationDataPoint {
  date: string;
  utilization: number;
  balance: number;
  creditLimit: number;
  accountId?: string;
  accountName?: string;
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

    // Calculate start date
    const endDate = startOfDay(new Date());
    const startDate = subDays(endDate, days);
    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');

    // Get credit accounts for name lookup
    const creditAccounts = await db
      .select({ id: accounts.id, name: accounts.name })
      .from(accounts)
      .where(
        and(
          eq(accounts.householdId, householdId),
          inArray(accounts.type, ['credit', 'line_of_credit']),
          eq(accounts.isActive, true)
        )
      );

    const accountNameMap = new Map(creditAccounts.map(a => [a.id, a.name]));
    const accountIds = creditAccounts.map(a => a.id);

    if (accountIds.length === 0) {
      return Response.json({
        history: [],
        aggregated: [],
        message: 'No credit accounts found',
      });
    }

    // Build query conditions
    const conditions = [
      eq(accountBalanceHistory.householdId, householdId),
      gte(accountBalanceHistory.snapshotDate, startDateStr),
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
    const historyData: UtilizationDataPoint[] = history.map((h) => ({
      date: h.snapshotDate,
      utilization: h.utilizationPercent || 0,
      balance: h.balance,
      creditLimit: h.creditLimit || 0,
      accountId: h.accountId,
      accountName: accountNameMap.get(h.accountId) || 'Unknown',
    }));

    // Aggregate by date for overall utilization trend
    const dateAggregation = new Map<string, { totalBalance: number; totalLimit: number }>();
    
    for (const point of history) {
      const date = point.snapshotDate;
      const existing = dateAggregation.get(date) || { totalBalance: 0, totalLimit: 0 };
      dateAggregation.set(date, {
        totalBalance: new Decimal(existing.totalBalance).plus(new Decimal(point.balance)).toNumber(),
        totalLimit: new Decimal(existing.totalLimit).plus(new Decimal(point.creditLimit || 0)).toNumber(),
      });
    }

    const aggregatedData: { date: string; utilization: number; balance: number; creditLimit: number }[] = [];
    for (const [date, { totalBalance, totalLimit }] of dateAggregation.entries()) {
      const utilization = totalLimit > 0 
        ? new Decimal(totalBalance).div(totalLimit).times(100).toNumber()
        : 0;
      aggregatedData.push({
        date,
        utilization,
        balance: totalBalance,
        creditLimit: totalLimit,
      });
    }

    // Sort by date
    aggregatedData.sort((a, b) => a.date.localeCompare(b.date));

    // If no historical data, generate current snapshot
    if (aggregatedData.length === 0) {
      // Get current account balances
      const currentAccounts = await db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.householdId, householdId),
            inArray(accounts.type, ['credit', 'line_of_credit']),
            eq(accounts.isActive, true)
          )
        );

      const today = endDateStr;
      let totalBalance = 0;
      let totalLimit = 0;

      for (const acc of currentAccounts) {
        totalBalance = new Decimal(totalBalance).plus(new Decimal(Math.abs(acc.currentBalance || 0))).toNumber();
        totalLimit = new Decimal(totalLimit).plus(new Decimal(acc.creditLimit || 0)).toNumber();
      }

      const currentUtilization = totalLimit > 0
        ? new Decimal(totalBalance).div(totalLimit).times(100).toNumber()
        : 0;

      aggregatedData.push({
        date: today,
        utilization: currentUtilization,
        balance: totalBalance,
        creditLimit: totalLimit,
      });
    }

    return Response.json({
      history: historyData,
      aggregated: aggregatedData,
      accounts: creditAccounts.map(a => ({ id: a.id, name: a.name })),
      dateRange: {
        start: startDateStr,
        end: endDateStr,
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
    console.error('Utilization history fetch error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
