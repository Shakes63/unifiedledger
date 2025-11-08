import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { savedSearchFilters } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

interface UpdateSearchInput {
  name?: string;
  description?: string;
  filters?: Record<string, any>;
  isDefault?: boolean;
}

// GET single saved search
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const search = await db
      .select()
      .from(savedSearchFilters)
      .where(
        and(
          eq(savedSearchFilters.id, id),
          eq(savedSearchFilters.userId, userId)
        )
      )
      .limit(1);

    if (search.length === 0) {
      return Response.json(
        { error: 'Saved search not found' },
        { status: 404 }
      );
    }

    return Response.json({
      ...search[0],
      filters: JSON.parse(search[0].filters),
    });
  } catch (error) {
    console.error('Error fetching saved search:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT update saved search
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: UpdateSearchInput = await request.json();
    const { name, description, filters, isDefault } = body;

    // Verify search belongs to user
    const existing = await db
      .select()
      .from(savedSearchFilters)
      .where(
        and(
          eq(savedSearchFilters.id, id),
          eq(savedSearchFilters.userId, userId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return Response.json(
        { error: 'Saved search not found' },
        { status: 404 }
      );
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await db
        .update(savedSearchFilters)
        .set({ isDefault: false })
        .where(
          and(
            eq(savedSearchFilters.userId, userId),
            eq(savedSearchFilters.isDefault, true)
          )
        );
    }

    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (filters !== undefined) updateData.filters = JSON.stringify(filters);
    if (isDefault !== undefined) updateData.isDefault = isDefault;

    await db
      .update(savedSearchFilters)
      .set(updateData)
      .where(eq(savedSearchFilters.id, id));

    return Response.json({ message: 'Saved search updated successfully' });
  } catch (error) {
    console.error('Error updating saved search:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE saved search
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify search belongs to user before deleting
    const existing = await db
      .select()
      .from(savedSearchFilters)
      .where(
        and(
          eq(savedSearchFilters.id, id),
          eq(savedSearchFilters.userId, userId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return Response.json(
        { error: 'Saved search not found' },
        { status: 404 }
      );
    }

    await db
      .delete(savedSearchFilters)
      .where(eq(savedSearchFilters.id, id));

    return Response.json({ message: 'Saved search deleted successfully' });
  } catch (error) {
    console.error('Error deleting saved search:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST use saved search (increment usage count)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const existing = await db
      .select()
      .from(savedSearchFilters)
      .where(
        and(
          eq(savedSearchFilters.id, id),
          eq(savedSearchFilters.userId, userId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return Response.json(
        { error: 'Saved search not found' },
        { status: 404 }
      );
    }

    const search = existing[0];
    const newUsageCount = (search.usageCount || 0) + 1;

    await db
      .update(savedSearchFilters)
      .set({
        usageCount: newUsageCount,
        lastUsedAt: new Date().toISOString(),
      })
      .where(eq(savedSearchFilters.id, id));

    const updated = await db
      .select()
      .from(savedSearchFilters)
      .where(eq(savedSearchFilters.id, id))
      .limit(1);

    return Response.json({
      ...updated[0],
      filters: JSON.parse(updated[0].filters),
    });
  } catch (error) {
    console.error('Error using saved search:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
