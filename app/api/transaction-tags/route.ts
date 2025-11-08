import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { transactionTags, tags, transactions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

// POST - Add a tag to a transaction
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
    const { transactionId, tagId } = body;

    if (!transactionId || !tagId) {
      return Response.json(
        { error: 'transactionId and tagId are required' },
        { status: 400 }
      );
    }

    // Verify transaction belongs to user
    const transaction = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.id, transactionId),
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

    // Verify tag belongs to user
    const tag = await db
      .select()
      .from(tags)
      .where(
        and(
          eq(tags.id, tagId),
          eq(tags.userId, userId)
        )
      )
      .limit(1);

    if (tag.length === 0) {
      return Response.json(
        { error: 'Tag not found' },
        { status: 404 }
      );
    }

    // Check if association already exists
    const existing = await db
      .select()
      .from(transactionTags)
      .where(
        and(
          eq(transactionTags.transactionId, transactionId),
          eq(transactionTags.tagId, tagId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return Response.json(
        { error: 'Tag already added to this transaction' },
        { status: 409 }
      );
    }

    const assocId = nanoid();
    const now = new Date().toISOString();

    // Create association
    await db.insert(transactionTags).values({
      id: assocId,
      userId,
      transactionId,
      tagId,
    });

    // Update tag usage
    const currentTag = tag[0];
    await db
      .update(tags)
      .set({
        usageCount: (currentTag.usageCount || 0) + 1,
        lastUsedAt: now,
        updatedAt: now,
      })
      .where(eq(tags.id, tagId));

    return Response.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Error adding tag to transaction:', error);
    return Response.json(
      { error: 'Failed to add tag' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a tag from a transaction
export async function DELETE(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { transactionId, tagId } = body;

    if (!transactionId || !tagId) {
      return Response.json(
        { error: 'transactionId and tagId are required' },
        { status: 400 }
      );
    }

    // Verify association exists and user owns it
    const association = await db
      .select()
      .from(transactionTags)
      .where(
        and(
          eq(transactionTags.transactionId, transactionId),
          eq(transactionTags.tagId, tagId),
          eq(transactionTags.userId, userId)
        )
      )
      .limit(1);

    if (association.length === 0) {
      return Response.json(
        { error: 'Tag association not found' },
        { status: 404 }
      );
    }

    // Delete association
    await db
      .delete(transactionTags)
      .where(
        and(
          eq(transactionTags.transactionId, transactionId),
          eq(transactionTags.tagId, tagId)
        )
      );

    // Update tag usage count
    const tag = await db
      .select()
      .from(tags)
      .where(eq(tags.id, tagId))
      .limit(1);

    if (tag.length > 0) {
      const now = new Date().toISOString();
      await db
        .update(tags)
        .set({
          usageCount: Math.max(0, (tag[0].usageCount || 0) - 1),
          updatedAt: now,
        })
        .where(eq(tags.id, tagId));
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error removing tag from transaction:', error);
    return Response.json(
      { error: 'Failed to remove tag' },
      { status: 500 }
    );
  }
}
