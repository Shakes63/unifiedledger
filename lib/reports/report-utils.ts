import { and, eq, gte, lte, desc, inArray, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import { transactions, budgetCategories, accounts } from '@/lib/db/schema';
import {
  getMonthRangeForDate,
  getYearRangeForDate,
  toLocalDateString,
} from '@/lib/utils/local-date';
import Decimal from 'decimal.js';
import { toMoneyCents } from '@/lib/utils/money-cents';

/**
 * Utility functions for generating reports
 * Shared logic for all report endpoints
 */

export interface DateRange {
  startDate: string; // ISO string
  endDate: string;   // ISO string
}

export interface TransactionData {
  id: string;
  userId: string;
  accountId: string;
  categoryId: string | null;
  merchantId: string | null;
  date: string;
  amount: number;
  amountCents?: number | string | bigint | null;
  description: string;
  type: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
}

function asCents(value: number | string | bigint | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = typeof value === 'bigint' ? Number(value) : Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.trunc(parsed);
}

export function getTransactionAmountCents(
  txn: Pick<TransactionData, 'amount' | 'amountCents'>
): number {
  const cents = asCents(txn.amountCents);
  if (cents !== null) {
    return cents;
  }
  return toMoneyCents(txn.amount) ?? 0;
}

export function getTransactionAmountValue(
  txn: Pick<TransactionData, 'amount' | 'amountCents'>
): number {
  return new Decimal(getTransactionAmountCents(txn)).div(100).toNumber();
}

export function getAccountBalanceCents(account: {
  currentBalance: number | null;
  currentBalanceCents?: number | string | bigint | null;
}): number {
  const cents = asCents(account.currentBalanceCents);
  if (cents !== null) {
    return cents;
  }
  return toMoneyCents(account.currentBalance) ?? 0;
}

export function getAccountBalanceValue(account: {
  currentBalance: number | null;
  currentBalanceCents?: number | string | bigint | null;
}): number {
  return new Decimal(getAccountBalanceCents(account)).div(100).toNumber();
}

/**
 * Get transactions within a date range for a user and household
 * Supports optional filtering by account, category, and merchant
 */
export async function getTransactionsByDateRange(
  userId: string,
  householdId: string,
  startDate: string,
  endDate: string,
  filters?: {
    accountIds?: string[];
    categoryIds?: string[];
    merchantIds?: string[];
  }
): Promise<TransactionData[]> {
  const conditions: SQL[] = [
    eq(transactions.userId, userId),
    eq(transactions.householdId, householdId),
    gte(transactions.date, startDate),
    lte(transactions.date, endDate),
  ];

  // Apply filters if provided
  if (filters?.accountIds && filters.accountIds.length > 0) {
    conditions.push(inArray(transactions.accountId, filters.accountIds));
  }

  if (filters?.categoryIds && filters.categoryIds.length > 0) {
    conditions.push(inArray(transactions.categoryId, filters.categoryIds));
  }

  if (filters?.merchantIds && filters.merchantIds.length > 0) {
    conditions.push(inArray(transactions.merchantId, filters.merchantIds));
  }

  const result = await db
    .select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.date));

  return result as TransactionData[];
}

/**
 * Get current month's date range
 */
export function getCurrentMonthRange(): DateRange {
  const now = new Date();
  return getMonthRangeForDate(now);
}

/**
 * Get current year's date range
 */
export function getCurrentYearRange(): DateRange {
  const now = new Date();
  return getYearRangeForDate(now);
}

/**
 * Get last 12 months of date ranges
 */
export function getLast12MonthsRanges(): DateRange[] {
  const ranges: DateRange[] = [];
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    ranges.push(getMonthRangeForDate(date));
  }

  return ranges;
}

/**
 * Calculate date range from period or custom dates
 * Returns startDate and endDate as ISO date strings
 */
