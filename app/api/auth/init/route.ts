import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { accounts, budgetCategories } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const DEFAULT_ACCOUNTS = [
  {
    name: 'Checking Account',
    type: 'checking',
    icon: 'wallet',
    color: '#3b82f6',
  },
  {
    name: 'Savings Account',
    type: 'savings',
    icon: 'piggy-bank',
    color: '#10b981',
  },
];

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

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user already has accounts
    const existingAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .limit(1);

    if (existingAccounts.length > 0) {
      return Response.json(
        { message: 'User already initialized' },
        { status: 200 }
      );
    }

    // Create default accounts
    const accountsToInsert = DEFAULT_ACCOUNTS.map((acc, index) => ({
      id: nanoid(),
      userId,
      name: acc.name,
      type: acc.type as any,
      icon: acc.icon,
      color: acc.color,
      sortOrder: index,
      currentBalance: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    await db.insert(accounts).values(accountsToInsert);

    // Create default categories
    const categoriesToInsert = DEFAULT_CATEGORIES.map((cat, index) => ({
      id: nanoid(),
      userId,
      name: cat.name,
      type: cat.type as any,
      dueDate: (cat as any).dueDate || null,
      sortOrder: index,
      createdAt: new Date().toISOString(),
    }));

    await db.insert(budgetCategories).values(categoriesToInsert);

    return Response.json(
      {
        message: 'User initialized successfully',
        accounts: accountsToInsert.length,
        categories: categoriesToInsert.length,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Initialization error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
