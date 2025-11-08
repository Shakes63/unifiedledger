/**
 * Tax calculation and reporting utilities
 */

import { db } from '@/lib/db';
import {
  transactionTaxClassifications,
  categoryTaxMappings,
  taxCategories,
} from '@/lib/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import Decimal from 'decimal.js';

/**
 * Tax deduction summary by category
 */
export interface TaxDeductionSummary {
  categoryId: string;
  categoryName: string;
  formType: string;
  lineNumber?: string;
  totalAmount: number;
  transactionCount: number;
  isDeductible: boolean;
}

/**
 * Tax year summary
 */
export interface TaxYearSummary {
  year: number;
  totalIncome: number;
  totalDeductions: number;
  taxableIncome: number;
  byCategory: TaxDeductionSummary[];
}

/**
 * Get standard US tax categories (seeded data)
 */
export const STANDARD_TAX_CATEGORIES = [
  // Schedule C - Business Income/Expenses
  {
    name: 'Gross Receipts',
    formType: 'schedule_c',
    lineNumber: '1c',
    category: 'business_income',
    deductible: false,
  },
  {
    name: 'Cost of Goods Sold',
    formType: 'schedule_c',
    lineNumber: '4',
    category: 'business_expense',
    deductible: true,
  },
  {
    name: 'Car and Truck Expenses',
    formType: 'schedule_c',
    lineNumber: '9',
    category: 'business_expense',
    deductible: true,
  },
  {
    name: 'Depreciation',
    formType: 'schedule_c',
    lineNumber: '13',
    category: 'business_expense',
    deductible: true,
  },
  {
    name: 'Office Expense',
    formType: 'schedule_c',
    lineNumber: '18',
    category: 'business_expense',
    deductible: true,
  },

  // Schedule A - Itemized Deductions
  {
    name: 'Medical and Dental Expenses',
    formType: 'schedule_a',
    lineNumber: '1',
    category: 'personal_deduction',
    deductible: true,
  },
  {
    name: 'State and Local Taxes',
    formType: 'schedule_a',
    lineNumber: '5',
    category: 'personal_deduction',
    deductible: true,
  },
  {
    name: 'Mortgage Interest',
    formType: 'schedule_a',
    lineNumber: '8',
    category: 'personal_deduction',
    deductible: true,
  },
  {
    name: 'Charitable Contributions',
    formType: 'schedule_a',
    lineNumber: '11',
    category: 'personal_deduction',
    deductible: true,
  },

  // Schedule D - Capital Gains/Losses
  {
    name: 'Long-term Capital Gains',
    formType: 'schedule_d',
    lineNumber: '15',
    category: 'investment_income',
    deductible: false,
  },
  {
    name: 'Capital Losses',
    formType: 'schedule_d',
    lineNumber: '21',
    category: 'investment_expense',
    deductible: true,
  },

  // Form 1040
  {
    name: 'Interest Income',
    formType: 'form_1040',
    lineNumber: '2b',
    category: 'investment_income',
    deductible: false,
  },
  {
    name: 'Dividend Income',
    formType: 'form_1040',
    lineNumber: '5b',
    category: 'investment_income',
    deductible: false,
  },
];

/**
 * Get tax deductions for a user in a given tax year
 */
export async function getTaxDeductions(
  userId: string,
  taxYear: number
): Promise<TaxDeductionSummary[]> {
  const classifications = await db
    .select()
    .from(transactionTaxClassifications)
    .where(
      and(
        eq(transactionTaxClassifications.userId, userId),
        eq(transactionTaxClassifications.taxYear, taxYear)
      )
    );

  // Group by tax category
  const byCategory = new Map<string, TaxDeductionSummary>();

  for (const classification of classifications) {
    const category = await db
      .select()
      .from(taxCategories)
      .where(eq(taxCategories.id, classification.taxCategoryId))
      .limit(1)
      .then((results) => results[0]);

    if (!category) continue;

    const key = category.id;

    if (!byCategory.has(key)) {
      byCategory.set(key, {
        categoryId: category.id,
        categoryName: category.name,
        formType: category.formType,
        lineNumber: category.lineNumber,
        totalAmount: 0,
        transactionCount: 0,
        isDeductible: category.deductible,
      });
    }

    const summary = byCategory.get(key)!;
    summary.totalAmount += classification.allocatedAmount || 0;
    summary.transactionCount += 1;
  }

  return Array.from(byCategory.values()).sort(
    (a, b) => b.totalAmount - a.totalAmount
  );
}

/**
 * Calculate tax year summary
 */
export async function getTaxYearSummary(
  userId: string,
  taxYear: number
): Promise<TaxYearSummary> {
  const deductions = await getTaxDeductions(userId, taxYear);

  let totalIncome = new Decimal(0);
  let totalDeductions = new Decimal(0);

  deductions.forEach((ded) => {
    const amount = new Decimal(ded.totalAmount);

    if (ded.isDeductible) {
      totalDeductions = totalDeductions.plus(amount);
    } else {
      // Income categories
      if (ded.categoryName.includes('Income')) {
        totalIncome = totalIncome.plus(amount);
      }
    }
  });

  const taxableIncome = totalIncome.minus(totalDeductions).toNumber();

  return {
    year: taxYear,
    totalIncome: totalIncome.toNumber(),
    totalDeductions: totalDeductions.toNumber(),
    taxableIncome: Math.max(taxableIncome, 0),
    byCategory: deductions,
  };
}

/**
 * Get current tax year
 */
export function getCurrentTaxYear(): number {
  const now = new Date();
  // Tax year is same as calendar year for individual filers
  return now.getFullYear();
}

/**
 * Get tax year range (Jan 1 - Dec 31)
 */
export function getTaxYearRange(year: number): {
  startDate: string;
  endDate: string;
} {
  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  };
}

/**
 * Estimate quarterly estimated tax payment
 */
export function estimateQuarterlyTax(
  taxableIncome: number,
  estimatedTaxRate: number = 0.25
): number {
  // Simplified estimation: assume 25% effective tax rate, divide by 4 quarters
  const estimatedAnnualTax = taxableIncome * estimatedTaxRate;
  return Math.round(estimatedAnnualTax / 4 * 100) / 100;
}

/**
 * Format tax category for display
 */
export function formatTaxCategory(
  formType: string,
  lineNumber?: string
): string {
  if (lineNumber) {
    return `${formType.replace(/_/g, ' ').toUpperCase()} Line ${lineNumber}`;
  }
  return formType.replace(/_/g, ' ').toUpperCase();
}

/**
 * Calculate tax bracket (simplified 2024 brackets for single filers)
 */
export function getEstimatedTaxBracket(
  taxableIncome: number
): {
  bracket: string;
  rate: number;
  min: number;
  max: number;
} {
  // 2024 tax brackets (simplified)
  const brackets = [
    { bracket: '10%', rate: 0.1, min: 0, max: 11600 },
    { bracket: '12%', rate: 0.12, min: 11600, max: 47150 },
    { bracket: '22%', rate: 0.22, min: 47150, max: 100525 },
    { bracket: '24%', rate: 0.24, min: 100525, max: 191950 },
    { bracket: '32%', rate: 0.32, min: 191950, max: 243725 },
    { bracket: '35%', rate: 0.35, min: 243725, max: 609350 },
    { bracket: '37%', rate: 0.37, min: 609350, max: Infinity },
  ];

  const applicable = brackets.find(
    (b) => taxableIncome >= b.min && taxableIncome < b.max
  );

  return (
    applicable || {
      bracket: '37%',
      rate: 0.37,
      min: 609350,
      max: Infinity,
    }
  );
}
