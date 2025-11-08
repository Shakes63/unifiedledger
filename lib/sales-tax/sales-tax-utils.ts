/**
 * Sales tax calculation and quarterly reporting utilities
 */

import { db } from '@/lib/db';
import {
  salesTaxTransactions,
  quarterlyFilingRecords,
  salesTaxSettings,
} from '@/lib/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import Decimal from 'decimal.js';

/**
 * Quarter definition
 */
export interface Quarter {
  quarter: number;
  startDate: string;
  endDate: string;
  dueDate: string;
}

/**
 * Quarterly report summary
 */
export interface QuarterlyReport {
  year: number;
  quarter: number;
  totalSales: number;
  totalTax: number;
  taxRate: number;
  dueDate: string;
  submittedDate?: string;
  status: 'not_due' | 'pending' | 'submitted' | 'accepted' | 'rejected';
  balanceDue: number;
}

/**
 * Sales tax settings with defaults
 */
export interface SalesTaxSettings {
  defaultRate: number;
  jurisdiction: string;
  fiscalYearStart: string;
  filingFrequency: 'monthly' | 'quarterly' | 'annually';
  enableTracking: boolean;
}

/**
 * Get US quarter dates and due dates (standard)
 */
export function getQuarterDates(year: number): Quarter[] {
  return [
    {
      quarter: 1,
      startDate: `${year}-01-01`,
      endDate: `${year}-03-31`,
      dueDate: `${year}-04-20`, // Q1 typically due April 20
    },
    {
      quarter: 2,
      startDate: `${year}-04-01`,
      endDate: `${year}-06-30`,
      dueDate: `${year}-07-20`, // Q2 typically due July 20
    },
    {
      quarter: 3,
      startDate: `${year}-07-01`,
      endDate: `${year}-09-30`,
      dueDate: `${year}-10-20`, // Q3 typically due October 20
    },
    {
      quarter: 4,
      startDate: `${year}-10-01`,
      endDate: `${year}-12-31`,
      dueDate: `${year + 1}-01-20`, // Q4 typically due January 20 next year
    },
  ];
}

/**
 * Calculate tax amount
 */
export function calculateTaxAmount(saleAmount: number, taxRate: number): number {
  const sale = new Decimal(saleAmount);
  const rate = new Decimal(taxRate);
  return sale.times(rate).toNumber();
}

/**
 * Get quarterly report for a specific quarter
 * @param userId User ID
 * @param year Tax year
 * @param quarter Quarter (1-4)
 * @param accountId Optional - filter by specific business account
 */
export async function getQuarterlyReport(
  userId: string,
  year: number,
  quarter: number,
  accountId?: string
): Promise<QuarterlyReport> {
  // Get transactions for quarter
  const quarterDates = getQuarterDates(year);
  const quarterInfo = quarterDates.find((q) => q.quarter === quarter);

  if (!quarterInfo) {
    throw new Error('Invalid quarter');
  }

  const whereConditions = [
    eq(salesTaxTransactions.userId, userId),
    eq(salesTaxTransactions.taxYear, year),
    eq(salesTaxTransactions.quarter, quarter),
  ];

  if (accountId) {
    whereConditions.push(eq(salesTaxTransactions.accountId, accountId));
  }

  const transactions = await db
    .select()
    .from(salesTaxTransactions)
    .where(and(...whereConditions));

  // Calculate totals
  let totalSales = new Decimal(0);
  let totalTax = new Decimal(0);

  transactions.forEach((txn) => {
    totalSales = totalSales.plus(new Decimal(txn.saleAmount));
    totalTax = totalTax.plus(new Decimal(txn.taxAmount));
  });

  // Get filing record
  const filingRecord = await db
    .select()
    .from(quarterlyFilingRecords)
    .where(
      and(
        eq(quarterlyFilingRecords.userId, userId),
        eq(quarterlyFilingRecords.taxYear, year),
        eq(quarterlyFilingRecords.quarter, quarter)
      )
    )
    .limit(1)
    .then((results) => results[0]);

  const taxRate = totalSales.gt(0)
    ? totalTax.dividedBy(totalSales).toNumber()
    : 0;

  return {
    year,
    quarter,
    totalSales: totalSales.toNumber(),
    totalTax: totalTax.toNumber(),
    taxRate,
    dueDate: quarterInfo.dueDate,
    submittedDate: filingRecord?.submittedDate,
    status: filingRecord?.status || 'pending',
    balanceDue: filingRecord?.balanceDue || totalTax.toNumber(),
  };
}

