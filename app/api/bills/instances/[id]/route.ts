import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { billInstances, bills } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// GET - Fetch a single bill instance
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const { id } = await params;

    const instance = await db
      .select()
      .from(billInstances)
      .where(
        and(
          eq(billInstances.id, id),
          eq(billInstances.userId, userId),
          eq(billInstances.householdId, householdId)
        )
      )
      .limit(1);

    if (instance.length === 0) {
      return Response.json(
        { error: 'Bill instance not found' },
        { status: 404 }
      );
    }

    return Response.json(instance[0]);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error fetching bill instance:', error);
    return Response.json(
      { error: 'Failed to fetch bill instance' },
      { status: 500 }
    );
  }
}

// PUT - Update a bill instance (mark as paid, skip, etc.)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const { householdId } = await getAndVerifyHousehold(request, userId, body);

    const { id } = await params;
    const {
      status, // pending, paid, overdue, skipped
      actualAmount,
      paidDate,
      transactionId,
      daysLate,
      lateFee,
      isManualOverride,
      notes,
    } = body;

    // Verify instance exists and belongs to user and household
    const existingInstance = await db
      .select()
      .from(billInstances)
      .where(
        and(
          eq(billInstances.id, id),
          eq(billInstances.userId, userId),
          eq(billInstances.householdId, householdId)
        )
      )
      .limit(1);

    if (existingInstance.length === 0) {
      return Response.json(
        { error: 'Bill instance not found' },
        { status: 404 }
      );
    }

    // Build update object
    const updateData: any = {};
    if (status !== undefined) {
      if (!['pending', 'paid', 'overdue', 'skipped'].includes(status)) {
        return Response.json(
          { error: 'Invalid status' },
          { status: 400 }
        );
      }
      updateData.status = status;
    }
    if (actualAmount !== undefined) updateData.actualAmount = parseFloat(actualAmount);
    if (paidDate !== undefined) updateData.paidDate = paidDate;
    if (transactionId !== undefined) updateData.transactionId = transactionId;
    if (daysLate !== undefined) updateData.daysLate = daysLate;
    if (lateFee !== undefined) updateData.lateFee = parseFloat(lateFee);
    if (isManualOverride !== undefined) updateData.isManualOverride = isManualOverride;
    if (notes !== undefined) updateData.notes = notes;
    updateData.updatedAt = new Date().toISOString();

    await db
      .update(billInstances)
      .set(updateData)
      .where(
        and(
          eq(billInstances.id, id),
          eq(billInstances.householdId, householdId)
        )
      );

    // If marking as paid, check if this is a one-time bill and auto-deactivate
    if (status === 'paid') {
      const billId = existingInstance[0].billId;

      // Get the bill to check if it's one-time
      const bill = await db
        .select()
        .from(bills)
        .where(
          and(
            eq(bills.id, billId),
            eq(bills.userId, userId),
            eq(bills.householdId, householdId)
          )
        )
        .limit(1);

      // Auto-deactivate one-time bills after payment
      if (bill.length > 0 && bill[0].frequency === 'one-time') {
        await db
          .update(bills)
          .set({
            isActive: false,
          })
          .where(
            and(
              eq(bills.id, billId),
              eq(bills.householdId, householdId)
            )
          );
      }
    }

    const updatedInstance = await db
      .select()
      .from(billInstances)
      .where(
        and(
          eq(billInstances.id, id),
          eq(billInstances.householdId, householdId)
        )
      )
      .limit(1);

    return Response.json(updatedInstance[0]);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error updating bill instance:', error);
    return Response.json(
      { error: 'Failed to update bill instance' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a bill instance
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const { id } = await params;

    // Verify instance exists and belongs to user and household
    const instance = await db
      .select()
      .from(billInstances)
      .where(
        and(
          eq(billInstances.id, id),
          eq(billInstances.userId, userId),
          eq(billInstances.householdId, householdId)
        )
      )
      .limit(1);

    if (instance.length === 0) {
      return Response.json(
        { error: 'Bill instance not found' },
        { status: 404 }
      );
    }

    await db
      .delete(billInstances)
      .where(
        and(
          eq(billInstances.id, id),
          eq(billInstances.householdId, householdId)
        )
      );

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error deleting bill instance:', error);
    return Response.json(
      { error: 'Failed to delete bill instance' },
      { status: 500 }
    );
  }
}
