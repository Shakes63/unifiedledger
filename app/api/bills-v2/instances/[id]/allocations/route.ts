import { and, asc, eq } from 'drizzle-orm';

import { requireAuth } from '@/lib/auth-helpers';
import { centsToDollars, toLegacyAllocation } from '@/lib/bills-v2/legacy-compat';
import { toBillsV2Error } from '@/lib/bills-v2/route-helpers';
import { updateOccurrenceAllocations } from '@/lib/bills-v2/service';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { billOccurrenceAllocations, billOccurrences } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);
    const { id } = await params;

    const [occurrence] = await db
      .select()
      .from(billOccurrences)
      .where(and(eq(billOccurrences.id, id), eq(billOccurrences.householdId, householdId)))
      .limit(1);

    if (!occurrence) {
      return Response.json({ error: 'Bill instance not found' }, { status: 404 });
    }

    const allocations = await db
      .select()
      .from(billOccurrenceAllocations)
      .where(and(eq(billOccurrenceAllocations.occurrenceId, id), eq(billOccurrenceAllocations.householdId, householdId)))
      .orderBy(asc(billOccurrenceAllocations.periodNumber));

    const legacyAllocations = allocations.map((allocation) => toLegacyAllocation(allocation));

    const totalAllocated = allocations.reduce((sum, row) => sum + row.allocatedAmountCents, 0);
    const totalPaid = allocations.reduce((sum, row) => sum + row.paidAmountCents, 0);

    return Response.json({
      instanceId: id,
      billId: occurrence.templateId,
      expectedAmount: centsToDollars(occurrence.amountDueCents),
      allocations: legacyAllocations,
      summary: {
        totalAllocated: centsToDollars(totalAllocated),
        totalPaid: centsToDollars(totalPaid),
        remainingToAllocate: centsToDollars(Math.max(0, occurrence.amountDueCents - totalAllocated)),
        isSplit: allocations.length > 1,
        allocationCount: allocations.length,
      },
    });
  } catch (error) {
    return toBillsV2Error(error, 'compat instance [id] allocations GET');
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const payload = (await request.json()) as {
      allocations?: Array<{ periodNumber: number; allocatedAmount: number }>;
    };
    const { householdId } = await getAndVerifyHousehold(
      request,
      userId,
      payload as unknown as Record<string, unknown>
    );
    const { id } = await params;

    if (!Array.isArray(payload.allocations) || payload.allocations.length === 0) {
      return Response.json({ error: 'allocations must be a non-empty array' }, { status: 400 });
    }

    const updated = await updateOccurrenceAllocations(householdId, id, {
      allocations: payload.allocations.map((allocation) => ({
        periodNumber: allocation.periodNumber,
        allocatedAmountCents: Math.round(allocation.allocatedAmount * 100),
      })),
    });

    return Response.json({
      success: true,
      instanceId: id,
      allocations: updated.map((allocation) => toLegacyAllocation(allocation)),
      summary: {
        totalAllocated: updated.reduce((sum, allocation) => sum + centsToDollars(allocation.allocatedAmountCents), 0),
        allocationCount: updated.length,
      },
    });
  } catch (error) {
    return toBillsV2Error(error, 'compat instance [id] allocations POST');
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);
    const { id } = await params;

    const [occurrence] = await db
      .select()
      .from(billOccurrences)
      .where(and(eq(billOccurrences.id, id), eq(billOccurrences.householdId, householdId)))
      .limit(1);

    if (!occurrence) {
      return Response.json({ error: 'Bill instance not found' }, { status: 404 });
    }

    const paidAllocation = await db
      .select({ id: billOccurrenceAllocations.id })
      .from(billOccurrenceAllocations)
      .where(
        and(
          eq(billOccurrenceAllocations.occurrenceId, id),
          eq(billOccurrenceAllocations.householdId, householdId),
          eq(billOccurrenceAllocations.isPaid, true)
        )
      )
      .limit(1);

    if (paidAllocation.length > 0) {
      return Response.json({ error: 'Cannot remove allocations that have been paid' }, { status: 400 });
    }

    await db
      .delete(billOccurrenceAllocations)
      .where(and(eq(billOccurrenceAllocations.occurrenceId, id), eq(billOccurrenceAllocations.householdId, householdId)));

    return Response.json({
      success: true,
      instanceId: id,
      message: 'All allocations removed',
    });
  } catch (error) {
    return toBillsV2Error(error, 'compat instance [id] allocations DELETE');
  }
}
