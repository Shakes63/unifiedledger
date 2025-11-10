/**
 * Sales Tax Transaction Utilities
 *
 * Centralized logic for calculating and managing sales tax on transactions
 */

import Decimal from 'decimal.js';
import { db } from '@/lib/db';
import { salesTaxTransactions, salesTaxCategories } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Calculate sales tax for a transaction
 * @param amount - Transaction amount (before tax)
 * @param taxRate - Tax rate as decimal (e.g., 0.0825 for 8.25%)
 * @returns Object with sale amount, tax amount, and total
 */
export function calculateSalesTax(amount: Decimal, taxRate: number): {
  saleAmount: Decimal;
  taxAmount: Decimal;
  totalAmount: Decimal;
} {
  const saleAmount = amount;
  const taxAmount = amount.times(taxRate);
  const totalAmount = amount.plus(taxAmount);

  return {
    saleAmount,
    taxAmount,
    totalAmount,
  };
}

/**
 * Get quarter and tax year from a date string
 * @param dateString - Date in YYYY-MM-DD format
 * @returns Object with quarter (1-4) and tax year
 */
export function getQuarterAndYear(dateString: string): {
  quarter: number;
  taxYear: number;
} {
  const date = new Date(dateString);
  const month = date.getMonth(); // 0-11
  const year = date.getFullYear();

  // Calculate quarter: Q1 (Jan-Mar), Q2 (Apr-Jun), Q3 (Jul-Sep), Q4 (Oct-Dec)
  const quarter = Math.floor(month / 3) + 1;

  return {
    quarter,
    taxYear: year,
  };
}

/**
 * Create a sales tax record for a transaction
 * @param params - Transaction details
 * @returns Created sales tax record ID
 */
