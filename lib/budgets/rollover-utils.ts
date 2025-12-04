import { db } from '@/lib/db';
import { budgetCategories, transactions, budgetRolloverHistory, householdSettings } from '@/lib/db/schema';
import { eq, and, gte, lte, sum } from 'drizzle-orm';
import Decimal from 'decimal.js';
import { nanoid } from 'nanoid';

/**
 * Calculate actual spending for a category in a given month
 */
export async function getCategorySpending(
  categoryId: string,
  householdId: string,
  monthStart: string,
  monthEnd: string,
  categoryType: string
): Promise<number> {
  const transactionType = categoryType === 'income' ? 'income' : 'expense';
  
  const result = await db
    .select({ total: sum(transactions.amount) })
    .from(transactions)
    .where(
      and(
        eq(transactions.categoryId, categoryId),
        eq(transactions.householdId, householdId),
        eq(transactions.type, transactionType),
        gte(transactions.date, monthStart),
        lte(transactions.date, monthEnd)
      )
    );

  return result[0]?.total
    ? new Decimal(result[0].total.toString()).toNumber()
    : 0;
}

/**
 * Calculate rollover for a single category
 */
export function calculateRollover(params: {
  monthlyBudget: number;
  actualSpent: number;
  previousBalance: number;
  rolloverLimit: number | null;
  allowNegativeRollover: boolean;
  categoryType: string;
}): {
  rolloverAmount: number;
  newBalance: number;
  wasCapped: boolean;
} {
  const { monthlyBudget, actualSpent, previousBalance, rolloverLimit, allowNegativeRollover, categoryType } = params;

  // Calculate unused budget
  // For expenses: positive if under budget, negative if over budget
  // For income: we don't rollover income categories (doesn't make sense)
  if (categoryType === 'income') {
    return {
      rolloverAmount: 0,
      newBalance: previousBalance,
      wasCapped: false,
    };
  }

  const unusedBudget = new Decimal(monthlyBudget).minus(actualSpent).toNumber();

  let rolloverAmount = unusedBudget;
  let wasCapped = false;

  // If overspent and negative rollover is not allowed, don't subtract
  if (rolloverAmount < 0 && !allowNegativeRollover) {
    rolloverAmount = 0;
  }

  // Calculate new balance
  let newBalance = new Decimal(previousBalance).plus(rolloverAmount).toNumber();

  // Enforce rollover limit if set
  if (rolloverLimit !== null && newBalance > rolloverLimit) {
    newBalance = rolloverLimit;
    wasCapped = true;
  }

  // Balance can go negative if negative rollover is allowed
  if (newBalance < 0 && !allowNegativeRollover) {
    newBalance = 0;
  }

  return {
    rolloverAmount,
    newBalance,
    wasCapped,
  };
}

/**
 * Get household settings for rollover calculation
 */
export async function getHouseholdRolloverSettings(householdId: string): Promise<{
  allowNegativeRollover: boolean;
}> {
  const settings = await db
    .select({
      allowNegativeRollover: householdSettings.allowNegativeRollover,
    })
    .from(householdSettings)
    .where(eq(householdSettings.householdId, householdId))
    .limit(1);

  return {
    allowNegativeRollover: settings[0]?.allowNegativeRollover ?? false,
  };
}

/**
 * Process rollover for all categories in a household for a given month
 */
