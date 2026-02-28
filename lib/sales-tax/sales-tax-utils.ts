/**
 * Sales tax calculation and quarterly reporting utilities
 * Updated to use isSalesTaxable boolean flag on transactions
 */

import { db } from '@/lib/db';
import {
  salesTaxTransactions,
  quarterlyFilingRecords,
  salesTaxSettings,
} from '@/lib/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import Decimal from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';
import { fromMoneyCents } from '@/lib/utils/money-cents';

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
 * Full sales tax settings including multi-level rates
 */
export interface FullSalesTaxSettings extends SalesTaxSettings {
  stateRate: number;
  countyRate: number;
  cityRate: number;
  specialDistrictRate: number;
  stateName: string | null;
  countyName: string | null;
  cityName: string | null;
  specialDistrictName: string | null;
}

/**
 * Individual tax jurisdiction breakdown
 */
export interface TaxJurisdictionAmount {
  name: string;
  rate: number;
  amount: number;
}

/**
 * Complete tax breakdown by jurisdiction level
 */
export interface TaxRateBreakdown {
  state: TaxJurisdictionAmount;
  county: TaxJurisdictionAmount;
  city: TaxJurisdictionAmount;
  specialDistrict: TaxJurisdictionAmount;
  total: {
    rate: number;
    amount: number;
  };
}

/**
 * Quarterly report with tax breakdown
 */
export interface QuarterlyReportWithBreakdown extends QuarterlyReport {
  taxBreakdown: TaxRateBreakdown;
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
  const rate = new Decimal(taxRate).dividedBy(100); // Convert percentage to decimal
  return sale.times(rate).toNumber();
}

/**
 * Get user's sales tax rate from settings
 * Returns 0 if not configured
 */
export async function getUserSalesTaxRate(
  userId: string,
  householdId: string
): Promise<number> {
  const settings = await db
    .select()
    .from(salesTaxSettings)
    .where(
      and(
        eq(salesTaxSettings.userId, userId),
        eq(salesTaxSettings.householdId, householdId)
      )
    )
    .limit(1);

  if (settings.length === 0) {
    // Return 0% if not configured - user needs to set up their rate
    return 0;
  }

  return settings[0].defaultRate;
}

/**
 * Get user's full sales tax settings including multi-level rates
 * Returns null if not configured
 */
export async function getFullSalesTaxSettings(
  userId: string,
  householdId: string
): Promise<FullSalesTaxSettings | null> {
  const settings = await db
    .select()
    .from(salesTaxSettings)
    .where(
      and(
        eq(salesTaxSettings.userId, userId),
        eq(salesTaxSettings.householdId, householdId)
      )
    )
    .limit(1);

  if (settings.length === 0) {
    return null;
  }

  const s = settings[0];
  return {
    defaultRate: s.defaultRate,
    jurisdiction: s.jurisdiction || '',
    fiscalYearStart: s.fiscalYearStart || '01-01',
    filingFrequency: s.filingFrequency || 'quarterly',
    enableTracking: s.enableTracking ?? true,
    stateRate: s.stateRate || 0,
    countyRate: s.countyRate || 0,
    cityRate: s.cityRate || 0,
    specialDistrictRate: s.specialDistrictRate || 0,
    stateName: s.stateName || null,
    countyName: s.countyName || null,
    cityName: s.cityName || null,
    specialDistrictName: s.specialDistrictName || null,
  };
}

/**
 * Calculate tax breakdown by jurisdiction level
 * Uses Decimal.js for precise financial calculations
 */
