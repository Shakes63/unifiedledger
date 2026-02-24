import { format } from 'date-fns';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { requireAuth } from '@/lib/auth-helpers';
import {
  centsToDollars,
  legacyStatusesToOccurrenceStatuses,
  toLegacyBill,
  toLegacyInstance,
} from '@/lib/bills-v2/legacy-compat';
import { listOccurrences } from '@/lib/bills-v2/service';
import { toBillsV2Error } from '@/lib/bills-v2/route-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { billOccurrences, billTemplates } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

const ALL_OCCURRENCE_STATUSES = ['unpaid', 'partial', 'paid', 'overpaid', 'overdue', 'skipped'] as const;

function normalizedLegacyStatus(status: string, dueDate: string): 'unpaid' | 'partial' | 'paid' | 'overpaid' | 'overdue' | 'skipped' {
  if (status === 'paid') return 'paid';
  if (status === 'skipped') return 'skipped';
  if (status === 'overdue') return 'overdue';
  const today = format(new Date(), 'yyyy-MM-dd');
  return dueDate < today ? 'overdue' : 'unpaid';
}

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const statusParam = url.searchParams.get('status');
    const billId = url.searchParams.get('billId');
    const billType = url.searchParams.get('billType') as 'expense' | 'income' | 'savings_transfer' | null;

    const legacyStatuses = statusParam
      ? statusParam
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      : [];

    const occurrenceStatuses = legacyStatuses.length
      ? legacyStatusesToOccurrenceStatuses(legacyStatuses)
      : [...ALL_OCCURRENCE_STATUSES];

    const result = await listOccurrences({
      userId,
      householdId,
      status: occurrenceStatuses,
      limit: 5000,
      offset: 0,
    });

    const filtered = billId
      ? result.data.filter((row) => row.occurrence.templateId === billId)
      : result.data;
    const typeFiltered = billType
      ? filtered.filter((row) => row.template.billType === billType)
      : filtered;

    const sorted = [...typeFiltered].sort((a, b) => a.occurrence.dueDate.localeCompare(b.occurrence.dueDate));
    const paged = sorted.slice(offset, offset + limit);

    return Response.json({
      data: paged.map((row) => ({
        instance: toLegacyInstance(row.occurrence),
        bill: toLegacyBill(row.template, null),
      })),
      total: sorted.length,
      limit,
      offset,
    });
  } catch (error) {
    return toBillsV2Error(error, 'compat instances GET');
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();
    const payload = (await request.json()) as {
      billId?: string;
      dueDate?: string;
      expectedAmount?: number;
      status?: string;
      notes?: string;
    };

    const { householdId } = await getAndVerifyHousehold(
      request,
      userId,
      payload as unknown as Record<string, unknown>
    );

    if (!payload.billId || !payload.dueDate || payload.expectedAmount === undefined) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const [template] = await db
      .select()
      .from(billTemplates)
      .where(and(eq(billTemplates.id, payload.billId), eq(billTemplates.householdId, householdId)))
      .limit(1);

    if (!template) {
      return Response.json({ error: 'Bill not found' }, { status: 404 });
    }

    const [existing] = await db
      .select({ id: billOccurrences.id })
      .from(billOccurrences)
      .where(
        and(
          eq(billOccurrences.templateId, payload.billId),
          eq(billOccurrences.householdId, householdId),
          eq(billOccurrences.dueDate, payload.dueDate)
        )
      )
      .limit(1);

    if (existing) {
      return Response.json({ error: 'Bill instance already exists for this date' }, { status: 409 });
    }

    const amountDueCents = Math.max(0, Math.round(payload.expectedAmount * 100));
    const status = normalizedLegacyStatus(payload.status || 'pending', payload.dueDate);
    const paidAmountCents = status === 'paid' ? amountDueCents : 0;
    const remainingCents = Math.max(0, amountDueCents - paidAmountCents);
    const now = new Date().toISOString();

    const occurrenceId = nanoid();

    await db.insert(billOccurrences).values({
      id: occurrenceId,
      templateId: payload.billId,
      householdId,
      dueDate: payload.dueDate,
      status,
      amountDueCents,
      amountPaidCents: paidAmountCents,
      amountRemainingCents: remainingCents,
      actualAmountCents: status === 'paid' ? amountDueCents : null,
      paidDate: status === 'paid' ? payload.dueDate : null,
      lastTransactionId: null,
      daysLate: 0,
      lateFeeCents: 0,
      isManualOverride: true,
      budgetPeriodOverride: null,
      notes: payload.notes || null,
      createdAt: now,
      updatedAt: now,
    });

    const [created] = await db
      .select()
      .from(billOccurrences)
      .where(eq(billOccurrences.id, occurrenceId))
      .limit(1);

    if (!created) {
      throw new Error('Failed to create bill instance');
    }

    return Response.json({
      ...toLegacyInstance(created),
      expectedAmount: centsToDollars(created.amountDueCents),
    });
  } catch (error) {
    return toBillsV2Error(error, 'compat instances POST');
  }
}
