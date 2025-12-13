import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
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
    const { userId } = await requireAuth();
    const { id } = await params;

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
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
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
    const { userId } = await requireAuth();
    const { id } = await params;

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

    // Get and validate household for account/category validation
    const householdId = getHouseholdIdFromRequest(request, body);
    await requireHouseholdAuth(userId, householdId);
// TypeScript: householdId is guaranteed to be non-null after requireHouseholdAuth
if (!householdId) {
  return Response.json(
    { error: 'Household ID is required' },
    { status: 400 }
  );
}

    // Validate account if provided (must belong to household)
    if (accountId) {
      const account = await db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.id, accountId),
            eq(accounts.userId, userId),
            eq(accounts.householdId, householdId)
          )
        )
        .limit(1);

      if (account.length === 0) {
        return Response.json(
          { error: 'Account not found in household' },
          { status: 404 }
        );
      }
    }

    // Validate category if provided (must belong to household)
    if (categoryId) {
      const category = await db
        .select()
        .from(budgetCategories)
        .where(
          and(
            eq(budgetCategories.id, categoryId),
            eq(budgetCategories.userId, userId),
            eq(budgetCategories.householdId, householdId)
          )
        )
        .limit(1);

      if (category.length === 0) {
        return Response.json(
          { error: 'Category not found in household' },
          { status: 404 }
        );
      }
    }

    // Update template
    const updates: Partial<typeof transactionTemplates.$inferInsert> = {
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
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && (
      error.message.includes('Household') ||
      error.message.includes('member')
    )) {
      return Response.json({ error: error.message }, { status: 403 });
    }
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
    const { userId } = await requireAuth();
    const { id } = await params;

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
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Template deletion error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
