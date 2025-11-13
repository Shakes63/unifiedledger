import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { budgetCategories } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
export const dynamic = 'force-dynamic';

// Default categories to create for new users
const DEFAULT_CATEGORIES = [
  // Income categories (with sensible frequency defaults)
  { name: 'Salary', type: 'income', incomeFrequency: 'monthly' },
  { name: 'Bonus', type: 'income', incomeFrequency: 'variable' },
  { name: 'Investment', type: 'income', incomeFrequency: 'variable' },
  { name: 'Other Income', type: 'income', incomeFrequency: 'variable' },

  // Variable expenses
  { name: 'Groceries', type: 'variable_expense' },
  { name: 'Gas', type: 'variable_expense' },
  { name: 'Dining Out', type: 'variable_expense' },
  { name: 'Entertainment', type: 'variable_expense' },
  { name: 'Shopping', type: 'variable_expense' },
  { name: 'Utilities', type: 'variable_expense' },
  { name: 'Healthcare', type: 'variable_expense' },
  { name: 'Other Expenses', type: 'variable_expense' },

  // Monthly bills
  { name: 'Rent/Mortgage', type: 'monthly_bill', dueDate: 1 },
  { name: 'Electric Bill', type: 'monthly_bill', dueDate: 15 },
  { name: 'Water Bill', type: 'monthly_bill', dueDate: 15 },
  { name: 'Internet', type: 'monthly_bill', dueDate: 1 },
  { name: 'Phone Bill', type: 'monthly_bill', dueDate: 1 },
  { name: 'Insurance', type: 'monthly_bill', dueDate: 1 },

  // Savings
  { name: 'Emergency Fund', type: 'savings' },
  { name: 'Vacation Fund', type: 'savings' },

  // Debt
  { name: 'Credit Card Payment', type: 'debt' },
  { name: 'Loan Payment', type: 'debt' },
];

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    const userCategories = await db
      .select()
      .from(budgetCategories)
      .where(eq(budgetCategories.userId, userId))
      .orderBy(desc(budgetCategories.usageCount), budgetCategories.sortOrder);

    return Response.json(userCategories);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
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
    const { name, type, monthlyBudget = 0, dueDate, isTaxDeductible = false, incomeFrequency } = body;

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

    const categoryId = nanoid();

    await db.insert(budgetCategories).values({
      id: categoryId,
      userId,
      name,
      type,
      monthlyBudget,
      dueDate: dueDate || null,
      isTaxDeductible,
      incomeFrequency: type === 'income' && incomeFrequency ? incomeFrequency : 'variable',
      createdAt: new Date().toISOString(),
    });

    return Response.json(
      { id: categoryId, message: 'Category created successfully' },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Check if user already has categories
    const existingCategories = await db
      .select()
      .from(budgetCategories)
      .where(eq(budgetCategories.userId, userId))
      .limit(1);

    if (existingCategories.length > 0) {
      return Response.json(
        { message: 'Categories already initialized' },
        { status: 200 }
      );
    }

    // Create default categories for the user
    const categoriesToInsert = DEFAULT_CATEGORIES.map((cat, index) => ({
      id: nanoid(),
      userId,
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
    console.error('Category initialization error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
