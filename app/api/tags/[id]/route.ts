import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { tags, transactionTags } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// GET - Get a specific tag
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const tag = await db
      .select()
      .from(tags)
      .where(
        and(
          eq(tags.id, params.id),
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

    return Response.json(tag[0]);
  } catch (error) {
    console.error('Error fetching tag:', error);
    return Response.json(
      { error: 'Failed to fetch tag' },
      { status: 500 }
    );
  }
}

// PUT - Update a tag
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, color, description, icon } = body;

    // Verify tag exists and belongs to user
    const tag = await db
      .select()
      .from(tags)
      .where(
        and(
          eq(tags.id, params.id),
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

    // If name is changing, check for duplicates
    if (name && name !== tag[0].name) {
      const existing = await db
        .select()
        .from(tags)
        .where(
          and(
            eq(tags.userId, userId),
            eq(tags.name, name.trim())
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return Response.json(
          { error: 'Tag with this name already exists' },
          { status: 409 }
        );
      }
    }

    // Update tag
    const now = new Date().toISOString();
    await db
      .update(tags)
      .set({
        name: name ? name.trim() : tag[0].name,
        color: color || tag[0].color,
        description: description ?? tag[0].description,
        icon: icon ?? tag[0].icon,
        updatedAt: now,
      })
      .where(eq(tags.id, params.id));

    const updated = await db
      .select()
      .from(tags)
      .where(eq(tags.id, params.id))
      .limit(1);

    return Response.json(updated[0]);
  } catch (error) {
    console.error('Error updating tag:', error);
    return Response.json(
      { error: 'Failed to update tag' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a tag
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify tag exists and belongs to user
    const tag = await db
      .select()
      .from(tags)
      .where(
        and(
          eq(tags.id, params.id),
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

    // Delete all transaction associations first
    await db
      .delete(transactionTags)
      .where(eq(transactionTags.tagId, params.id));

    // Then delete the tag
    await db.delete(tags).where(eq(tags.id, params.id));

    return Response.json(
      { message: 'Tag deleted' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting tag:', error);
    return Response.json(
      { error: 'Failed to delete tag' },
      { status: 500 }
    );
  }
}
