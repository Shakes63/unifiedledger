import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { merchants, usageAnalytics, budgetCategories } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
export const dynamic = 'force-dynamic';

interface Suggestion {
  type: 'merchant' | 'category' | 'amount';
  value: string;
  label: string;
  frequency: number;
  averageAmount?: number;
}

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    const url = new URL(request.url);
    const query = url.searchParams.get('q');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    if (!query || query.length < 2) {
      return Response.json([]);
    }

    const normalizedQuery = query.toLowerCase();

    // Get frequently used merchants
    const frequentMerchants = await db
      .select()
      .from(merchants)
      .where(eq(merchants.userId, userId))
      .orderBy(desc(merchants.usageCount))
      .limit(limit);

    const merchantSuggestions: Suggestion[] = frequentMerchants
      .filter((m) => m.normalizedName.includes(normalizedQuery))
      .map((m) => ({
        type: 'merchant' as const,
        value: m.name,
        label: m.name,
        frequency: m.usageCount || 0,
        averageAmount: m.averageTransaction || undefined,
      }));

    // Get frequently used categories
    const frequentCategories = await db
      .select()
      .from(budgetCategories)
      .where(eq(budgetCategories.userId, userId))
      .orderBy(desc(budgetCategories.usageCount))
      .limit(limit);

    const categorySuggestions: Suggestion[] = frequentCategories
      .filter((c) => c.name.toLowerCase().includes(normalizedQuery))
      .map((c) => ({
        type: 'category' as const,
        value: c.id,
        label: c.name,
        frequency: c.usageCount || 0,
      }));

    // Get common amounts for this merchant/category
    // Note: Usage data fetched for future enhanced suggestions
    const _usageData = await db
      .select()
      .from(usageAnalytics)
      .where(eq(usageAnalytics.userId, userId))
      .limit(limit);

    // Combine and sort suggestions
    const allSuggestions = [...merchantSuggestions, ...categorySuggestions].sort(
      (a, b) => b.frequency - a.frequency
    );

    return Response.json(allSuggestions.slice(0, limit));
  } catch (error) {
    console.error('Suggestion fetch error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