export async function processMonthlyRollover(
  householdId: string,
  month: string // YYYY-MM format
): Promise<{
  processed: number;
  skipped: number;
  errors: string[];
  details: Array<{
    categoryId: string;
    categoryName: string;
    previousBalance: number;
    monthlyBudget: number;
    actualSpent: number;
    rolloverAmount: number;
    newBalance: number;
    wasCapped: boolean;
  }>;
}> {
  const errors: string[] = [];
  const details: Array<{
    categoryId: string;
    categoryName: string;
    previousBalance: number;
    monthlyBudget: number;
    actualSpent: number;
    rolloverAmount: number;
    newBalance: number;
    wasCapped: boolean;
  }> = [];

  // Get household settings
  const { allowNegativeRollover } = await getHouseholdRolloverSettings(householdId);

  // Calculate date range for the month
  const [year, monthNum] = month.split('-').map(Number);
  const monthStart = `${year}-${String(monthNum).padStart(2, '0')}-01`;
  const lastDay = new Date(year, monthNum, 0).getDate();
  const monthEnd = `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  // Get all categories with rollover enabled in this household
  const categories = await db
    .select()
    .from(budgetCategories)
    .where(
      and(
        eq(budgetCategories.householdId, householdId),
        eq(budgetCategories.rolloverEnabled, true),
        eq(budgetCategories.isActive, true)
      )
    );

  let processed = 0;
  let skipped = 0;

  for (const category of categories) {
    try {
      // Check if rollover already processed for this month
      const existing = await db
        .select()
        .from(budgetRolloverHistory)
        .where(
          and(
            eq(budgetRolloverHistory.categoryId, category.id),
            eq(budgetRolloverHistory.month, month)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      // Get actual spending for this category
      const actualSpent = await getCategorySpending(
        category.id,
        householdId,
        monthStart,
        monthEnd,
        category.type
      );

      // Calculate rollover
      const { rolloverAmount, newBalance, wasCapped } = calculateRollover({
        monthlyBudget: category.monthlyBudget || 0,
        actualSpent,
        previousBalance: category.rolloverBalance || 0,
        rolloverLimit: category.rolloverLimit,
        allowNegativeRollover,
        categoryType: category.type,
      });

      // Update category rollover balance
      await db
        .update(budgetCategories)
        .set({ rolloverBalance: newBalance })
        .where(eq(budgetCategories.id, category.id));

      // Record in history
      await db.insert(budgetRolloverHistory).values({
        id: nanoid(),
        categoryId: category.id,
        householdId,
        month,
        previousBalance: category.rolloverBalance || 0,
        monthlyBudget: category.monthlyBudget || 0,
        actualSpent,
        rolloverAmount,
        newBalance,
        rolloverLimit: category.rolloverLimit,
        wasCapped,
        createdAt: new Date().toISOString(),
      });

      details.push({
        categoryId: category.id,
        categoryName: category.name,
        previousBalance: category.rolloverBalance || 0,
        monthlyBudget: category.monthlyBudget || 0,
        actualSpent,
        rolloverAmount,
        newBalance,
        wasCapped,
      });

      processed++;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`Failed to process category ${category.name}: ${errorMessage}`);
    }
  }

  return {
    processed,
    skipped,
    errors,
    details,
  };
}

/**
 * Get rollover summary for a household
 */
export async function getRolloverSummary(
  householdId: string,
  month?: string // Optional: get status for specific month
): Promise<{
  categories: Array<{
    id: string;
    name: string;
    type: string;
    rolloverEnabled: boolean;
    rolloverBalance: number;
    rolloverLimit: number | null;
    monthlyBudget: number;
    effectiveBudget: number;
  }>;
  totalRolloverBalance: number;
  categoriesWithRollover: number;
  allowNegativeRollover: boolean;
}> {
  // Get household settings
  const { allowNegativeRollover } = await getHouseholdRolloverSettings(householdId);

  // Get all active categories in household
  const categories = await db
    .select()
    .from(budgetCategories)
    .where(
      and(
        eq(budgetCategories.householdId, householdId),
        eq(budgetCategories.isActive, true)
      )
    );

  let totalRolloverBalance = 0;
  let categoriesWithRollover = 0;

  const categoryData = categories.map((cat) => {
    const rolloverBalance = cat.rolloverBalance || 0;
    const monthlyBudget = cat.monthlyBudget || 0;
    
    // Only positive rollover adds to effective budget for expense categories
    // For income categories, rollover doesn't make sense
    const effectiveBudget = cat.type === 'expense' && cat.rolloverEnabled
      ? new Decimal(monthlyBudget).plus(Math.max(0, rolloverBalance)).toNumber()
      : monthlyBudget;

    if (cat.rolloverEnabled) {
      totalRolloverBalance = new Decimal(totalRolloverBalance).plus(rolloverBalance).toNumber();
      categoriesWithRollover++;
    }

    return {
      id: cat.id,
      name: cat.name,
      type: cat.type,
      rolloverEnabled: cat.rolloverEnabled || false,
      rolloverBalance,
      rolloverLimit: cat.rolloverLimit,
      monthlyBudget,
      effectiveBudget,
    };
  });

  return {
    categories: categoryData,
    totalRolloverBalance,
    categoriesWithRollover,
    allowNegativeRollover,
  };
}

/**
 * Get rollover history for a category
 */
export async function getCategoryRolloverHistory(
  categoryId: string,
  householdId: string,
  limit: number = 12
): Promise<Array<{
  month: string;
  previousBalance: number;
  monthlyBudget: number;
  actualSpent: number;
  rolloverAmount: number;
  newBalance: number;
  wasCapped: boolean;
  createdAt: string;
}>> {
  const history = await db
    .select()
    .from(budgetRolloverHistory)
    .where(
      and(
        eq(budgetRolloverHistory.categoryId, categoryId),
        eq(budgetRolloverHistory.householdId, householdId)
      )
    )
    .orderBy(budgetRolloverHistory.month)
    .limit(limit);

  return history.map((h) => ({
    month: h.month,
    previousBalance: h.previousBalance,
    monthlyBudget: h.monthlyBudget,
    actualSpent: h.actualSpent,
    rolloverAmount: h.rolloverAmount,
    newBalance: h.newBalance,
    wasCapped: h.wasCapped || false,
    createdAt: h.createdAt || '',
  }));
}

/**
 * Reset rollover balance for a category
 */
export async function resetCategoryRollover(
  categoryId: string,
  householdId: string
): Promise<void> {
  // Verify category belongs to household
  const category = await db
    .select()
    .from(budgetCategories)
    .where(
      and(
        eq(budgetCategories.id, categoryId),
        eq(budgetCategories.householdId, householdId)
      )
    )
    .limit(1);

  if (category.length === 0) {
    throw new Error('Category not found');
  }

  // Reset the balance
  await db
    .update(budgetCategories)
    .set({ rolloverBalance: 0 })
    .where(eq(budgetCategories.id, categoryId));

  // Record the reset in history
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  await db.insert(budgetRolloverHistory).values({
    id: nanoid(),
    categoryId,
    householdId,
    month: `${currentMonth}-RESET`,
    previousBalance: category[0].rolloverBalance || 0,
    monthlyBudget: category[0].monthlyBudget || 0,
    actualSpent: 0,
    rolloverAmount: -(category[0].rolloverBalance || 0),
    newBalance: 0,
    rolloverLimit: category[0].rolloverLimit,
    wasCapped: false,
    createdAt: now.toISOString(),
  });
}

/**
 * Update rollover settings for a category
 */
export async function updateCategoryRolloverSettings(
  categoryId: string,
  householdId: string,
  settings: {
    rolloverEnabled?: boolean;
    rolloverLimit?: number | null;
    rolloverBalance?: number;
  }
): Promise<void> {
  // Verify category belongs to household
  const category = await db
    .select()
    .from(budgetCategories)
    .where(
      and(
        eq(budgetCategories.id, categoryId),
        eq(budgetCategories.householdId, householdId)
      )
    )
    .limit(1);

  if (category.length === 0) {
    throw new Error('Category not found');
  }

  const updateData: Record<string, unknown> = {};

  if (settings.rolloverEnabled !== undefined) {
    updateData.rolloverEnabled = settings.rolloverEnabled;
  }

  if (settings.rolloverLimit !== undefined) {
    updateData.rolloverLimit = settings.rolloverLimit;
  }

  if (settings.rolloverBalance !== undefined) {
    updateData.rolloverBalance = settings.rolloverBalance;
  }

  if (Object.keys(updateData).length > 0) {
    await db
      .update(budgetCategories)
      .set(updateData)
      .where(eq(budgetCategories.id, categoryId));
  }
}

