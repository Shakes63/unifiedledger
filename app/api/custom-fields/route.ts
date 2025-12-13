import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { customFields } from '@/lib/db/schema';
import { eq, and, type SQL } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

type CustomFieldType = 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'checkbox' | 'url' | 'email';

// GET - List all custom fields for user
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const activeOnly = url.searchParams.get('activeOnly') === 'true';

    const conditions: SQL[] = [eq(customFields.userId, userId)];

    if (activeOnly) {
      conditions.push(eq(customFields.isActive, true));
    }

    const userFields = await db
      .select()
      .from(customFields)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(customFields.sortOrder, customFields.name)
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select()
      .from(customFields)
      .where(eq(customFields.userId, userId));

    return Response.json({
      data: userFields.map((field) => ({
        ...field,
        options: field.options ? JSON.parse(field.options) : null,
      })),
      total: countResult.length,
      limit,
      offset,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching custom fields:', error);
    return Response.json(
      { error: 'Failed to fetch custom fields' },
      { status: 500 }
    );
  }
}

// POST - Create a new custom field
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const {
      name,
      type,
      description,
      isRequired = false,
      options = null,
      defaultValue = null,
      placeholder = null,
      validationPattern = null,
    } = body;

    // Validate required fields
    if (!name || !type) {
      return Response.json(
        { error: 'Field name and type are required' },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes: CustomFieldType[] = [
      'text',
      'number',
      'date',
      'select',
      'multiselect',
      'checkbox',
      'url',
      'email',
    ];
    if (!validTypes.includes(type)) {
      return Response.json(
        { error: 'Invalid field type' },
        { status: 400 }
      );
    }

    // Check for duplicate name
    const existing = await db
      .select()
      .from(customFields)
      .where(
        and(
          eq(customFields.userId, userId),
          eq(customFields.name, name.trim())
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return Response.json(
        { error: 'Field with this name already exists' },
        { status: 409 }
      );
    }

    const fieldId = nanoid();

    await db.insert(customFields).values({
      id: fieldId,
      userId,
      name: name.trim(),
      type,
      description,
      isRequired,
      options: options ? JSON.stringify(options) : null,
      defaultValue,
      placeholder,
      validationPattern,
      isActive: true,
      usageCount: 0,
    });

    const created = await db
      .select()
      .from(customFields)
      .where(eq(customFields.id, fieldId))
      .limit(1);

    return Response.json(
      {
        ...created[0],
        options: created[0].options ? JSON.parse(created[0].options) : null,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error creating custom field:', error);
    return Response.json(
      { error: 'Failed to create custom field' },
      { status: 500 }
    );
  }
}