export function calculateTaxBreakdown(
  saleAmount: number,
  settings: FullSalesTaxSettings
): TaxRateBreakdown {
  const sale = new Decimal(saleAmount);

  const stateAmount = sale.times(new Decimal(settings.stateRate).dividedBy(100));
  const countyAmount = sale.times(new Decimal(settings.countyRate).dividedBy(100));
  const cityAmount = sale.times(new Decimal(settings.cityRate).dividedBy(100));
  const specialAmount = sale.times(
    new Decimal(settings.specialDistrictRate).dividedBy(100)
  );
  const totalAmount = stateAmount.plus(countyAmount).plus(cityAmount).plus(specialAmount);
  const totalRate = new Decimal(settings.stateRate)
    .plus(settings.countyRate)
    .plus(settings.cityRate)
    .plus(settings.specialDistrictRate);

  return {
    state: {
      name: settings.stateName || 'State',
      rate: settings.stateRate,
      amount: stateAmount.toNumber(),
    },
    county: {
      name: settings.countyName || 'County',
      rate: settings.countyRate,
      amount: countyAmount.toNumber(),
    },
    city: {
      name: settings.cityName || 'City',
      rate: settings.cityRate,
      amount: cityAmount.toNumber(),
    },
    specialDistrict: {
      name: settings.specialDistrictName || 'Special District',
      rate: settings.specialDistrictRate,
      amount: specialAmount.toNumber(),
    },
    total: {
      rate: totalRate.toNumber(),
      amount: totalAmount.toNumber(),
    },
  };
}

/**
 * Get quarterly report with tax breakdown by jurisdiction
 * @param userId User ID
 * @param year Tax year
 * @param quarter Quarter (1-4)
 * @param accountId Optional - filter by specific business account
 */
export async function getQuarterlyReportWithBreakdown(
  userId: string,
  householdId: string,
  year: number,
  quarter: number,
  accountId?: string
): Promise<QuarterlyReportWithBreakdown> {
  // Get base report
  const report = await getQuarterlyReport(userId, householdId, year, quarter, accountId);

  // Get full settings for breakdown
  const settings = await getFullSalesTaxSettings(userId, householdId);

  const whereConditions = [
    eq(salesTaxTransactions.userId, userId),
    eq(salesTaxTransactions.householdId, householdId),
    eq(salesTaxTransactions.taxYear, year),
    eq(salesTaxTransactions.quarter, quarter),
  ];

  if (accountId) {
    whereConditions.push(eq(salesTaxTransactions.accountId, accountId));
  }

  const snapshots = await db
    .select({
      taxableAmountCents: salesTaxTransactions.taxableAmountCents,
      jurisdictionSnapshot: salesTaxTransactions.jurisdictionSnapshot,
    })
    .from(salesTaxTransactions)
    .where(and(...whereConditions));

  // Calculate breakdown
  const totals = {
    state: new Decimal(0),
    county: new Decimal(0),
    city: new Decimal(0),
    specialDistrict: new Decimal(0),
  };

  for (const snapshot of snapshots) {
    const taxable = fromMoneyCents(snapshot.taxableAmountCents) ?? 0;
    if (!snapshot.jurisdictionSnapshot || taxable <= 0) continue;

    try {
      const parsed = JSON.parse(snapshot.jurisdictionSnapshot) as {
        state?: { ratePercent?: number };
        county?: { ratePercent?: number };
        city?: { ratePercent?: number };
        specialDistrict?: { ratePercent?: number };
      };

      totals.state = totals.state.plus(
        new Decimal(taxable).times((parsed.state?.ratePercent ?? 0) / 100)
      );
      totals.county = totals.county.plus(
        new Decimal(taxable).times((parsed.county?.ratePercent ?? 0) / 100)
      );
      totals.city = totals.city.plus(
        new Decimal(taxable).times((parsed.city?.ratePercent ?? 0) / 100)
      );
      totals.specialDistrict = totals.specialDistrict.plus(
        new Decimal(taxable).times((parsed.specialDistrict?.ratePercent ?? 0) / 100)
      );
    } catch {
      // Ignore malformed snapshots and continue reporting with valid rows.
    }
  }

  const totalRate = settings
    ? new Decimal(settings.stateRate)
        .plus(settings.countyRate)
        .plus(settings.cityRate)
        .plus(settings.specialDistrictRate)
        .toNumber()
    : 0;
  const taxBreakdown = {
    state: {
      name: settings?.stateName || 'State',
      rate: settings?.stateRate || 0,
      amount: totals.state.toNumber(),
    },
    county: {
      name: settings?.countyName || 'County',
      rate: settings?.countyRate || 0,
      amount: totals.county.toNumber(),
    },
    city: {
      name: settings?.cityName || 'City',
      rate: settings?.cityRate || 0,
      amount: totals.city.toNumber(),
    },
    specialDistrict: {
      name: settings?.specialDistrictName || 'Special District',
      rate: settings?.specialDistrictRate || 0,
      amount: totals.specialDistrict.toNumber(),
    },
    total: {
      rate: totalRate,
      amount: report.totalTax,
    },
  };

  return {
    ...report,
    taxBreakdown,
  };
}

