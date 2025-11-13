import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { customFieldValues, customFields, transactions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

// GET - Get custom field values for a transaction
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    const url = new URL(request.url);
    const transactionId = url.searchParams.get('transactionId');

    if (!transactionId) {
      return Response.json(
        { error: 'transactionId is required' },
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

    const values = await db
      .select()
      .from(customFieldValues)
      .where(eq(customFieldValues.transactionId, transactionId));

    return Response.json({
      data: values.map((value) => ({
        ...value,
        value: value.value ? JSON.parse(value.value) : null,
      })),
    });
  } catch (error) {
    console.error('Error fetching custom field values:', error);
    return Response.json(
      { error: 'Failed to fetch custom field values' },
      { status: 500 }
    );
  }
}

// POST - Create or update a custom field value
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const { customFieldId, transactionId, value } = body;

    if (!customFieldId || !transactionId) {
      return Response.json(
        { error: 'customFieldId and transactionId are required' },
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

    // Verify field belongs to user
    const field = await db
      .select()
      .from(customFields)
      .where(
        and(
          eq(customFields.id, customFieldId),
          eq(customFields.userId, userId)
        )
      )
      .limit(1);

    if (field.length === 0) {
      return Response.json(
        { error: 'Custom field not found' },
        { status: 404 }
      );
    }

    // Check if value already exists
    const existing = await db
      .select()
      .from(customFieldValues)
      .where(
        and(
          eq(customFieldValues.customFieldId, customFieldId),
          eq(customFieldValues.transactionId, transactionId)
        )
      )
      .limit(1);

    const now = new Date().toISOString();
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

    if (existing.length > 0) {
      // Update existing value
      await db
        .update(customFieldValues)
        .set({
          value: stringValue,
          updatedAt: now,
        })
        .where(eq(customFieldValues.id, existing[0].id));

      return Response.json(existing[0]);
    } else {
      // Create new value
      const valueId = nanoid();
      await db.insert(customFieldValues).values({
        id: valueId,
        userId,
        customFieldId,
        transactionId,
        value: stringValue,
      });

      // Update field usage count
      await db
        .update(customFields)
        .set({
          usageCount: (field[0].usageCount || 0) + 1,
          updatedAt: now,
        })
        .where(eq(customFields.id, customFieldId));

      const created = await db
        .select()
        .from(customFieldValues)
        .where(eq(customFieldValues.id, valueId))
        .limit(1);

      return Response.json(
        {
          ...created[0],
          value: created[0].value ? JSON.parse(created[0].value) : null,
        },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error('Error creating/updating custom field value:', error);
    return Response.json(
      { error: 'Failed to save custom field value' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a custom field value
export async function DELETE(request: Request) {
  try {
    const { userId } = await requireAuth();

    const url = new URL(request.url);
    const valueId = url.searchParams.get('valueId');

    if (!valueId) {
      return Response.json(
        { error: 'valueId is required' },
        { status: 400 }
      );
    }

    // Verify value exists and belongs to user
    const value = await db
      .select()
      .from(customFieldValues)
      .where(
        and(
          eq(customFieldValues.id, valueId),
          eq(customFieldValues.userId, userId)
        )
      )
      .limit(1);

    if (value.length === 0) {
      return Response.json(
        { error: 'Field value not found' },
        { status: 404 }
      );
    }

    // Delete value
    await db.delete(customFieldValues).where(eq(customFieldValues.id, valueId));

    // Update field usage count
    const field = await db
      .select()
      .from(customFields)
      .where(eq(customFields.id, value[0].customFieldId))
      .limit(1);

    if (field.length > 0) {
      const now = new Date().toISOString();
      await db
        .update(customFields)
        .set({
          usageCount: Math.max(0, (field[0].usageCount || 0) - 1),
          updatedAt: now,
        })
        .where(eq(customFields.id, value[0].customFieldId));
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting custom field value:', error);
    return Response.json(
      { error: 'Failed to delete custom field value' },
      { status: 500 }
    );
  }
}
