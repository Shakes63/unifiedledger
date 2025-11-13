import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { savedSearchFilters } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

interface SavedSearchInput {
  name: string;
  description?: string;
  filters: Record<string, any>;
  isDefault?: boolean;
}

// GET all saved searches for user
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    const url = new URL(request.url);
    const sortBy = url.searchParams.get('sortBy') || 'updatedAt'; // updatedAt, usageCount, name
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = db
      .select()
      .from(savedSearchFilters)
      .where(eq(savedSearchFilters.userId, userId));

    // Apply sorting
    if (sortBy === 'usageCount') {
      query = query.orderBy(savedSearchFilters.usageCount) as any;
    } else if (sortBy === 'name') {
      query = query.orderBy(savedSearchFilters.name) as any;
    } else {
      query = query.orderBy(savedSearchFilters.updatedAt) as any;
    }

    const searches = await query.limit(limit).offset(offset);

    // Get total count
    const countResult = await db
      .select()
      .from(savedSearchFilters)
      .where(eq(savedSearchFilters.userId, userId));

    return Response.json({
      searches: searches.map(s => ({
        ...s,
        filters: JSON.parse(s.filters),
      })),
      pagination: {
        limit,
        offset,
        total: countResult.length,
        hasMore: offset + limit < countResult.length,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching saved searches:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST create new saved search
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body: SavedSearchInput = await request.json();
    const { name, description, filters, isDefault } = body;

    if (!name || !filters) {
      return Response.json(
        { error: 'Missing required fields: name and filters' },
        { status: 400 }
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

    const searchId = nanoid();
    const now = new Date().toISOString();

    await db.insert(savedSearchFilters).values({
      id: searchId,
      userId,
      name,
      description: description || null,
      filters: JSON.stringify(filters),
      isDefault: isDefault || false,
      usageCount: 0,
      lastUsedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    return Response.json(
      {
        id: searchId,
        message: 'Saved search created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error creating saved search:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