/**
 * Update user's sales tax rate
 */
export async function updateUserSalesTaxRate(
  userId: string,
  householdId: string,
  rate: number,
  jurisdiction?: string
): Promise<void> {
  const existing = await db
    .select()
    .from(salesTaxSettings)
    .where(
      and(
        eq(salesTaxSettings.userId, userId),
        eq(salesTaxSettings.householdId, householdId)
      )
    )
    .limit(1);

  if (existing.length === 0) {
    // Create new settings
    await db.insert(salesTaxSettings).values({
      id: uuidv4(),
      userId,
      householdId,
      defaultRate: rate,
      jurisdiction: jurisdiction || null,
      filingFrequency: 'quarterly',
      enableTracking: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } else {
    // Update existing
    await db
      .update(salesTaxSettings)
      .set({
        defaultRate: rate,
        jurisdiction: jurisdiction || existing[0].jurisdiction,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(salesTaxSettings.userId, userId),
          eq(salesTaxSettings.householdId, householdId)
        )
      );
  }
}

/**
 * Get quarterly report for a specific quarter
 * Uses isSalesTaxable boolean flag on transactions and applies configured tax rate
 * @param userId User ID
 * @param year Tax year
 * @param quarter Quarter (1-4)
 * @param accountId Optional - filter by specific business account
 */
export async function getQuarterlyReport(
  userId: string,
  householdId: string,
  year: number,
  quarter: number,
  accountId?: string
): Promise<QuarterlyReport> {
  // 1. Get quarter date range
  const quarterDates = getQuarterDates(year);
  const quarterInfo = quarterDates.find((q) => q.quarter === quarter);

  if (!quarterInfo) {
    throw new Error('Invalid quarter');
  }

  // 2. Query immutable sales tax snapshots for this quarter
  const whereConditions = [
    eq(salesTaxTransactions.userId, userId),
    eq(salesTaxTransactions.householdId, householdId),
    eq(salesTaxTransactions.taxYear, year),
    eq(salesTaxTransactions.quarter, quarter),
    gte(salesTaxTransactions.transactionDate, quarterInfo.startDate),
    lte(salesTaxTransactions.transactionDate, quarterInfo.endDate),
  ];

  if (accountId) {
    whereConditions.push(eq(salesTaxTransactions.accountId, accountId));
  }

  const snapshots = await db
    .select({
      taxableAmountCents: salesTaxTransactions.taxableAmountCents,
      taxAmountCents: salesTaxTransactions.taxAmountCents,
    })
    .from(salesTaxTransactions)
    .where(and(...whereConditions));

  // 3. Calculate totals directly from snapshots
  const totalSales = snapshots.reduce(
    (sum, row) => sum.plus(fromMoneyCents(row.taxableAmountCents) ?? 0),
    new Decimal(0)
  );
  const totalTax = snapshots.reduce(
    (sum, row) => sum.plus(fromMoneyCents(row.taxAmountCents) ?? 0),
    new Decimal(0)
  );
  const effectiveRateDecimal =
    totalSales.greaterThan(0) ? totalTax.dividedBy(totalSales) : new Decimal(0);

  // 4. Filing record is workflow/status only
  const filingRecord = await db
    .select()
    .from(quarterlyFilingRecords)
    .where(
      and(
        eq(quarterlyFilingRecords.userId, userId),
        eq(quarterlyFilingRecords.householdId, householdId),
        eq(quarterlyFilingRecords.taxYear, year),
        eq(quarterlyFilingRecords.quarter, quarter)
      )
    )
    .limit(1)
    .then((results) => results[0]);

  return {
    year,
    quarter,
    totalSales: totalSales.toNumber(),
    totalTax: totalTax.toNumber(),
    taxRate: effectiveRateDecimal.toNumber(), // Decimal for existing UI compatibility.
    dueDate: quarterInfo.dueDate,
    submittedDate: filingRecord?.submittedDate || undefined,
    status: filingRecord?.status || 'pending',
    balanceDue: totalTax.toNumber(),
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
  householdId: string,
  year: number,
  accountId?: string
): Promise<QuarterlyReport[]> {
  const quarters = [1, 2, 3, 4];
  const reports: QuarterlyReport[] = [];

  for (const quarter of quarters) {
    const report = await getQuarterlyReport(userId, householdId, year, quarter, accountId);
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
  householdId: string,
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
        eq(accounts.householdId, householdId),
        eq(accounts.isBusinessAccount, true),
        eq(accounts.isActive, true)
      )
    );

  // Get reports for each account
  const reportsByAccount = await Promise.all(
    businessAccounts.map(async (account) => ({
      accountId: account.id,
      accountName: account.name,
      report: await getQuarterlyReport(userId, householdId, year, quarter, account.id),
    }))
  );

  return reportsByAccount.filter((r) => r.report.totalSales > 0);
}

/**
 * Get all quarterly reports for the year, grouped by business account
 */
export async function getYearlyQuarterlyReportsByAccount(
  userId: string,
  householdId: string,
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
        eq(accounts.householdId, householdId),
        eq(accounts.isBusinessAccount, true),
        eq(accounts.isActive, true)
      )
    );

  // Get reports for each account
  const reportsByAccount = await Promise.all(
    businessAccounts.map(async (account) => ({
      accountId: account.id,
      accountName: account.name,
      quarters: await getYearlyQuarterlyReports(userId, householdId, year, account.id),
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
  householdId: string,
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
    const report = await getQuarterlyReport(userId, householdId, year, q);
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
 * Update or create quarterly filing record
 * @param userId User ID
 * @param year Tax year
 * @param quarter Quarter (1-4)
 * @param status Filing status
 * @param notes Optional notes
 */
export async function updateQuarterlyFilingStatus(
  userId: string,
  householdId: string,
  year: number,
  quarter: number,
  status: 'not_due' | 'pending' | 'submitted' | 'accepted' | 'rejected',
  notes?: string
): Promise<void> {
  const quarterDates = getQuarterDates(year);
  const quarterInfo = quarterDates.find((q) => q.quarter === quarter);

  if (!quarterInfo) {
    throw new Error('Invalid quarter');
  }

  // Check if record exists
  const existing = await db
    .select()
    .from(quarterlyFilingRecords)
    .where(
      and(
        eq(quarterlyFilingRecords.userId, userId),
        eq(quarterlyFilingRecords.householdId, householdId),
        eq(quarterlyFilingRecords.taxYear, year),
        eq(quarterlyFilingRecords.quarter, quarter)
      )
    )
    .limit(1);

  const submittedDate =
    status === 'submitted' || status === 'accepted'
      ? new Date().toISOString()
      : null;

  if (existing.length === 0) {
    // Create new record
    await db.insert(quarterlyFilingRecords).values({
      id: uuidv4(),
      userId,
      householdId,
      taxYear: year,
      quarter,
      dueDate: quarterInfo.dueDate,
      submittedDate,
      status,
      notes: notes || null,
    });
  } else {
    // Update existing record
    await db
      .update(quarterlyFilingRecords)
      .set({
        status,
        submittedDate: submittedDate || existing[0].submittedDate,
        notes: notes || existing[0].notes,
      })
      .where(eq(quarterlyFilingRecords.id, existing[0].id));
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
