/**
 * Interest Paid Report API
 * 
 * Phase 14: Balance History & Trends
 * 
 * Tracks interest charges paid across credit accounts.
 * Detects interest via:
 * 1. Transaction descriptions matching interest patterns
 * 2. Categories marked as interest categories
 */

import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { transactions, accounts, budgetCategories } from '@/lib/db/schema';
import { eq, and, gte, lte, inArray, or, like, sql } from 'drizzle-orm';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import Decimal from 'decimal.js';
import { format, startOfDay, subDays } from 'date-fns';

export const dynamic = 'force-dynamic';

// Patterns that indicate an interest charge
const INTEREST_PATTERNS = [
  '%INTEREST CHARGE%',
  '%FINANCE CHARGE%',
  '%PERIODIC INTEREST%',
  '%PURCHASE INTEREST%',
  '%CASH ADVANCE INTEREST%',
  '%INTEREST PAYMENT%',
  '%INTEREST FEE%',
];

interface InterestPaymentRecord {
  transactionId: string;
  date: string;
  description: string;
  amount: number;
  accountId: string;
  accountName: string;
  accountColor: string;
}

interface AccountInterestSummary {
  accountId: string;
  accountName: string;
  accountColor: string;
  interestPaid: number;
  interestRate: number | null;
  transactionCount: number;
}

interface MonthlyBreakdown {
  month: string; // YYYY-MM format
  total: number;
  byAccount: Record<string, number>;
}

interface InterestPaidResponse {
  summary: {
    totalInterestPaid: number;
    ytdInterestPaid: number;
    averageMonthly: number;
  };
  byAccount: AccountInterestSummary[];
  monthly: MonthlyBreakdown[];
  transactions: InterestPaymentRecord[];
  dateRange: {
    start: string;
    end: string;
    days: number;
  };
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
    const days = parseInt(searchParams.get('days') || '365');
    const accountId = searchParams.get('accountId'); // optional - filter to single account

    // Calculate date range
    const endDate = startOfDay(new Date());
    const startDate = subDays(endDate, days);
    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');

    // YTD calculation
    const currentYear = new Date().getFullYear();
    const ytdStartDate = `${currentYear}-01-01`;

    // Get credit accounts
    const creditAccountsQuery = await db
      .select({
        id: accounts.id,
        name: accounts.name,
        color: accounts.color,
        interestRate: accounts.interestRate,
      })
      .from(accounts)
      .where(
        and(
          eq(accounts.householdId, householdId),
          inArray(accounts.type, ['credit', 'line_of_credit']),
          eq(accounts.isActive, true)
        )
      );

    if (creditAccountsQuery.length === 0) {
      return Response.json({
        summary: { totalInterestPaid: 0, ytdInterestPaid: 0, averageMonthly: 0 },
        byAccount: [],
        monthly: [],
        transactions: [],
        dateRange: { start: startDateStr, end: endDateStr, days },
        message: 'No credit accounts found',
      });
    }

    // Disambiguate duplicate account names so monthly keys don't collide
    const nameCounts = new Map<string, number>();
    for (const acc of creditAccountsQuery) {
      nameCounts.set(acc.name, (nameCounts.get(acc.name) || 0) + 1);
    }
    const accountDisplayName = new Map<string, string>();
    for (const acc of creditAccountsQuery) {
      const count = nameCounts.get(acc.name) || 0;
      accountDisplayName.set(acc.id, count > 1 ? `${acc.name} (${acc.id.slice(0, 4)})` : acc.name);
    }

    const accountMap = new Map(creditAccountsQuery.map(a => [a.id, {
      name: accountDisplayName.get(a.id) || a.name,
      color: a.color || '#ef4444',
      interestRate: a.interestRate,
    }]));
    const accountIds = accountId && accountMap.has(accountId) 
      ? [accountId] 
      : Array.from(accountMap.keys());

    // Get interest categories
    const interestCategories = await db
      .select({ id: budgetCategories.id })
      .from(budgetCategories)
      .where(
        and(
          eq(budgetCategories.householdId, householdId),
          eq(budgetCategories.isInterestCategory, true)
        )
      );
    const interestCategoryIds = interestCategories.map(c => c.id);

    // Build conditions for interest transactions
    // An interest transaction matches if:
    // 1. Description matches interest patterns, OR
    // 2. Category is marked as an interest category
    const patternConditions = INTEREST_PATTERNS.map(pattern => 
      like(sql`UPPER(${transactions.description})`, pattern)
    );

