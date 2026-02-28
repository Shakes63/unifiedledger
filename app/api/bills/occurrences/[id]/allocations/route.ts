import { and, asc, eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';

import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import type { UpdateOccurrenceAllocationsRequest } from '@/lib/bills/contracts';
import { updateOccurrenceAllocations } from '@/lib/bills/service';
import { toBillsV2Error } from '@/lib/bills/route-helpers';
import { db } from '@/lib/db';
import { billOccurrenceAllocations, billOccurrences } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);
    const { id } = await context.params;

    const [occurrence] = await db
      .select()
      .from(billOccurrences)
      .where(and(eq(billOccurrences.id, id), eq(billOccurrences.householdId, householdId)))
      .limit(1);

    if (!occurrence) {
      return Response.json({ error: 'Bill occurrence not found' }, { status: 404 });
    }

    const allocations = await db
      .select()
      .from(billOccurrenceAllocations)
      .where(and(eq(billOccurrenceAllocations.occurrenceId, id), eq(billOccurrenceAllocations.householdId, householdId)))
      .orderBy(asc(billOccurrenceAllocations.periodNumber));

    const totalAllocated = allocations.reduce((sum, row) => sum + row.allocatedAmountCents, 0);
    const totalPaid = allocations.reduce((sum, row) => sum + row.paidAmountCents, 0);

    return Response.json({
      data: {
        occurrence,
        allocations,
        summary: {
          totalAllocatedCents: totalAllocated,
          totalPaidCents: totalPaid,
          remainingToAllocateCents: Math.max(0, occurrence.amountDueCents - totalAllocated),
          isSplit: allocations.length > 1,
          allocationCount: allocations.length,
        },
      },
    });
  } catch (error) {
    return toBillsV2Error(error, 'occurrences [id] allocations GET');
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const body: UpdateOccurrenceAllocationsRequest = await request.json();
    const { householdId } = await getAndVerifyHousehold(
      request,
      userId,
      body as unknown as Record<string, unknown>
    );
    const { id } = await context.params;

    const allocations = await updateOccurrenceAllocations(householdId, id, body);
    return Response.json({ data: allocations });
  } catch (error) {
    return toBillsV2Error(error, 'occurrences [id] allocations PUT');
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const payload = (await request.json()) as {
      allocations?: Array<{ periodNumber: number; allocatedAmountCents: number }>;
    };
    const { householdId } = await getAndVerifyHousehold(
      request,
      userId,
      payload as unknown as Record<string, unknown>
    );
    const { id } = await context.params;

    if (!Array.isArray(payload.allocations) || payload.allocations.length === 0) {
      return Response.json({ error: 'allocations must be a non-empty array' }, { status: 400 });
    }

    const updated = await updateOccurrenceAllocations(householdId, id, {
      allocations: payload.allocations.map((allocation) => ({
        periodNumber: allocation.periodNumber,
        allocatedAmountCents: Math.round(allocation.allocatedAmountCents),
      })),
    });

    return Response.json({
      data: {
        occurrenceId: id,
        allocations: updated,
        summary: {
          totalAllocatedCents: updated.reduce(
            (sum, allocation) => sum + allocation.allocatedAmountCents,
            0
          ),
          allocationCount: updated.length,
        },
      },
    });
  } catch (error) {
    return toBillsV2Error(error, 'occurrences [id] allocations POST');
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);
    const { id } = await context.params;

    const [occurrence] = await db
      .select()
      .from(billOccurrences)
      .where(and(eq(billOccurrences.id, id), eq(billOccurrences.householdId, householdId)))
      .limit(1);

    if (!occurrence) {
      return Response.json({ error: 'Bill occurrence not found' }, { status: 404 });
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
    return toBillsV2Error(error, 'occurrences [id] allocations DELETE');
  }
}
