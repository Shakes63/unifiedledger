import { db } from '@/lib/db';
import { transactions, transactionSplits, budgetCategories } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';
import { validateSplitConfiguration } from '@/lib/transactions/split-calculator';

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
    // 1. Validate input using consolidated validation
    const validationError = validateSplitConfiguration(
      splits.map((s) => ({
        amount: s.amount,
        percentage: s.percentage,
        isPercentage: s.isPercentage,
        categoryId: s.categoryId,
      })),
      {
        requireCategory: true,
        requirePositiveValues: true,
      }
    );

    if (validationError) {
      return { success: false, createdSplits: [], error: validationError };
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
        // Calculate amount from percentage, rounded to 2 decimal places
        amount = totalAmount
          .times(split.percentage)
          .dividedBy(100)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          .toNumber();
      } else if (split.amount !== undefined) {
        // Use fixed amount, rounded to 2 decimal places
        amount = new Decimal(split.amount)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          .toNumber();
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

// Legacy validation functions removed - now using consolidated validation
// from @/lib/transactions/split-calculator (validateSplitConfiguration)
