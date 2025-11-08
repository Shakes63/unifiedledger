import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { transactionTemplates, budgetCategories, accounts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// GET - Get a specific transaction template
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

    const template = await db
      .select()
      .from(transactionTemplates)
      .where(
        and(
          eq(transactionTemplates.id, id),
          eq(transactionTemplates.userId, userId)
        )
      )
      .limit(1);

    if (template.length === 0) {
      return Response.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    return Response.json(template[0]);
  } catch (error) {
    console.error('Template fetch error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update a transaction template
export async function PUT(
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

    // Verify template belongs to user
    const existing = await db
      .select()
      .from(transactionTemplates)
      .where(
        and(
          eq(transactionTemplates.id, id),
          eq(transactionTemplates.userId, userId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return Response.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      accountId,
      categoryId,
      amount,
      type,
      notes,
    } = body;

    // Validate account if provided
    if (accountId) {
      const account = await db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.id, accountId),
            eq(accounts.userId, userId)
          )
        )
        .limit(1);

      if (account.length === 0) {
        return Response.json(
          { error: 'Account not found' },
          { status: 404 }
        );
      }
    }

    // Validate category if provided
    if (categoryId) {
      const category = await db
        .select()
        .from(budgetCategories)
        .where(
          and(
            eq(budgetCategories.id, categoryId),
            eq(budgetCategories.userId, userId)
          )
        )
        .limit(1);

      if (category.length === 0) {
        return Response.json(
          { error: 'Category not found' },
          { status: 404 }
        );
      }
    }

    // Update template
    const updates: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (accountId !== undefined) updates.accountId = accountId;
    if (categoryId !== undefined) updates.categoryId = categoryId;
    if (amount !== undefined) updates.amount = parseFloat(amount);
    if (type !== undefined) updates.type = type;
    if (notes !== undefined) updates.notes = notes;

    await db
      .update(transactionTemplates)
      .set(updates)
      .where(
        and(
          eq(transactionTemplates.id, id),
          eq(transactionTemplates.userId, userId)
        )
      );

    return Response.json({
      message: 'Template updated successfully',
    });
  } catch (error) {
    console.error('Template update error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a transaction template
export async function DELETE(
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

    // Verify template belongs to user
    const existing = await db
      .select()
      .from(transactionTemplates)
      .where(
        and(
          eq(transactionTemplates.id, id),
          eq(transactionTemplates.userId, userId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return Response.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Delete template
    await db
      .delete(transactionTemplates)
      .where(
        and(
          eq(transactionTemplates.id, id),
          eq(transactionTemplates.userId, userId)
        )
      );

    return Response.json({
      message: 'Template deleted successfully',
    });
  } catch (error) {
    console.error('Template deletion error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
