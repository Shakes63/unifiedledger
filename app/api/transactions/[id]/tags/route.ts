import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { transactions, transactionTags, tags } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    const { id } = await params;

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify transaction belongs to user
    const transaction = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.id, id),
          eq(transactions.userId, userId)
        )
      )
      .limit(1);

    if (transaction.length === 0) {
      return Response.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Get tags for this transaction
    const txTags = await db
      .select({
        id: tags.id,
        userId: tags.userId,
        name: tags.name,
        color: tags.color,
        description: tags.description,
        icon: tags.icon,
        usageCount: tags.usageCount,
        lastUsedAt: tags.lastUsedAt,
        sortOrder: tags.sortOrder,
        createdAt: tags.createdAt,
        updatedAt: tags.updatedAt,
      })
      .from(tags)
      .innerJoin(transactionTags, eq(transactionTags.tagId, tags.id))
      .where(
        and(
          eq(transactionTags.transactionId, id),
          eq(tags.userId, userId)
        )
      );

    return Response.json(txTags);
  } catch (error) {
    console.error('Error fetching transaction tags:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
