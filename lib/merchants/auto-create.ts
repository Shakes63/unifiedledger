import { db } from '@/lib/db';
import { merchants, budgetCategories } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * Category types for auto-created fee categories
 */
export type FeeCategoryType = 'bank_fees' | 'interest_fees';

/**
 * Category names for each fee type
 */
const FEE_CATEGORY_NAMES: Record<FeeCategoryType, string> = {
  bank_fees: 'Bank Fees',
  interest_fees: 'Interest Fees',
};

/**
 * Normalize merchant name for comparison (lowercase, trim, collapse whitespace)
 */
function normalizeMerchantName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Get or create a fee category for the household.
 * Creates "Bank Fees" or "Interest Fees" category if it doesn't exist.
 *
 * @param userId - The user ID
 * @param householdId - The household ID
 * @param type - The type of fee category ('bank_fees' or 'interest_fees')
 * @returns The category ID
 */
export async function getOrCreateFeeCategory(
  userId: string,
  householdId: string,
  type: FeeCategoryType
): Promise<string> {
  const categoryName = FEE_CATEGORY_NAMES[type];
  const normalizedName = categoryName.toLowerCase();

  // Check if category already exists in household
  const existing = await db
    .select()
    .from(budgetCategories)
    .where(
      and(
        eq(budgetCategories.userId, userId),
        eq(budgetCategories.householdId, householdId),
        eq(budgetCategories.name, categoryName)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  // Create the category
  const categoryId = nanoid();
  const now = new Date().toISOString();

  await db.insert(budgetCategories).values({
    id: categoryId,
    userId,
    householdId,
    name: categoryName,
    type: 'expense',
    isActive: true,
    isSystemCategory: true, // Mark as system-created category
    createdAt: now,
  });

  return categoryId;
}

/**
 * Create a merchant for a bank/creditor if it doesn't already exist.
 * No default category is assigned - users choose the category per transaction.
 *
 * @param userId - The user ID
 * @param householdId - The household ID
 * @param bankName - The name of the bank or creditor
 * @returns The merchant ID if created, or null if merchant already existed
 */
export async function createMerchantForBank(
  userId: string,
  householdId: string,
  bankName: string
): Promise<string | null> {
  const normalizedName = normalizeMerchantName(bankName);

  // Check if merchant already exists in household
  const existing = await db
    .select()
    .from(merchants)
    .where(
      and(
        eq(merchants.userId, userId),
        eq(merchants.householdId, householdId),
        eq(merchants.normalizedName, normalizedName)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Merchant already exists, don't create duplicate
    return null;
  }

  // Create the merchant (no default category)
  const merchantId = nanoid();
  const now = new Date().toISOString();

  await db.insert(merchants).values({
    id: merchantId,
    userId,
    householdId,
    name: bankName.trim(),
    normalizedName,
    categoryId: null,
    usageCount: 1,
    lastUsedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  return merchantId;
}

/**
 * Determine the fee category type based on account type.
 *
 * @param accountType - The type of account
 * @returns 'bank_fees' for checking/savings/investment/cash, 'interest_fees' for credit types
 */
export function getFeeCategoryTypeForAccount(
  accountType: string
): FeeCategoryType {
  switch (accountType) {
    case 'credit':
    case 'line_of_credit':
      return 'interest_fees';
    case 'checking':
    case 'savings':
    case 'investment':
    case 'cash':
    default:
      return 'bank_fees';
  }
}