    const categoryCondition = interestCategoryIds.length > 0
      ? inArray(transactions.categoryId, interestCategoryIds)
      : undefined;

    const interestCondition = categoryCondition 
      ? or(...patternConditions, categoryCondition)
      : or(...patternConditions);

    // Query interest transactions
    const interestTransactions = await db
      .select({
        id: transactions.id,
        date: transactions.date,
        description: transactions.description,
        amount: transactions.amount,
        accountId: transactions.accountId,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.householdId, householdId),
          inArray(transactions.accountId, accountIds),
          eq(transactions.type, 'expense'),
          gte(transactions.date, startDateStr),
          lte(transactions.date, endDateStr),
          interestCondition
        )
      )
      .orderBy(transactions.date);

    // Process transactions
    const transactionRecords: InterestPaymentRecord[] = [];
    const accountTotals = new Map<string, { total: number; count: number }>();
    const monthlyTotals = new Map<string, Map<string, number>>();
    let totalInterestPaid = new Decimal(0);
    let ytdInterestPaid = new Decimal(0);

    for (const tx of interestTransactions) {
      const accountMeta = accountMap.get(tx.accountId);
      if (!accountMeta) continue;

      const amount = Math.abs(tx.amount);
      totalInterestPaid = totalInterestPaid.plus(amount);

      // YTD calculation
      if (tx.date >= ytdStartDate) {
        ytdInterestPaid = ytdInterestPaid.plus(amount);
      }

      // Track by account
      const accountTotal = accountTotals.get(tx.accountId) || { total: 0, count: 0 };
      accountTotal.total = new Decimal(accountTotal.total).plus(amount).toNumber();
      accountTotal.count++;
      accountTotals.set(tx.accountId, accountTotal);

      // Track by month
      const month = tx.date.substring(0, 7); // YYYY-MM
      if (!monthlyTotals.has(month)) {
        monthlyTotals.set(month, new Map());
      }
      const monthAccounts = monthlyTotals.get(month)!;
      const currentMonthAmount = monthAccounts.get(tx.accountId) || 0;
      monthAccounts.set(tx.accountId, new Decimal(currentMonthAmount).plus(amount).toNumber());

      // Add to transaction records
      transactionRecords.push({
        transactionId: tx.id,
        date: tx.date,
        description: tx.description,
        amount,
        accountId: tx.accountId,
        accountName: accountMeta.name,
        accountColor: accountMeta.color,
      });
    }

    // Build account summaries
    const byAccount: AccountInterestSummary[] = [];
    for (const [accId, totals] of accountTotals.entries()) {
      const accountMeta = accountMap.get(accId);
      if (!accountMeta) continue;

      byAccount.push({
        accountId: accId,
        accountName: accountMeta.name,
        accountColor: accountMeta.color,
        interestPaid: totals.total,
        interestRate: accountMeta.interestRate,
        transactionCount: totals.count,
      });
    }

    // Sort by interest paid descending
    byAccount.sort((a, b) => b.interestPaid - a.interestPaid);

    // Build monthly breakdown
    const monthly: MonthlyBreakdown[] = [];
    for (const [month, accountAmounts] of monthlyTotals.entries()) {
      let total = new Decimal(0);
      const byAccountRecord: Record<string, number> = {};
      
      for (const [accId, amount] of accountAmounts.entries()) {
        total = total.plus(amount);
        const accountMeta = accountMap.get(accId);
        if (accountMeta) {
          byAccountRecord[accountMeta.name] = amount;
        }
      }
      
      monthly.push({
        month,
        total: total.toNumber(),
        byAccount: byAccountRecord,
      });
    }

    // Sort months ascending
    monthly.sort((a, b) => a.month.localeCompare(b.month));

    // Calculate average monthly
    const monthCount = monthly.length || 1;
    const averageMonthly = totalInterestPaid.div(monthCount).toNumber();

    const response: InterestPaidResponse = {
      summary: {
        totalInterestPaid: totalInterestPaid.toNumber(),
        ytdInterestPaid: ytdInterestPaid.toNumber(),
        averageMonthly,
      },
      byAccount,
      monthly,
      transactions: transactionRecords,
      dateRange: {
        start: startDateStr,
        end: endDateStr,
        days,
      },
    };

    return Response.json(response);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Interest paid report error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
