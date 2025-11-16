import { db } from '@/lib/db';
import { transactions, transactionSplits, budgetCategories } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';

/**
 * Split configuration for rule actions
 */
export interface SplitConfig {
  categoryId: string;
  amount?: number;
  percentage?: number;
  isPercentage: boolean;
  description?: string;
}

/**
 * Result of split creation operation
 */
export interface SplitCreationResult {
  success: boolean;
  createdSplits: string[];
  error?: string;
}

/**
 * Handle split creation AFTER transaction is created
 * This is called from the transaction creation API after a rule with create_split action matches
 *
 * @param userId - User ID for validation
 * @param transactionId - Transaction ID to create splits for
 * @param splits - Array of split configurations from rule action
 * @returns Result with created split IDs or error message
 */
export async function handleSplitCreation(
  userId: string,
  transactionId: string,
  splits: SplitConfig[]
): Promise<SplitCreationResult> {
  try {
    // 1. Validate input
    if (!splits || splits.length === 0) {
      return { success: false, createdSplits: [], error: 'No splits provided' };
    }

    // 2. Fetch transaction
    const txResult = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.id, transactionId),
          eq(transactions.userId, userId)
        )
      )
      .limit(1);

    if (txResult.length === 0) {
      return { success: false, createdSplits: [], error: 'Transaction not found' };
    }

    const transaction = txResult[0];
    const totalAmount = new Decimal(transaction.amount);

    // 3. Validate categories exist
    const categoryIds = splits.map((s) => s.categoryId);
    const categories = await db
      .select()
      .from(budgetCategories)
      .where(
        and(
          eq(budgetCategories.userId, userId),
          inArray(budgetCategories.id, categoryIds)
        )
      );

    if (categories.length !== categoryIds.length) {
      return { success: false, createdSplits: [], error: 'Some categories not found' };
    }

    // 4. Calculate split amounts
    const calculatedSplits = splits.map((split, index) => {
      let amount: number;

      if (split.isPercentage && split.percentage !== undefined) {
        // Calculate amount from percentage
        amount = totalAmount.times(split.percentage).dividedBy(100).toNumber();
      } else if (split.amount !== undefined) {
        // Use fixed amount
        amount = split.amount;
      } else {
        // Default to 0 if neither provided
        amount = 0;
      }

      return {
        id: nanoid(),
        userId: userId,
        householdId: transaction.householdId,
        transactionId: transactionId,
        categoryId: split.categoryId,
        amount: amount,
        percentage: split.isPercentage ? split.percentage : null,
        isPercentage: split.isPercentage,
        description: split.description || null,
        notes: null,
        sortOrder: index,
        createdAt: new Date().toISOString(),
      };
    });

    // 5. Validate total doesn't exceed transaction amount
    const splitTotal = calculatedSplits.reduce(
      (sum, s) => sum.plus(s.amount),
      new Decimal(0)
    );

    if (splitTotal.greaterThan(totalAmount)) {
      return {
        success: false,
        createdSplits: [],
        error: `Split total ($${splitTotal.toFixed(2)}) exceeds transaction amount ($${totalAmount.toFixed(2)})`,
      };
    }

    // 6. Insert splits
    await db.insert(transactionSplits).values(calculatedSplits);

    // 7. Mark transaction as split
    await db
      .update(transactions)
      .set({ isSplit: true })
      .where(eq(transactions.id, transactionId));

    return {
      success: true,
      createdSplits: calculatedSplits.map((s) => s.id),
    };
  } catch (error) {
    console.error('Error in handleSplitCreation:', error);
    return {
      success: false,
      createdSplits: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Calculate total amount from splits (for validation)
 * Handles both percentage-based and fixed amount splits
 *
 * @param splits - Array of split configurations
 * @param transactionAmount - Total transaction amount
 * @returns Total amount of all splits
 */
export function calculateSplitTotal(
  splits: SplitConfig[],
  transactionAmount: number
): Decimal {
  const totalAmountDecimal = new Decimal(transactionAmount);

  return splits.reduce((sum, split) => {
    if (split.isPercentage && split.percentage !== undefined) {
      const amount = totalAmountDecimal.times(split.percentage).dividedBy(100);
      return sum.plus(amount);
    } else if (split.amount !== undefined) {
      return sum.plus(split.amount);
    }
    return sum;
  }, new Decimal(0));
}

/**
 * Calculate total percentage from splits (for validation)
 * Only counts percentage-based splits
 *
 * @param splits - Array of split configurations
 * @returns Total percentage (0-100+)
 */
export function calculateTotalPercentage(splits: SplitConfig[]): number {
  return splits
    .filter((s) => s.isPercentage && s.percentage !== undefined)
    .reduce((sum, s) => sum + (s.percentage || 0), 0);
}

/**
 * Validate split configuration
 * Checks for common errors before attempting to create splits
 *
 * @param splits - Array of split configurations
 * @param transactionAmount - Optional transaction amount for total validation
 * @returns Error message if invalid, null if valid
 */
export function validateSplitConfig(
  splits: SplitConfig[],
  transactionAmount?: number
): string | null {
  // Must have at least one split
  if (!splits || splits.length === 0) {
    return 'At least one split is required';
  }

  // Validate each split
  for (let i = 0; i < splits.length; i++) {
    const split = splits[i];

    if (!split.categoryId) {
      return `Split #${i + 1}: Category is required`;
    }

    if (split.isPercentage) {
      if (split.percentage === undefined || split.percentage <= 0 || split.percentage > 100) {
        return `Split #${i + 1}: Percentage must be between 1 and 100`;
      }
    } else {
      if (split.amount === undefined || split.amount <= 0) {
        return `Split #${i + 1}: Amount must be greater than 0`;
      }
    }
  }

  // Validate total percentage doesn't exceed 100%
  const totalPercentage = calculateTotalPercentage(splits);
  if (totalPercentage > 100) {
    return `Total percentage (${totalPercentage}%) exceeds 100%`;
  }

  // Validate total amount doesn't exceed transaction amount (if provided)
  if (transactionAmount !== undefined) {
    const splitTotal = calculateSplitTotal(splits, transactionAmount);
    const transactionAmountDecimal = new Decimal(transactionAmount);

    if (splitTotal.greaterThan(transactionAmountDecimal)) {
      return `Split total ($${splitTotal.toFixed(2)}) exceeds transaction amount ($${transactionAmountDecimal.toFixed(2)})`;
    }
  }

  return null; // Valid
}
