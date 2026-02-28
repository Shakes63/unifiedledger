import { and, eq, gte, inArray, lte } from 'drizzle-orm';

import { requireAuth } from '@/lib/auth-helpers';
import { toBillsV2Error } from '@/lib/bills/route-helpers';
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
    totalAmountCents: 0,
    byStatus: {
      unpaid: 0,
      partial: 0,
      paid: 0,
      overpaid: 0,
      overdue: 0,
      skipped: 0,
    },
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
        data: {
          year,
          monthNames: MONTH_NAMES,
          templates: [],
          occurrences: [],
          summary: {
            totalAnnualAmountCents: 0,
            monthlyBreakdown: Object.fromEntries(
              Array.from({ length: 12 }, (_, index) => [
                String(index + 1),
                createEmptyMonthlySummary(),
              ])
            ),
            totalInstances: 0,
            nextDue: null,
          },
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

    const monthlyBreakdown: Record<string, ReturnType<typeof createEmptyMonthlySummary>> = Object.fromEntries(
      Array.from({ length: 12 }, (_, index) => [String(index + 1), createEmptyMonthlySummary()])
    );

    let totalAnnualAmountCents = 0;

    yearOccurrences.forEach((occurrence) => {
      const [, monthStr] = occurrence.dueDate.split('-');
      const monthKey = String(Number(monthStr));
      monthlyBreakdown[monthKey].totalAmountCents += occurrence.amountDueCents;
      monthlyBreakdown[monthKey].byStatus[occurrence.status] += 1;
      totalAnnualAmountCents += occurrence.amountDueCents;
    });

    const today = toLocalDateString(new Date());

    const upcoming = [...yearOccurrences]
      .filter(
        (occurrence) =>
          (occurrence.status === 'unpaid' || occurrence.status === 'partial') &&
          occurrence.dueDate >= today
      )
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    const nextDue = upcoming.length
      ? {
          templateId: upcoming[0].templateId,
          dueDate: upcoming[0].dueDate,
          amountDueCents: upcoming[0].amountDueCents,
          occurrenceId: upcoming[0].id,
        }
      : null;

    return Response.json({
      data: {
        year,
        monthNames: MONTH_NAMES,
        templates: nonMonthlyTemplates,
        occurrences: yearOccurrences,
        summary: {
          totalAnnualAmountCents,
          monthlyBreakdown,
          totalInstances: yearOccurrences.length,
          nextDue,
        },
      },
    });
  } catch (error) {
    return toBillsV2Error(error, 'annual-planning GET');
  }
}
