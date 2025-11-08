import { and, eq, gte, lte, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { transactions, budgetCategories, merchants } from '@/lib/db/schema';
import Decimal from 'decimal.js';

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
  date: string;
  amount: number;
  description: string;
  type: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
}

/**
 * Get transactions within a date range for a user
 */
export async function getTransactionsByDateRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<TransactionData[]> {
  const result = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate)
      )
    )
    .orderBy(desc(transactions.date));

  return result as TransactionData[];
}

/**
 * Get current month's date range
 */
export function getCurrentMonthRange(): DateRange {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  return { startDate, endDate };
}

/**
 * Get current year's date range
 */
export function getCurrentYearRange(): DateRange {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
  const endDate = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];

  return { startDate, endDate };
}

/**
 * Get last 12 months of date ranges
 */
export function getLast12MonthsRanges(): DateRange[] {
  const ranges: DateRange[] = [];
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const startDate = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
    const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

    ranges.push({ startDate, endDate });
  }

  return ranges;
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
 */
export function groupByMerchant(txns: TransactionData[]): Map<string, TransactionData[]> {
  const grouped = new Map<string, TransactionData[]>();

  txns.forEach((txn) => {
    const merchant = txn.description;
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
  let sum = new Decimal(0);

  txns.forEach((txn) => {
    sum = sum.plus(new Decimal(txn.amount));
  });

  return sum.toNumber();
}

/**
 * Calculate sum by type
 */
export function calculateByType(txns: TransactionData[]): Record<string, number> {
  const result: Record<string, number> = {
    income: 0,
    expense: 0,
    transfer_in: 0,
    transfer_out: 0,
  };

  txns.forEach((txn) => {
    result[txn.type] = (result[txn.type] || 0) + txn.amount;
  });

  return result;
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
 * Get user's budget categories with usage
 */
export async function getUserCategories(userId: string) {
  const categories = await db
    .select()
    .from(budgetCategories)
    .where(eq(budgetCategories.userId, userId))
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
 * Calculate net worth from account balances
 */
export async function calculateNetWorth(userId: string): Promise<number> {
  const { accounts } = require('@/lib/db/schema');

  const result = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.isActive, true)));

  let total = new Decimal(0);

  result.forEach((account: any) => {
    total = total.plus(new Decimal(account.currentBalance || 0));
  });

  return total.toNumber();
}
