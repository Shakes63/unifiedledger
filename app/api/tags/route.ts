import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { tags } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

// GET - List all tags for user with usage info
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const sortBy = url.searchParams.get('sortBy') || 'name'; // 'name', 'usage', 'recent'

    let orderByClause;
    if (sortBy === 'usage') {
      orderByClause = desc(tags.usageCount);
    } else if (sortBy === 'recent') {
      orderByClause = desc(tags.lastUsedAt);
    } else {
      orderByClause = tags.name;
    }

    const userTags = await db
      .select()
      .from(tags)
      .where(eq(tags.userId, userId))
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select()
      .from(tags)
      .where(eq(tags.userId, userId));

    return Response.json({
      data: userTags,
      total: countResult.length,
      limit,
      offset,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching tags:', error);
    return Response.json(
      { error: 'Failed to fetch tags' },
      { status: 500 }
    );
  }
}

// POST - Create a new tag
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const { name, color = '#6366f1', description, icon } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return Response.json(
        { error: 'Tag name is required' },
        { status: 400 }
      );
    }

    // Check if tag name already exists for this user
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

    const tagId = nanoid();

    const newTag = await db.insert(tags).values({
      id: tagId,
      userId,
      name: name.trim(),
      color: color || '#6366f1',
      description,
      icon,
      usageCount: 0,
    });

    const created = await db
      .select()
      .from(tags)
      .where(eq(tags.id, tagId))
      .limit(1);

    return Response.json(created[0], { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error creating tag:', error);
    return Response.json(
      { error: 'Failed to create tag' },
      { status: 500 }
    );
  }
}