/**
 * Get all quarterly reports for a year
 * @param userId User ID
 * @param year Tax year
 * @param accountId Optional - filter by specific business account
 */
export async function getYearlyQuarterlyReports(
  userId: string,
  year: number,
  accountId?: string
): Promise<QuarterlyReport[]> {
  const quarters = [1, 2, 3, 4];
  const reports: QuarterlyReport[] = [];

  for (const quarter of quarters) {
    const report = await getQuarterlyReport(userId, year, quarter, accountId);
    reports.push(report);
  }

  return reports;
}

/**
 * Get quarterly reports grouped by business account
 * Returns reports for all business accounts for a given year
 */
export async function getQuarterlyReportsByAccount(
  userId: string,
  year: number,
  quarter: number
): Promise<
  Array<{
    accountId: string;
    accountName: string;
    report: QuarterlyReport;
  }>
> {
  // Import accounts table
  const { accounts } = await import('@/lib/db/schema');

  // Get all business accounts for user
  const businessAccounts = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.isBusinessAccount, true),
        eq(accounts.isActive, true)
      )
    );

  // Get reports for each account
  const reportsByAccount = await Promise.all(
    businessAccounts.map(async (account) => ({
      accountId: account.id,
      accountName: account.name,
      report: await getQuarterlyReport(userId, year, quarter, account.id),
    }))
  );

  return reportsByAccount.filter((r) => r.report.totalSales > 0);
}

/**
 * Get all quarterly reports for the year, grouped by business account
 */
export async function getYearlyQuarterlyReportsByAccount(
  userId: string,
  year: number
): Promise<
  Array<{
    accountId: string;
    accountName: string;
    quarters: QuarterlyReport[];
  }>
> {
  // Import accounts table
  const { accounts } = await import('@/lib/db/schema');

  // Get all business accounts for user
  const businessAccounts = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.isBusinessAccount, true),
        eq(accounts.isActive, true)
      )
    );

  // Get reports for each account
  const reportsByAccount = await Promise.all(
    businessAccounts.map(async (account) => ({
      accountId: account.id,
      accountName: account.name,
      quarters: await getYearlyQuarterlyReports(userId, year, account.id),
    }))
  );

  // Filter out accounts with no sales
  return reportsByAccount.filter((a) =>
    a.quarters.some((q) => q.totalSales > 0)
  );
}

/**
 * Calculate year-to-date sales tax
 */
export async function getYearToDateTax(
  userId: string,
  year: number
): Promise<{
  totalSales: number;
  totalTax: number;
  quarter: number;
}> {
  const now = new Date();
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);

  let totalSales = new Decimal(0);
  let totalTax = new Decimal(0);

  for (let q = 1; q <= currentQuarter; q++) {
    const report = await getQuarterlyReport(userId, year, q);
    totalSales = totalSales.plus(new Decimal(report.totalSales));
    totalTax = totalTax.plus(new Decimal(report.totalTax));
  }

  return {
    totalSales: totalSales.toNumber(),
    totalTax: totalTax.toNumber(),
    quarter: currentQuarter,
  };
}

/**
 * Get upcoming filing deadlines
 */
