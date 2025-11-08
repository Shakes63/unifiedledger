import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { merchants, transactions, budgetCategories } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
export const dynamic = 'force-dynamic';

interface CategorizationSuggestion {
  categoryId: string;
  categoryName: string;
  confidence: number; // percentage 0-100
  frequency: number; // how many times this category was used with this merchant
}

export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const description = url.searchParams.get('description');

    if (!description || description.length < 2) {
      return Response.json(null);
    }

    const normalizedDescription = description.toLowerCase().trim();

    // Find merchant by normalized name
    const merchant = await db
      .select()
      .from(merchants)
      .where(
        and(
          eq(merchants.userId, userId),
          eq(merchants.normalizedName, normalizedDescription)
        )
      )
      .limit(1);

    if (merchant.length === 0) {
      // New merchant - no history yet
      return Response.json(null);
    }

    // Get all transactions for this merchant
    const merchantTransactions = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.description, merchant[0].name)
        )
      );

    if (merchantTransactions.length === 0) {
      return Response.json(null);
    }

    // Count categories used with this merchant
    const categoryCounts: { [key: string]: number } = {};
    let totalWithCategory = 0;

    for (const txn of merchantTransactions) {
      if (txn.categoryId) {
        categoryCounts[txn.categoryId] = (categoryCounts[txn.categoryId] || 0) + 1;
        totalWithCategory++;
      }
    }

    if (totalWithCategory === 0) {
      // No categories used yet for this merchant
      return Response.json(null);
    }

    // Find the most common category
    let topCategoryId = '';
    let topCount = 0;

    for (const [categoryId, count] of Object.entries(categoryCounts)) {
      if (count > topCount) {
        topCategoryId = categoryId;
        topCount = count;
      }
    }

    // Get category details
    const category = await db
      .select()
      .from(budgetCategories)
      .where(eq(budgetCategories.id, topCategoryId))
      .limit(1);

    if (category.length === 0) {
      return Response.json(null);
    }

    const confidence = Math.round((topCount / totalWithCategory) * 100);

    const suggestion: CategorizationSuggestion = {
      categoryId: topCategoryId,
      categoryName: category[0].name,
      confidence,
      frequency: topCount,
    };

    return Response.json(suggestion);
  } catch (error) {
    console.error('Categorization suggestion error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