export function calculateDateRange(
  period?: string | null,
  startDateParam?: string | null,
  endDateParam?: string | null
): { startDate: string; endDate: string } {
  // If custom dates provided, use them
  if (startDateParam && endDateParam) {
    return {
      startDate: startDateParam,
      endDate: endDateParam,
    };
  }

  // Otherwise, calculate from period
  const now = new Date();
  let startDate: Date;
  let endDate: Date;

  if (period === 'month') {
    // Current month
    const monthRange = getMonthRangeForDate(now);
    return monthRange;
  } else if (period === 'year') {
    // Current year
    const yearRange = getYearRangeForDate(now);
    return yearRange;
  } else {
    // Default: last 12 months
    endDate = new Date(now);
    startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 11, 1);
  }

  return {
    startDate: toLocalDateString(startDate),
    endDate: toLocalDateString(endDate),
  };
}

/**
 * Group transactions by category
 */
export function groupByCategory(txns: TransactionData[]): Map<string, TransactionData[]> {
  const grouped = new Map<string, TransactionData[]>();

  txns.forEach((txn) => {
    const category = txn.categoryId || 'uncategorized';
    if (!grouped.has(category)) {
      grouped.set(category, []);
    }
    grouped.get(category)!.push(txn);
  });

  return grouped;
}

/**
 * Group transactions by merchant
 * Uses merchantId if available, otherwise falls back to description
 */
export function groupByMerchant(txns: TransactionData[]): Map<string, TransactionData[]> {
  const grouped = new Map<string, TransactionData[]>();

  txns.forEach((txn) => {
    // Use merchantId if available, otherwise use description
    const merchant = txn.merchantId || txn.description;
    if (!grouped.has(merchant)) {
      grouped.set(merchant, []);
    }
    grouped.get(merchant)!.push(txn);
  });

  return grouped;
}

/**
 * Calculate sum of amounts using Decimal for precision
 */
export function calculateSum(txns: TransactionData[]): number {
  const totalCents = txns.reduce((sum, txn) => sum + getTransactionAmountCents(txn), 0);
  return new Decimal(totalCents).div(100).toNumber();
}

/**
 * Calculate sum by type
 */
export function calculateByType(txns: TransactionData[]): Record<string, number> {
  const resultCents: Record<string, number> = {
    income: 0,
    expense: 0,
    transfer_in: 0,
    transfer_out: 0,
  };

  txns.forEach((txn) => {
    resultCents[txn.type] = (resultCents[txn.type] || 0) + getTransactionAmountCents(txn);
  });

  return {
    income: new Decimal(resultCents.income).div(100).toNumber(),
    expense: new Decimal(resultCents.expense).div(100).toNumber(),
    transfer_in: new Decimal(resultCents.transfer_in).div(100).toNumber(),
    transfer_out: new Decimal(resultCents.transfer_out).div(100).toNumber(),
  };
}

/**
 * Format date for display
 */
export function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format month label
 */
export function formatMonthLabel(startDate: string): string {
  const date = new Date(startDate + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

/**
 * Get user's budget categories with usage for a household
 */
export async function getUserCategories(userId: string, householdId: string) {
  const categories = await db
    .select()
    .from(budgetCategories)
    .where(
      and(
        eq(budgetCategories.userId, userId),
        eq(budgetCategories.householdId, householdId)
      )
    )
    .orderBy(desc(budgetCategories.usageCount));

  return categories;
}

/**
 * Get top N merchants
 */
export function getTopMerchants(txns: TransactionData[], limit: number = 10): Array<{
  merchant: string;
  amount: number;
  count: number;
}> {
  const merchantMap = groupByMerchant(txns);
  const merchants = Array.from(merchantMap.entries()).map(([name, txns]) => ({
    merchant: name,
    amount: calculateSum(txns),
    count: txns.length,
  }));

  // Sort by amount descending
  merchants.sort((a, b) => b.amount - a.amount);

  return merchants.slice(0, limit);
}

/**
 * Calculate net worth from account balances for a household
 */
export async function calculateNetWorth(userId: string, householdId: string): Promise<number> {

  const result = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.householdId, householdId),
        eq(accounts.isActive, true)
      )
    );

  const totalCents = result.reduce((sum, account) => sum + getAccountBalanceCents(account), 0);
  return new Decimal(totalCents).div(100).toNumber();
}
