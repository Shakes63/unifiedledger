/**
 * Auto-Classification Utility
 * Automatically creates transactionTaxClassifications records
 * when transactions are marked as tax deductible and have a mapped category.
 */

import { db } from '@/lib/db';
import {
  budgetCategories,
  categoryTaxMappings,
  transactionTaxClassifications,
  taxCategories,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';

/**
 * Auto-classify a transaction for tax purposes.
 * If the transaction's category has a mapping to a tax category,
 * creates a transactionTaxClassifications record.
 *
 * @param userId - User ID
 * @param transactionId - Transaction ID
 * @param categoryId - Budget category ID (can be null)
 * @param amount - Transaction amount (positive value)
 * @param date - Transaction date (ISO string)
 * @param isTaxDeductible - Whether the transaction is tax deductible
 * @returns Object with classification info or null if no classification created
 */
export async function autoClassifyTransaction(
  userId: string,
  householdId: string,
  transactionId: string,
  categoryId: string | null,
  amount: number,
  date: string,
  isTaxDeductible: boolean
): Promise<{
  classificationId: string;
  taxCategoryId: string;
  taxCategoryName: string;
  allocatedAmount: number;
} | null> {
  // Skip if not tax deductible or no category
  if (!isTaxDeductible || !categoryId) {
    return null;
  }

  // Get tax year from transaction date
  const taxYear = new Date(date).getFullYear();

  // Look up mapping for this category and year
  const [mapping] = await db
    .select({ mapping: categoryTaxMappings })
    .from(categoryTaxMappings)
    .innerJoin(
      budgetCategories,
      eq(categoryTaxMappings.budgetCategoryId, budgetCategories.id)
    )
    .where(
      and(
        eq(categoryTaxMappings.userId, userId),
        eq(categoryTaxMappings.budgetCategoryId, categoryId),
        eq(categoryTaxMappings.taxYear, taxYear),
        eq(budgetCategories.householdId, householdId)
      )
    )
    .limit(1);

  if (!mapping) {
    // No mapping exists for this category
    return null;
  }

  // Get tax category info
  const [taxCat] = await db
    .select()
    .from(taxCategories)
    .where(eq(taxCategories.id, mapping.mapping.taxCategoryId))
    .limit(1);

  if (!taxCat || !taxCat.isActive) {
    // Tax category not found or inactive
    return null;
  }

  // Calculate allocated amount based on allocation percentage
  const allocationPct = mapping.mapping.allocationPercentage ?? 100;
  const allocatedAmount = new Decimal(amount).abs().times(allocationPct).dividedBy(100).toDecimalPlaces(2).toNumber();

  // Check if classification already exists
  const [existing] = await db
    .select()
    .from(transactionTaxClassifications)
    .where(
      and(
        eq(transactionTaxClassifications.transactionId, transactionId),
        eq(transactionTaxClassifications.taxCategoryId, mapping.mapping.taxCategoryId)
      )
    )
    .limit(1);

  if (existing) {
    // Update existing classification
    await db
      .update(transactionTaxClassifications)
      .set({
        allocatedAmount,
        percentage: allocationPct,
        taxYear,
        isDeductible: taxCat.deductible ?? true,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(transactionTaxClassifications.id, existing.id));

    return {
      classificationId: existing.id,
      taxCategoryId: mapping.mapping.taxCategoryId,
      taxCategoryName: taxCat.name,
      allocatedAmount,
    };
  }

  // Create new classification
  const classificationId = nanoid();
  await db.insert(transactionTaxClassifications).values({
    id: classificationId,
    userId,
    transactionId,
    taxCategoryId: mapping.mapping.taxCategoryId,
    taxYear,
    allocatedAmount,
    percentage: allocationPct,
    isDeductible: taxCat.deductible ?? true,
    notes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return {
    classificationId,
    taxCategoryId: mapping.mapping.taxCategoryId,
    taxCategoryName: taxCat.name,
    allocatedAmount,
  };
}

/**
 * Remove tax classification for a transaction.
 * Called when a transaction is marked as not tax deductible.
 *
 * @param transactionId - Transaction ID
 */
export async function removeTransactionClassifications(transactionId: string): Promise<void> {
  await db
    .delete(transactionTaxClassifications)
    .where(eq(transactionTaxClassifications.transactionId, transactionId));
}

/**
 * Reclassify a transaction after its category changes.
 * First removes existing classification, then creates new one if applicable.
 *
 * @param userId - User ID
 * @param transactionId - Transaction ID
 * @param newCategoryId - New budget category ID (can be null)
 * @param amount - Transaction amount
 * @param date - Transaction date
 * @param isTaxDeductible - Whether the transaction is tax deductible
 */
export async function reclassifyTransaction(
  userId: string,
  householdId: string,
  transactionId: string,
  newCategoryId: string | null,
  amount: number,
  date: string,
  isTaxDeductible: boolean
): Promise<{
  classificationId: string;
  taxCategoryId: string;
  taxCategoryName: string;
  allocatedAmount: number;
} | null> {
  // Remove any existing classifications
  await removeTransactionClassifications(transactionId);

  // Create new classification if applicable
  return autoClassifyTransaction(
    userId,
    householdId,
    transactionId,
    newCategoryId,
    amount,
    date,
    isTaxDeductible
  );
}

