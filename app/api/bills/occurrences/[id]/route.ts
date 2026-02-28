import { format } from 'date-fns';
import { and, eq } from 'drizzle-orm';

import { requireAuth } from '@/lib/auth-helpers';
import type { OccurrenceStatus } from '@/lib/bills/contracts';
import { toBillsV2Error } from '@/lib/bills/route-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import {
  billOccurrenceAllocations,
  billOccurrences,
  billPaymentEvents,
  billTemplates,
} from '@/lib/db/schema';

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
      return Response.json({ error: 'Bill occurrence not found' }, { status: 404 });
    }

    return Response.json({ data: occurrence });
  } catch (error) {
    return toBillsV2Error(error, 'occurrences [id] GET');
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const payload = (await request.json()) as {
      status?: OccurrenceStatus;
      actualAmountCents?: number | null;
      paidDate?: string | null;
      transactionId?: string | null;
      daysLate?: number;
      lateFeeCents?: number;
      isManualOverride?: boolean;
      notes?: string | null;
      budgetPeriodOverride?: number | null;
    };
    const { householdId } = await getAndVerifyHousehold(
      request,
      userId,
      payload as unknown as Record<string, unknown>
    );
    const { id } = await params;

    const [existing] = await db
      .select({ occurrence: billOccurrences, template: billTemplates })
      .from(billOccurrences)
      .innerJoin(billTemplates, eq(billOccurrences.templateId, billTemplates.id))
      .where(and(eq(billOccurrences.id, id), eq(billOccurrences.householdId, householdId)))
      .limit(1);

    if (!existing) {
      return Response.json({ error: 'Bill occurrence not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const next: Partial<typeof billOccurrences.$inferInsert> = {
      updatedAt: now,
    };

    if (payload.notes !== undefined) next.notes = payload.notes;
    if (payload.isManualOverride !== undefined) next.isManualOverride = payload.isManualOverride;
    if (payload.budgetPeriodOverride !== undefined) next.budgetPeriodOverride = payload.budgetPeriodOverride;
    if (payload.transactionId !== undefined) next.lastTransactionId = payload.transactionId;
    if (payload.daysLate !== undefined) next.daysLate = Math.max(0, payload.daysLate);
    if (payload.lateFeeCents !== undefined) next.lateFeeCents = Math.max(0, Math.round(payload.lateFeeCents));

    if (payload.status) {
      if (payload.status === 'skipped') {
        next.status = 'skipped';
      } else if (payload.status === 'overdue') {
        next.status = 'overdue';
      } else if (payload.status === 'unpaid') {
        const today = format(new Date(), 'yyyy-MM-dd');
        const status = existing.occurrence.dueDate < today ? 'overdue' : 'unpaid';
        next.status = status;
        next.amountPaidCents = 0;
        next.amountRemainingCents = existing.occurrence.amountDueCents;
        next.actualAmountCents = null;
        next.paidDate = null;
        if (payload.transactionId === undefined) {
          next.lastTransactionId = null;
        }
      } else if (payload.status === 'paid') {
        const providedCents =
          payload.actualAmountCents !== undefined && payload.actualAmountCents !== null
            ? Math.round(payload.actualAmountCents)
            : existing.occurrence.amountDueCents;

        const paidCents = Math.max(0, providedCents);
        const remainingCents = Math.max(0, existing.occurrence.amountDueCents - paidCents);

        next.amountPaidCents = paidCents;
        next.amountRemainingCents = remainingCents;
        next.actualAmountCents = paidCents;
        next.paidDate = payload.paidDate || format(new Date(), 'yyyy-MM-dd');
        next.status = paidCents > existing.occurrence.amountDueCents ? 'overpaid' : remainingCents === 0 ? 'paid' : 'partial';
      }
    } else {
      if (payload.actualAmountCents !== undefined) {
        const actualCents =
          payload.actualAmountCents === null ? null : Math.max(0, Math.round(payload.actualAmountCents));
        next.actualAmountCents = actualCents;
      }
      if (payload.paidDate !== undefined) {
        next.paidDate = payload.paidDate;
      }
    }

    await db
      .update(billOccurrences)
      .set(next)
      .where(and(eq(billOccurrences.id, id), eq(billOccurrences.householdId, householdId)));

    if (payload.status === 'paid' && existing.template.recurrenceType === 'one_time') {
      await db
        .update(billTemplates)
        .set({ isActive: false, updatedAt: now })
        .where(eq(billTemplates.id, existing.template.id));
    }

    const [updated] = await db
      .select()
      .from(billOccurrences)
      .where(and(eq(billOccurrences.id, id), eq(billOccurrences.householdId, householdId)))
      .limit(1);

    if (!updated) {
      return Response.json({ error: 'Bill occurrence not found' }, { status: 404 });
    }

    return Response.json({ data: updated });
  } catch (error) {
    return toBillsV2Error(error, 'occurrences [id] PUT');
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
      .select({ id: billOccurrences.id })
      .from(billOccurrences)
      .where(and(eq(billOccurrences.id, id), eq(billOccurrences.householdId, householdId)))
      .limit(1);

    if (!occurrence) {
      return Response.json({ error: 'Bill occurrence not found' }, { status: 404 });
    }

    await db
      .delete(billOccurrenceAllocations)
      .where(and(eq(billOccurrenceAllocations.occurrenceId, id), eq(billOccurrenceAllocations.householdId, householdId)));

    await db
      .delete(billPaymentEvents)
      .where(and(eq(billPaymentEvents.occurrenceId, id), eq(billPaymentEvents.householdId, householdId)));

    await db
      .delete(billOccurrences)
      .where(and(eq(billOccurrences.id, id), eq(billOccurrences.householdId, householdId)));

    return Response.json({ success: true });
  } catch (error) {
    return toBillsV2Error(error, 'occurrences [id] DELETE');
  }
}
