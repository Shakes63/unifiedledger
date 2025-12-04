import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { budgetCategories } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
export const dynamic = 'force-dynamic';

// Default categories to create for new users
// Note: Category types are simplified to income, expense, savings
// Bills and debts are handled by their respective modules
const DEFAULT_CATEGORIES = [
  // Income categories (with sensible frequency defaults)
  { name: 'Salary', type: 'income', incomeFrequency: 'monthly' },
  { name: 'Bonus', type: 'income', incomeFrequency: 'variable' },
  { name: 'Investment', type: 'income', incomeFrequency: 'variable' },
  { name: 'Other Income', type: 'income', incomeFrequency: 'variable' },

  // Expense categories
  { name: 'Groceries', type: 'expense' },
  { name: 'Gas', type: 'expense' },
  { name: 'Dining Out', type: 'expense' },
  { name: 'Entertainment', type: 'expense' },
  { name: 'Shopping', type: 'expense' },
  { name: 'Utilities', type: 'expense' },
  { name: 'Healthcare', type: 'expense' },
  { name: 'Rent/Mortgage', type: 'expense' },
  { name: 'Insurance', type: 'expense' },
  { name: 'Transportation', type: 'expense' },
  { name: 'Subscriptions', type: 'expense' },
  { name: 'Personal Care', type: 'expense' },
  { name: 'Other Expenses', type: 'expense' },

  // Savings
  { name: 'Emergency Fund', type: 'savings' },
  { name: 'Vacation Fund', type: 'savings' },
  { name: 'Retirement', type: 'savings' },
];

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    // Get and validate household
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);

    // TypeScript: householdId is guaranteed to be non-null after requireHouseholdAuth
    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    const userCategories = await db
      .select()
      .from(budgetCategories)
      .where(
        and(
          eq(budgetCategories.userId, userId),
          eq(budgetCategories.householdId, householdId)
        )
      )
      .orderBy(desc(budgetCategories.usageCount), budgetCategories.sortOrder);

    return Response.json(userCategories);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Category fetch error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();

    // Get and validate household
    const householdId = getHouseholdIdFromRequest(request, body);
    await requireHouseholdAuth(userId, householdId);

    // TypeScript: householdId is guaranteed to be non-null after requireHouseholdAuth
    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    const { name, type, monthlyBudget = 0, dueDate, isTaxDeductible = false, isBusinessCategory = false, incomeFrequency } = body;

    if (!name || !type) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate income frequency if provided
    if (incomeFrequency) {
      const validFrequencies = ['weekly', 'biweekly', 'monthly', 'variable'];
      if (!validFrequencies.includes(incomeFrequency)) {
        return Response.json(
          { error: 'Invalid income frequency. Must be weekly, biweekly, monthly, or variable' },
          { status: 400 }
        );
      }
    }

    // Check if category with same name exists in household
    const existing = await db
      .select()
      .from(budgetCategories)
      .where(
        and(
          eq(budgetCategories.userId, userId),
          eq(budgetCategories.householdId, householdId),
          eq(budgetCategories.name, name)
        )
      )
      .limit(1);

    if (existing && existing.length > 0) {
      return Response.json(
        { error: 'Category with this name already exists in household' },
        { status: 400 }
      );
    }

    const categoryId = nanoid();

    const categoryData = {
      id: categoryId,
      userId,
      householdId,
      name,
      type,
      monthlyBudget,
      dueDate: dueDate || null,
      isTaxDeductible,
      isBusinessCategory,
      incomeFrequency: type === 'income' && incomeFrequency ? incomeFrequency : 'variable',
      createdAt: new Date().toISOString(),
      usageCount: 0,
      sortOrder: 0,
    };

    await db.insert(budgetCategories).values(categoryData);

    // Return full category object for client-side use
    return Response.json(categoryData, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Category creation error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Initialize default categories for new users
export async function PUT(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();

    // Get and validate household
    const householdId = getHouseholdIdFromRequest(request, body);
    await requireHouseholdAuth(userId, householdId);

    // TypeScript: householdId is guaranteed to be non-null after requireHouseholdAuth
    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    // Check if user already has categories in this household
    const existingCategories = await db
      .select()
      .from(budgetCategories)
      .where(
        and(
          eq(budgetCategories.userId, userId),
          eq(budgetCategories.householdId, householdId)
        )
      )
      .limit(1);

    if (existingCategories.length > 0) {
      return Response.json(
        { message: 'Categories already initialized for this household' },
        { status: 200 }
      );
    }

    // Create default categories for the user in this household
    const categoriesToInsert = DEFAULT_CATEGORIES.map((cat, index) => ({
      id: nanoid(),
      userId,
      householdId,
      name: cat.name,
      type: cat.type as any,
      monthlyBudget: 0,
      dueDate: (cat as any).dueDate || null,
      incomeFrequency: (cat as any).incomeFrequency || 'variable',
      sortOrder: index,
      createdAt: new Date().toISOString(),
    }));

    await db.insert(budgetCategories).values(categoriesToInsert);

    return Response.json(
      { message: 'Default categories created successfully', count: categoriesToInsert.length },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Category initialization error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
