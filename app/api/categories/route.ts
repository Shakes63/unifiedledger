import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { budgetCategories } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
export const dynamic = 'force-dynamic';

// Default categories to create for new users
const DEFAULT_CATEGORIES = [
  // Income categories
  { name: 'Salary', type: 'income' },
  { name: 'Bonus', type: 'income' },
  { name: 'Investment', type: 'income' },
  { name: 'Other Income', type: 'income' },

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
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userCategories = await db
      .select()
      .from(budgetCategories)
      .where(eq(budgetCategories.userId, userId))
      .orderBy(desc(budgetCategories.usageCount), budgetCategories.sortOrder);

    return Response.json(userCategories);
  } catch (error) {
    console.error('Category fetch error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, type, monthlyBudget = 0, dueDate } = body;

    if (!name || !type) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const categoryId = nanoid();

    await db.insert(budgetCategories).values({
      id: categoryId,
      userId,
      name,
      type,
      monthlyBudget,
      dueDate: dueDate || null,
      createdAt: new Date().toISOString(),
    });

    return Response.json(
      { id: categoryId, message: 'Category created successfully' },
      { status: 201 }
    );
  } catch (error) {
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
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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
      sortOrder: index,
      createdAt: new Date().toISOString(),
    }));

    await db.insert(budgetCategories).values(categoriesToInsert);

    return Response.json(
      { message: 'Default categories created successfully', count: categoriesToInsert.length },
      { status: 201 }
    );
  } catch (error) {
    console.error('Category initialization error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
