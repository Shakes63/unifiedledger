import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { transactions, savingsGoalContributions, accounts } from '@/lib/db/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import Decimal from 'decimal.js';

export const dynamic = 'force-dynamic';

interface SavingsRateData {
  period: string; // YYYY-MM format
  totalIncome: number;
  totalSavingsContributions: number;
  savingsRate: number; // percentage (0-100)
}

interface SavingsRateResponse {
  data: SavingsRateData[];
  summary: {
    averageRate: number;
    totalSaved: number;
    totalIncome: number;
    trend: 'up' | 'down' | 'stable';
  };
}

/**
 * GET /api/reports/savings-rate
 * Calculate savings rate (savings/income ratio) over time
 * 
 * Query params:
 * - period: 'monthly' | 'quarterly' | 'yearly' (default: 'monthly')
 * - startDate: ISO date string (optional, defaults to 6 months ago)
 * - endDate: ISO date string (optional, defaults to today)
 */
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

    const url = new URL(request.url);
    const period = (url.searchParams.get('period') || 'monthly') as 'monthly' | 'quarterly' | 'yearly';
    
    // Default date range: last 6 months
    const now = new Date();
    const defaultStartDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const startDateStr = url.searchParams.get('startDate') || defaultStartDate.toISOString().split('T')[0];
    const endDateStr = url.searchParams.get('endDate') || now.toISOString().split('T')[0];

    // Get total income by period
    const incomeData = await db
      .select({
        period: period === 'yearly'
          ? sql<string>`strftime('%Y', ${transactions.date})`
          : period === 'quarterly'
            ? sql<string>`strftime('%Y', ${transactions.date}) || '-Q' || ((cast(strftime('%m', ${transactions.date}) as integer) + 2) / 3)`
            : sql<string>`strftime('%Y-%m', ${transactions.date})`,
        total: sql<number>`SUM(${transactions.amount})`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.householdId, householdId),
          eq(transactions.type, 'income'),
          gte(transactions.date, startDateStr),
          lte(transactions.date, endDateStr)
        )
      )
      .groupBy(
        period === 'yearly'
          ? sql`strftime('%Y', ${transactions.date})`
          : period === 'quarterly'
            ? sql`strftime('%Y', ${transactions.date}) || '-Q' || ((cast(strftime('%m', ${transactions.date}) as integer) + 2) / 3)`
            : sql`strftime('%Y-%m', ${transactions.date})`
      )
      .orderBy(sql`1`);

    // Get savings contributions by period (3 sources)
    // Source 1: Direct goal contributions from savingsGoalContributions table
    const directContributions = await db
      .select({
        period: period === 'yearly'
          ? sql<string>`strftime('%Y', ${savingsGoalContributions.createdAt})`
          : period === 'quarterly'
            ? sql<string>`strftime('%Y', ${savingsGoalContributions.createdAt}) || '-Q' || ((cast(strftime('%m', ${savingsGoalContributions.createdAt}) as integer) + 2) / 3)`
            : sql<string>`strftime('%Y-%m', ${savingsGoalContributions.createdAt})`,
        total: sql<number>`SUM(${savingsGoalContributions.amount})`,
      })
      .from(savingsGoalContributions)
      .where(
        and(
          eq(savingsGoalContributions.userId, userId),
          eq(savingsGoalContributions.householdId, householdId),
          gte(savingsGoalContributions.createdAt, startDateStr),
          lte(savingsGoalContributions.createdAt, endDateStr)
        )
      )
      .groupBy(
        period === 'yearly'
          ? sql`strftime('%Y', ${savingsGoalContributions.createdAt})`
          : period === 'quarterly'
            ? sql`strftime('%Y', ${savingsGoalContributions.createdAt}) || '-Q' || ((cast(strftime('%m', ${savingsGoalContributions.createdAt}) as integer) + 2) / 3)`
            : sql`strftime('%Y-%m', ${savingsGoalContributions.createdAt})`
      )
      .orderBy(sql`1`);

    // Source 2: Transfers to savings accounts
    const savingsAccountIds = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId),
          eq(accounts.type, 'savings')
        )
      );

    let transferContributions: { period: string; total: number }[] = [];
    
    if (savingsAccountIds.length > 0) {
      // Get transfer_in transactions to savings accounts
      // Note: We use transfer_out because the amount flows from source to destination
      // The toAccountId (stored in transferId for legacy reasons or actual destination) tells us where it went
      const savingsIds = savingsAccountIds.map(a => a.id);
      
      // Get transfers where the linked transfer goes TO a savings account
      // For transfer_out, the paired transfer_in's accountId is the destination
      transferContributions = await db
        .select({
          period: period === 'yearly'
            ? sql<string>`strftime('%Y', ${transactions.date})`
            : period === 'quarterly'
              ? sql<string>`strftime('%Y', ${transactions.date}) || '-Q' || ((cast(strftime('%m', ${transactions.date}) as integer) + 2) / 3)`
              : sql<string>`strftime('%Y-%m', ${transactions.date})`,
          total: sql<number>`SUM(${transactions.amount})`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.householdId, householdId),
            eq(transactions.type, 'transfer_in'),
            sql`${transactions.accountId} IN (${sql.join(savingsIds, sql`, `)})`,
            gte(transactions.date, startDateStr),
            lte(transactions.date, endDateStr)
          )
        )
        .groupBy(
          period === 'yearly'
            ? sql`strftime('%Y', ${transactions.date})`
            : period === 'quarterly'
              ? sql`strftime('%Y', ${transactions.date}) || '-Q' || ((cast(strftime('%m', ${transactions.date}) as integer) + 2) / 3)`
              : sql`strftime('%Y-%m', ${transactions.date})`
        )
        .orderBy(sql`1`);
    }

    // Combine all periods
    const allPeriods = new Set<string>();
    incomeData.forEach(d => allPeriods.add(d.period));
    directContributions.forEach(d => allPeriods.add(d.period));
    transferContributions.forEach(d => allPeriods.add(d.period));

    // Create lookup maps
    const incomeByPeriod = new Map(incomeData.map(d => [d.period, d.total || 0]));
    const directContribByPeriod = new Map(directContributions.map(d => [d.period, d.total || 0]));
    const transferContribByPeriod = new Map(transferContributions.map(d => [d.period, d.total || 0]));

    // Calculate savings rate per period
    const sortedPeriods = Array.from(allPeriods).sort();
    const data: SavingsRateData[] = sortedPeriods.map(periodStr => {
      const income = new Decimal(incomeByPeriod.get(periodStr) || 0);
      // Combine contributions (avoiding double-counting by using direct contributions as primary source)
      // Direct contributions are the authoritative source from savingsGoalContributions
      // Transfer contributions are backup for transfers to savings accounts without goal linking
      const directContrib = new Decimal(directContribByPeriod.get(periodStr) || 0);
      const transferContrib = new Decimal(transferContribByPeriod.get(periodStr) || 0);
      
      // Use the maximum to avoid under-counting while preventing obvious double-counting
      // A more sophisticated approach would deduplicate by transactionId
      const totalSavings = Decimal.max(directContrib, transferContrib);
      
      const rate = income.isZero() 
        ? 0 
        : totalSavings.div(income).times(100).toDecimalPlaces(1).toNumber();

      return {
        period: periodStr,
        totalIncome: income.toNumber(),
        totalSavingsContributions: totalSavings.toNumber(),
        savingsRate: Math.min(rate, 100), // Cap at 100% for display
      };
    });

    // Calculate summary
    const totalIncome = data.reduce((sum, d) => sum + d.totalIncome, 0);
    const totalSaved = data.reduce((sum, d) => sum + d.totalSavingsContributions, 0);
    const averageRate = data.length > 0
      ? data.reduce((sum, d) => sum + d.savingsRate, 0) / data.length
      : 0;

    // Calculate trend (compare last period to first period)
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (data.length >= 2) {
      const firstRate = data[0].savingsRate;
      const lastRate = data[data.length - 1].savingsRate;
      const difference = lastRate - firstRate;
      if (difference > 2) trend = 'up';
      else if (difference < -2) trend = 'down';
    }

    const response: SavingsRateResponse = {
      data,
      summary: {
        averageRate: Math.round(averageRate * 10) / 10,
        totalSaved: Math.round(totalSaved * 100) / 100,
        totalIncome: Math.round(totalIncome * 100) / 100,
        trend,
      },
    };

    return Response.json(response);
  } catch (error) {
    console.error('Error calculating savings rate:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return Response.json(
      { error: 'Failed to calculate savings rate' },
      { status: 500 }
    );
  }
}

