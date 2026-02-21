import { addDays, format, startOfDay } from 'date-fns';

import { requireAuth } from '@/lib/auth-helpers';
import { type BillClassification } from '@/lib/bills-v2/contracts';
import { centsToDollars } from '@/lib/bills-v2/legacy-compat';
import { toBillsV2Error } from '@/lib/bills-v2/route-helpers';
import { listBillTemplates, listOccurrences } from '@/lib/bills-v2/service';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { CLASSIFICATION_META } from '@/lib/bills/bill-classification';

export const dynamic = 'force-dynamic';

function normalizeToMonthly(amount: number, recurrenceType: string): number {
  switch (recurrenceType) {
    case 'weekly':
      return amount * 4.33;
    case 'biweekly':
      return amount * 2.17;
    case 'monthly':
      return amount;
    case 'quarterly':
      return amount / 3;
    case 'semi_annual':
      return amount / 6;
    case 'annual':
      return amount / 12;
    case 'one_time':
      return 0;
    default:
      return amount;
  }
}

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const classifications: BillClassification[] = [
      'subscription',
      'utility',
      'housing',
      'insurance',
      'loan_payment',
      'membership',
      'service',
      'other',
    ];

    const today = startOfDay(new Date());
    const todayStr = format(today, 'yyyy-MM-dd');
    const thirtyDaysFromNowStr = format(addDays(today, 30), 'yyyy-MM-dd');

    const [templatesResult, upcomingResult] = await Promise.all([
      listBillTemplates({ householdId, isActive: true, limit: 5000, offset: 0 }),
      listOccurrences({
        userId,
        householdId,
        status: ['unpaid', 'partial'],
        from: todayStr,
        to: thirtyDaysFromNowStr,
        limit: 5000,
        offset: 0,
      }),
    ]);

    const upcomingByTemplateId = new Map<string, { sum: number; count: number }>();
    upcomingResult.data.forEach((row) => {
      const prev = upcomingByTemplateId.get(row.occurrence.templateId) || { sum: 0, count: 0 };
      upcomingByTemplateId.set(row.occurrence.templateId, {
        sum: prev.sum + centsToDollars(row.occurrence.amountDueCents),
        count: prev.count + 1,
      });
    });

    const summaryMap = new Map<BillClassification, {
      classification: BillClassification;
      label: string;
      count: number;
      totalMonthly: number;
      upcomingCount: number;
      upcomingAmount: number;
      color: string;
    }>();

    classifications.forEach((classification) => {
      summaryMap.set(classification, {
        classification,
        label: CLASSIFICATION_META[classification].label,
        count: 0,
        totalMonthly: 0,
        upcomingCount: 0,
        upcomingAmount: 0,
        color: CLASSIFICATION_META[classification].color,
      });
    });

    templatesResult.data.forEach((template) => {
      if (template.billType === 'income') return;

      const classification = template.classification as BillClassification;
      const summary = summaryMap.get(classification) || summaryMap.get('other');
      if (!summary) return;

      summary.count += 1;

      const baseAmount = centsToDollars(template.defaultAmountCents);
      const upcomingStats = upcomingByTemplateId.get(template.id);
      const upcomingAverage = upcomingStats && upcomingStats.count > 0 ? upcomingStats.sum / upcomingStats.count : 0;

      const estimatedAmount =
        baseAmount > 0 ? baseAmount : template.isVariableAmount ? upcomingAverage : baseAmount;

      summary.totalMonthly += normalizeToMonthly(estimatedAmount, template.recurrenceType);
    });

    upcomingResult.data.forEach((row) => {
      const classification = row.template.classification as BillClassification;
      const summary = summaryMap.get(classification) || summaryMap.get('other');
      if (!summary) return;

      summary.upcomingCount += 1;
      summary.upcomingAmount += centsToDollars(row.occurrence.amountDueCents);
    });

    const data = Array.from(summaryMap.values())
      .filter((item) => item.count > 0 || item.upcomingCount > 0)
      .sort((a, b) => b.totalMonthly - a.totalMonthly);

    return Response.json({
      data,
      totals: {
        totalCount: data.reduce((sum, item) => sum + item.count, 0),
        totalMonthly: data.reduce((sum, item) => sum + item.totalMonthly, 0),
        totalUpcomingCount: data.reduce((sum, item) => sum + item.upcomingCount, 0),
        totalUpcomingAmount: data.reduce((sum, item) => sum + item.upcomingAmount, 0),
      },
    });
  } catch (error) {
    return toBillsV2Error(error, 'compat classification-summary GET');
  }
}
