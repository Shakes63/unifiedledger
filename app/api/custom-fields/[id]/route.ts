import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { customFields, customFieldValues } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// GET - Get a specific custom field
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const field = await db
      .select()
      .from(customFields)
      .where(
        and(
          eq(customFields.id, params.id),
          eq(customFields.userId, userId)
        )
      )
      .limit(1);

    if (field.length === 0) {
      return Response.json(
        { error: 'Field not found' },
        { status: 404 }
      );
    }

    return Response.json({
      ...field[0],
      options: field[0].options ? JSON.parse(field[0].options) : null,
    });
  } catch (error) {
    console.error('Error fetching custom field:', error);
    return Response.json(
      { error: 'Failed to fetch custom field' },
      { status: 500 }
    );
  }
}

// PUT - Update a custom field
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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
    const {
      name,
      description,
      isRequired,
      isActive,
      options,
      defaultValue,
      placeholder,
      validationPattern,
      sortOrder,
    } = body;

    // Verify field exists and belongs to user
    const field = await db
      .select()
      .from(customFields)
      .where(
        and(
          eq(customFields.id, params.id),
          eq(customFields.userId, userId)
        )
      )
      .limit(1);

    if (field.length === 0) {
      return Response.json(
        { error: 'Field not found' },
        { status: 404 }
      );
    }

    // If name is changing, check for duplicates
    if (name && name !== field[0].name) {
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
    }

    const now = new Date().toISOString();

    // Update field
    await db
      .update(customFields)
      .set({
        name: name ? name.trim() : field[0].name,
        description: description ?? field[0].description,
        isRequired: isRequired ?? field[0].isRequired,
        isActive: isActive ?? field[0].isActive,
        options: options ? JSON.stringify(options) : field[0].options,
        defaultValue: defaultValue ?? field[0].defaultValue,
        placeholder: placeholder ?? field[0].placeholder,
        validationPattern: validationPattern ?? field[0].validationPattern,
        sortOrder: sortOrder ?? field[0].sortOrder,
        updatedAt: now,
      })
      .where(eq(customFields.id, params.id));

    const updated = await db
      .select()
      .from(customFields)
      .where(eq(customFields.id, params.id))
      .limit(1);

    return Response.json({
      ...updated[0],
      options: updated[0].options ? JSON.parse(updated[0].options) : null,
    });
  } catch (error) {
    console.error('Error updating custom field:', error);
    return Response.json(
      { error: 'Failed to update custom field' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a custom field
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify field exists and belongs to user
    const field = await db
      .select()
      .from(customFields)
      .where(
        and(
          eq(customFields.id, params.id),
          eq(customFields.userId, userId)
        )
      )
      .limit(1);

    if (field.length === 0) {
      return Response.json(
        { error: 'Field not found' },
        { status: 404 }
      );
    }

    // Delete all field values first
    await db
      .delete(customFieldValues)
      .where(eq(customFieldValues.customFieldId, params.id));

    // Then delete the field
    await db.delete(customFields).where(eq(customFields.id, params.id));

    return Response.json(
      { message: 'Field deleted' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting custom field:', error);
    return Response.json(
      { error: 'Failed to delete custom field' },
      { status: 500 }
    );
  }
}
