import { and, eq, gte, inArray, lte } from 'drizzle-orm';

import { requireAuth } from '@/lib/auth-helpers';
import {
  centsToDollars,
  legacyStatusFromOccurrence,
  recurrenceToLegacyFrequency,
} from '@/lib/bills-v2/legacy-compat';
import { toBillsV2Error } from '@/lib/bills-v2/route-helpers';
import { listOccurrences } from '@/lib/bills-v2/service';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { billOccurrences, billTemplates } from '@/lib/db/schema';
import { toLocalDateString } from '@/lib/utils/local-date';

export const dynamic = 'force-dynamic';

const NON_MONTHLY_RECURRENCES = ['quarterly', 'semi_annual', 'annual', 'one_time'] as const;

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function createEmptyMonthlySummary() {
  return {
    total: 0,
    paidCount: 0,
    pendingCount: 0,
    overdueCount: 0,
  };
}

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const url = new URL(request.url);
    const year = Number(url.searchParams.get('year') || new Date().getFullYear());

    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return Response.json({ error: 'Invalid year parameter' }, { status: 400 });
    }

    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    await listOccurrences({
      userId,
      householdId,
      from: yearStart,
      to: yearEnd,
      limit: 1,
      offset: 0,
    });

    const nonMonthlyTemplates = await db
      .select()
      .from(billTemplates)
      .where(
        and(
          eq(billTemplates.householdId, householdId),
          eq(billTemplates.isActive, true),
          inArray(billTemplates.recurrenceType, [...NON_MONTHLY_RECURRENCES])
        )
      );

    if (nonMonthlyTemplates.length === 0) {
      return Response.json({
        year,
        bills: [],
        monthNames: MONTH_NAMES,
        summary: {
          totalAnnualAmount: 0,
          monthlyBreakdown: Object.fromEntries(
            Array.from({ length: 12 }, (_, index) => [String(index + 1), createEmptyMonthlySummary()])
          ),
          paidCount: 0,
          pendingCount: 0,
          overdueCount: 0,
          totalInstances: 0,
          nextDue: null,
        },
      });
    }

    const templateIds = nonMonthlyTemplates.map((template) => template.id);

    const yearOccurrences = await db
      .select()
      .from(billOccurrences)
      .where(
        and(
          eq(billOccurrences.householdId, householdId),
          inArray(billOccurrences.templateId, templateIds),
          gte(billOccurrences.dueDate, yearStart),
          lte(billOccurrences.dueDate, yearEnd)
        )
      );

    const instancesByTemplateId = new Map<string, typeof yearOccurrences>();
    yearOccurrences.forEach((occurrence) => {
      const rows = instancesByTemplateId.get(occurrence.templateId) || [];
      rows.push(occurrence);
      instancesByTemplateId.set(occurrence.templateId, rows);
    });

    const bills = nonMonthlyTemplates.map((template) => {
      const monthlyData: Record<string, {
        dueDate: number;
        amount: number;
        instanceId: string;
        status: 'pending' | 'paid' | 'overdue' | 'skipped';
        actualAmount?: number;
        paidDate?: string;
      } | null> = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), null]));

      const occurrences = instancesByTemplateId.get(template.id) || [];
      occurrences.forEach((occurrence) => {
        const [, monthStr, dayStr] = occurrence.dueDate.split('-');
        const month = Number(monthStr);
        const day = Number(dayStr);

        monthlyData[String(month)] = {
          dueDate: day,
          amount: centsToDollars(occurrence.amountDueCents),
          instanceId: occurrence.id,
          status: legacyStatusFromOccurrence(occurrence.status),
          actualAmount:
            occurrence.actualAmountCents !== null ? centsToDollars(occurrence.actualAmountCents) : undefined,
          paidDate: occurrence.paidDate || undefined,
        };
      });

      return {
        id: template.id,
        name: template.name,
        frequency: recurrenceToLegacyFrequency(template.recurrenceType),
        expectedAmount: centsToDollars(template.defaultAmountCents),
        isActive: template.isActive,
        notes: template.notes || undefined,
        monthlyData,
      };
    });

    const monthlyBreakdown: Record<string, ReturnType<typeof createEmptyMonthlySummary>> = Object.fromEntries(
      Array.from({ length: 12 }, (_, index) => [String(index + 1), createEmptyMonthlySummary()])
    );

    let totalAnnualAmount = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let overdueCount = 0;

    yearOccurrences.forEach((occurrence) => {
      const [, monthStr] = occurrence.dueDate.split('-');
      const monthKey = String(Number(monthStr));
      const amount = centsToDollars(occurrence.amountDueCents);
      monthlyBreakdown[monthKey].total += amount;
      totalAnnualAmount += amount;

      const status = legacyStatusFromOccurrence(occurrence.status);
      if (status === 'paid') {
        monthlyBreakdown[monthKey].paidCount += 1;
        paidCount += 1;
      } else if (status === 'overdue') {
        monthlyBreakdown[monthKey].overdueCount += 1;
        overdueCount += 1;
      } else if (status === 'pending') {
        monthlyBreakdown[monthKey].pendingCount += 1;
        pendingCount += 1;
      }
    });

    const today = toLocalDateString(new Date());

    const upcoming = [...yearOccurrences]
      .filter((occurrence) => legacyStatusFromOccurrence(occurrence.status) === 'pending' && occurrence.dueDate >= today)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    const nextDue = upcoming.length
      ? {
          billId: upcoming[0].templateId,
          billName:
            nonMonthlyTemplates.find((template) => template.id === upcoming[0].templateId)?.name || 'Unknown',
          dueDate: upcoming[0].dueDate,
          amount: centsToDollars(upcoming[0].amountDueCents),
          instanceId: upcoming[0].id,
        }
      : null;

    return Response.json({
      year,
      bills,
      monthNames: MONTH_NAMES,
      summary: {
        totalAnnualAmount,
        monthlyBreakdown,
        paidCount,
        pendingCount,
        overdueCount,
        totalInstances: yearOccurrences.length,
        nextDue,
      },
    });
  } catch (error) {
    return toBillsV2Error(error, 'compat annual-planning GET');
  }
}