export async function createSalesTaxRecord(params: {
  transactionId: string;
  userId: string;
  accountId: string;
  taxCategoryId: string;
  amount: number;
  date: string;
}): Promise<string> {
  try {
    // Fetch tax category to get rate
    const taxCategoryResult = await db
      .select()
      .from(salesTaxCategories)
      .where(
        and(
          eq(salesTaxCategories.id, params.taxCategoryId),
          eq(salesTaxCategories.userId, params.userId),
          eq(salesTaxCategories.isActive, true)
        )
      )
      .limit(1);

    const taxCategory = taxCategoryResult[0];

    if (!taxCategory) {
      throw new Error(`Tax category ${params.taxCategoryId} not found or inactive`);
    }

    // Calculate tax amounts using Decimal.js for precision
    const amountDecimal = new Decimal(params.amount);
    const { saleAmount, taxAmount } = calculateSalesTax(amountDecimal, taxCategory.rate);

    // Get quarter and year
    const { quarter, taxYear } = getQuarterAndYear(params.date);

    // Create sales tax record
    const id = crypto.randomUUID();
    await db.insert(salesTaxTransactions).values({
      id,
      userId: params.userId,
      accountId: params.accountId,
      transactionId: params.transactionId,
      taxCategoryId: params.taxCategoryId,
      saleAmount: saleAmount.toNumber(),
      taxRate: taxCategory.rate,
      taxAmount: taxAmount.toNumber(),
      quarter,
      taxYear,
      reportedStatus: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    console.log(`Sales tax record created: ${id} for transaction ${params.transactionId}`);
    return id;
  } catch (error) {
    console.error('Failed to create sales tax record:', error);
    throw error;
  }
}

/**
 * Get sales tax record for a transaction
 * @param transactionId - Transaction ID
 * @returns Sales tax record or null if not found
 */
export async function getSalesTaxForTransaction(transactionId: string): Promise<{
  id: string;
  taxCategoryId: string;
  taxCategoryName: string;
  saleAmount: number;
  taxRate: number;
  taxAmount: number;
  quarter: number;
  taxYear: number;
  reportedStatus: string | null;
} | null> {
  try {
    const recordResult = await db
      .select()
      .from(salesTaxTransactions)
      .where(eq(salesTaxTransactions.transactionId, transactionId))
      .limit(1);

    const record = recordResult[0];

    if (!record) {
      return null;
    }

    // Fetch tax category name separately
    const taxCategoryResult = await db
      .select({
        name: salesTaxCategories.name,
      })
      .from(salesTaxCategories)
      .where(eq(salesTaxCategories.id, record.taxCategoryId))
      .limit(1);

    const taxCategory = taxCategoryResult[0];

    return {
      id: record.id,
      taxCategoryId: record.taxCategoryId,
      taxCategoryName: taxCategory?.name || 'Unknown',
      saleAmount: record.saleAmount,
      taxRate: record.taxRate,
      taxAmount: record.taxAmount,
      quarter: record.quarter,
      taxYear: record.taxYear,
      reportedStatus: record.reportedStatus,
    };
  } catch (error) {
    console.error('Failed to get sales tax for transaction:', error);
    return null;
  }
}

/**
 * Delete sales tax record for a transaction
 * @param transactionId - Transaction ID
 */
export async function deleteSalesTaxRecord(transactionId: string): Promise<void> {
  try {
    await db
      .delete(salesTaxTransactions)
      .where(eq(salesTaxTransactions.transactionId, transactionId));

    console.log(`Sales tax record deleted for transaction: ${transactionId}`);
  } catch (error) {
    console.error('Failed to delete sales tax record:', error);
    // Non-fatal: don't throw, just log
  }
}

/**
 * Update sales tax record for a transaction
 * @param transactionId - Transaction ID
 * @param amount - New transaction amount
 * @param taxCategoryId - Optional new tax category ID
 */
export async function updateSalesTaxRecord(
  transactionId: string,
  amount: number,
  taxCategoryId?: string
): Promise<void> {
  try {
    // Get existing record
    const existingRecordResult = await db
      .select()
      .from(salesTaxTransactions)
      .where(eq(salesTaxTransactions.transactionId, transactionId))
      .limit(1);

    const existingRecord = existingRecordResult[0];

    if (!existingRecord) {
      console.warn(`No sales tax record found for transaction: ${transactionId}`);
      return;
    }

    // Determine which tax category to use
    const categoryId = taxCategoryId || existingRecord.taxCategoryId;

    // Fetch tax category
    const taxCategoryResult = await db
      .select()
      .from(salesTaxCategories)
      .where(eq(salesTaxCategories.id, categoryId))
      .limit(1);

    const taxCategory = taxCategoryResult[0];

    if (!taxCategory) {
      throw new Error(`Tax category ${categoryId} not found`);
    }

    // Recalculate tax amounts
    const amountDecimal = new Decimal(amount);
    const { saleAmount, taxAmount } = calculateSalesTax(amountDecimal, taxCategory.rate);

    // Update record
    await db
      .update(salesTaxTransactions)
      .set({
        taxCategoryId: categoryId,
        saleAmount: saleAmount.toNumber(),
        taxRate: taxCategory.rate,
        taxAmount: taxAmount.toNumber(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(salesTaxTransactions.id, existingRecord.id));

    console.log(`Sales tax record updated for transaction: ${transactionId}`);
  } catch (error) {
    console.error('Failed to update sales tax record:', error);
    throw error;
  }
}

/**
 * Check if a transaction has sales tax
 * @param transactionId - Transaction ID
 * @returns true if transaction has sales tax record
 */
export async function hasSalesTax(transactionId: string): Promise<boolean> {
  try {
    const recordResult = await db
      .select({ id: salesTaxTransactions.id })
      .from(salesTaxTransactions)
      .where(eq(salesTaxTransactions.transactionId, transactionId))
      .limit(1);

    return recordResult.length > 0;
  } catch (error) {
    console.error('Failed to check sales tax:', error);
    return false;
  }
}

/**
 * Get sales tax summary for a list of transactions
 * @param transactionIds - Array of transaction IDs
 * @returns Summary object with total sales and tax
 */
export async function getSalesTaxSummary(transactionIds: string[]): Promise<{
  totalSales: number;
  totalTax: number;
  count: number;
}> {
  if (transactionIds.length === 0) {
    return { totalSales: 0, totalTax: 0, count: 0 };
  }

  try {
    // For simplicity, fetch all records and filter in memory
    // For production with many IDs, consider using SQL IN clause
    const allRecords = await db
      .select()
      .from(salesTaxTransactions);

    const records = allRecords.filter(record => transactionIds.includes(record.transactionId));

    const totalSales = records.reduce((sum, record) => sum + record.saleAmount, 0);
    const totalTax = records.reduce((sum, record) => sum + record.taxAmount, 0);

    return {
      totalSales,
      totalTax,
      count: records.length,
    };
  } catch (error) {
    console.error('Failed to get sales tax summary:', error);
    return { totalSales: 0, totalTax: 0, count: 0 };
  }
}
