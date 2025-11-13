import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { merchants } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// PUT - Update a merchant
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();

    const { id } = await params;
    const body = await request.json();
    const { name, categoryId } = body;

    // Verify merchant belongs to user
    const merchant = await db
      .select()
      .from(merchants)
      .where(
        and(
          eq(merchants.id, id),
          eq(merchants.userId, userId)
        )
      )
      .limit(1);

    if (merchant.length === 0) {
      return Response.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Update merchant
    await db
      .update(merchants)
      .set({
        name: name || merchant[0].name,
        categoryId: categoryId !== undefined ? categoryId : merchant[0].categoryId,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(merchants.id, id));

    const updatedMerchant = await db
      .select()
      .from(merchants)
      .where(eq(merchants.id, id))
      .limit(1);

    return Response.json(updatedMerchant[0]);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error updating merchant:', error);
    return Response.json(
      { error: 'Failed to update merchant' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a merchant
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();

    const { id } = await params;

    // Verify merchant belongs to user
    const merchant = await db
      .select()
      .from(merchants)
      .where(
        and(
          eq(merchants.id, id),
          eq(merchants.userId, userId)
        )
      )
      .limit(1);

    if (merchant.length === 0) {
      return Response.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Delete merchant
    await db
      .delete(merchants)
      .where(eq(merchants.id, id));

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error deleting merchant:', error);
    return Response.json(
      { error: 'Failed to delete merchant' },
      { status: 500 }
    );
  }
}
