/**
 * Sales Tax Action Handler
 *
 * Handles sales tax application via rules system
 */

import { db } from '@/lib/db';
import { salesTaxCategories } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { SalesTaxConfig } from './types';

/**
 * Validate sales tax configuration
 * Ensures config has a boolean value
 * @param config - Configuration object to validate (optional)
 * @returns Validated SalesTaxConfig
 */
export function validateSalesTaxConfig(config?: any): SalesTaxConfig {
  // Default to taxable (true) if no value specified
  return {
    value: typeof config?.value === 'boolean' ? config.value : true,
  };
}

/**
 * Validate that a tax category exists and belongs to the user
 * @param userId - User ID
 * @param taxCategoryId - Tax category ID to validate
 * @returns true if valid, false otherwise
 */
export async function validateTaxCategory(
  userId: string,
  taxCategoryId: string
): Promise<boolean> {
  try {
    const taxCategoryResult = await db
      .select()
      .from(salesTaxCategories)
      .where(
        and(
          eq(salesTaxCategories.id, taxCategoryId),
          eq(salesTaxCategories.userId, userId),
          eq(salesTaxCategories.isActive, true)
        )
      )
      .limit(1);

    return taxCategoryResult.length > 0;
  } catch (error) {
    console.error('Failed to validate tax category:', error);
    return false;
  }
}

/**
 * Get tax category details
 * @param taxCategoryId - Tax category ID
 * @returns Tax category details or null if not found
 */
export async function getTaxCategory(taxCategoryId: string): Promise<{
  id: string;
  name: string;
  rate: number;
} | null> {
  try {
    const taxCategoryResult = await db
      .select({
        id: salesTaxCategories.id,
        name: salesTaxCategories.name,
        rate: salesTaxCategories.rate,
      })
      .from(salesTaxCategories)
      .where(eq(salesTaxCategories.id, taxCategoryId))
      .limit(1);

    return taxCategoryResult[0] || null;
  } catch (error) {
    console.error('Failed to get tax category:', error);
    return null;
  }
}