export function getUpcomingDeadlines(days: number = 90): Array<{
  quarter: number;
  year: number;
  dueDate: string;
  daysUntil: number;
}> {
  const now = new Date();
  const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const deadlines: Array<{
    quarter: number;
    year: number;
    dueDate: string;
    daysUntil: number;
  }> = [];

  // Check current year and next year
  for (let year = now.getFullYear(); year <= now.getFullYear() + 1; year++) {
    const quarters = getQuarterDates(year);

    quarters.forEach((q) => {
      const dueDate = new Date(q.dueDate + 'T23:59:59');

      if (dueDate >= now && dueDate <= futureDate) {
        const daysUntil = Math.ceil(
          (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        deadlines.push({
          quarter: q.quarter,
          year,
          dueDate: q.dueDate,
          daysUntil,
        });
      }
    });
  }

  // Sort by due date
  deadlines.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  return deadlines;
}

/**
 * Get filing status color
 */
export function getStatusColor(
  status: 'not_due' | 'pending' | 'submitted' | 'accepted' | 'rejected'
): string {
  switch (status) {
    case 'accepted':
      return '#10b981'; // emerald
    case 'submitted':
      return '#3b82f6'; // blue
    case 'pending':
      return '#fbbf24'; // amber
    case 'rejected':
      return '#f87171'; // red
    case 'not_due':
      return '#6b7280'; // gray
    default:
      return '#6b7280';
  }
}

/**
 * Format tax rate for display
 */
export function formatTaxRate(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Get current fiscal quarter
 */
export function getCurrentFiscalQuarter(): number {
  const now = new Date();
  return Math.ceil((now.getMonth() + 1) / 3);
}

/**
 * Get current fiscal year
 */
export function getCurrentFiscalYear(): number {
  return new Date().getFullYear();
}

/**
 * Check if filing is overdue
 */
export function isFilingOverdue(dueDate: string): boolean {
  const today = new Date();
  const due = new Date(dueDate);
  return today > due;
}

/**
 * Calculate days until due
 */
export function daysUntilDue(dueDate: string): number {
  const today = new Date();
  const due = new Date(dueDate + 'T23:59:59');
  const diffTime = due.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get sales tax rate by state/jurisdiction (simplified)
 */
export const STATE_TAX_RATES: Record<string, number> = {
  'Alabama': 0.04,
  'Alaska': 0,
  'Arizona': 0.055,
  'Arkansas': 0.065,
  'California': 0.0725,
  'Colorado': 0.029,
  'Connecticut': 0.0635,
  'Delaware': 0,
  'Florida': 0.06,
  'Georgia': 0.04,
  'Hawaii': 0.04,
  'Idaho': 0.06,
  'Illinois': 0.0625,
  'Indiana': 0.07,
  'Iowa': 0.06,
  'Kansas': 0.054,
  'Kentucky': 0.06,
  'Louisiana': 0.04,
  'Maine': 0.055,
  'Maryland': 0.06,
  'Massachusetts': 0.0625,
  'Michigan': 0.06,
  'Minnesota': 0.06875,
  'Mississippi': 0.07,
  'Missouri': 0.04225,
  'Montana': 0,
  'Nebraska': 0.055,
  'Nevada': 0.0685,
  'New Hampshire': 0,
  'New Jersey': 0.0625,
  'New Mexico': 0.0525,
  'New York': 0.04,
  'North Carolina': 0.03,
  'North Dakota': 0.05,
  'Ohio': 0.0575,
  'Oklahoma': 0.045,
  'Oregon': 0,
  'Pennsylvania': 0.06,
  'Rhode Island': 0.07,
  'South Carolina': 0.05,
  'South Dakota': 0.045,
  'Tennessee': 0.055,
  'Texas': 0.0625,
  'Utah': 0.0595,
  'Vermont': 0.06,
  'Virginia': 0.0525,
  'Washington': 0.065,
  'West Virginia': 0.06,
  'Wisconsin': 0.05,
  'Wyoming': 0.04,
};
