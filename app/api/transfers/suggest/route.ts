import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { usageAnalytics, accounts } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/transfers/suggest
 * Get suggested transfer pairs based on usage history
 * Most-used account pairs appear first for quick one-tap transfers
 * Query params: limit (default 10), fromAccountId (optional filter)
 */
export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const fromAccountId = searchParams.get('fromAccountId');

    // Get transfer pair usage analytics
    const filters = [
      eq(usageAnalytics.userId, userId),
      eq(usageAnalytics.itemType, 'transfer_pair'),
    ];

    if (fromAccountId) {
      filters.push(eq(usageAnalytics.itemId, fromAccountId));
    }

    const transferPairs = await db
      .select()
      .from(usageAnalytics)
      .where(and(...filters))
      .orderBy(desc(usageAnalytics.usageCount))
      .limit(limit);

    // Enrich with account names and validate accounts still exist
    const suggestions = await Promise.all(
      transferPairs.map(async (pair) => {
        if (!pair.itemSecondaryId) return null;

        const [fromAccount, toAccount] = await Promise.all([
          db
            .select()
            .from(accounts)
            .where(
              and(
                eq(accounts.id, pair.itemId),
                eq(accounts.userId, userId)
              )
            )
            .limit(1),
          db
            .select()
            .from(accounts)
            .where(
              and(
                eq(accounts.id, pair.itemSecondaryId),
                eq(accounts.userId, userId)
              )
            )
            .limit(1),
        ]);

        // Skip if either account was deleted
        if (fromAccount.length === 0 || toAccount.length === 0) {
          return null;
        }

        return {
          id: pair.id,
          fromAccountId: pair.itemId,
          toAccountId: pair.itemSecondaryId,
          fromAccountName: fromAccount[0].name,
          toAccountName: toAccount[0].name,
          fromAccountColor: fromAccount[0].color,
          toAccountColor: toAccount[0].color,
          usageCount: pair.usageCount,
          lastUsedAt: pair.lastUsedAt,
        };
      })
    );

    // Filter out null results (deleted accounts)
    const validSuggestions = suggestions.filter((s) => s !== null);

    return Response.json({
      suggestions: validSuggestions,
      count: validSuggestions.length,
    });
  } catch (error) {
    console.error('Error fetching transfer suggestions:', error);
    return Response.json(
      { error: 'Failed to fetch transfer suggestions' },
      { status: 500 }
    );
  }
}
