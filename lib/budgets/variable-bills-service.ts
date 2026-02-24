import Decimal from 'decimal.js';

import { listBillTemplates, listOccurrences } from '@/lib/bills-v2/service';
import { getMonthRangeForYearMonth, toLocalDateString } from '@/lib/utils/local-date';

type LegacyBillStatus = 'pending' | 'paid' | 'overdue' | 'skipped';

interface OccurrenceLike {
  id: string;
  templateId: string;
  dueDate: string;
  status: 'unpaid' | 'partial' | 'paid' | 'overpaid' | 'overdue' | 'skipped';
  amountDueCents: number;
  amountPaidCents: number;
  actualAmountCents: number | null;
  paidDate: string | null;
}

interface TemplateLike {
  id: string;
  name: string;
  recurrenceType: string;
  defaultAmountCents: number;
}

interface MonthAggregate {
  month: string;
  expected: number;
  actualKnown: number;
  hasAnyActual: boolean;
  status: LegacyBillStatus | null;
  settled: boolean;
  dueDate: string | null;
  paidDate: string | null;
  instanceIds: string[];
}

export interface VariableBillData {
  id: string;
  name: string;
  frequency: string | null;
  expectedAmount: number;
  currentMonth: {
    month: string;
    instanceId: string | null;
    expectedAmount: number;
    actualAmount: number | null;
    variance: number | null;
    variancePercent: number | null;
    status: LegacyBillStatus;
    dueDate: string;
    paidDate: string | null;
  };
  historicalAverages: {
    threeMonth: number | null;
    sixMonth: number | null;
    twelveMonth: number | null;
    allTime: number | null;
  };
  monthlyBreakdown: Array<{
    month: string;
    expected: number;
    actual: number | null;
    variance: number | null;
    status: LegacyBillStatus | null;
  }>;
  trend: {
    direction: 'improving' | 'worsening' | 'stable';
    percentChange: number;
    recommendedBudget: number;
  };
}

export interface VariableBillSummary {
  totalExpected: number;
  totalActual: number;
  totalVariance: number;
  variancePercent: number;
  billCount: number;
  paidCount: number;
  pendingCount: number;
}

export interface VariableBillsResponse {
  month: string;
  summary: VariableBillSummary;
  bills: VariableBillData[];
}

function centsToAmount(cents: number): number {
  return new Decimal(cents).div(100).toDecimalPlaces(2).toNumber();
}

function amountToCents(amount: number): number {
  return new Decimal(amount).times(100).toDecimalPlaces(0).toNumber();
}

function asMonthKey(dateValue: string): string {
  const parsed = new Date(dateValue);
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
}

function roundMoney(value: number): number {
  return new Decimal(value).toDecimalPlaces(2).toNumber();
}

function mapOccurrenceStatus(status: OccurrenceLike['status']): LegacyBillStatus {
  if (status === 'paid' || status === 'overpaid') return 'paid';
  if (status === 'overdue') return 'overdue';
  if (status === 'skipped') return 'skipped';
  return 'pending';
}

function combineStatuses(statuses: LegacyBillStatus[]): LegacyBillStatus {
  if (statuses.includes('overdue')) return 'overdue';
  if (statuses.includes('pending')) return 'pending';
  if (statuses.includes('paid')) return 'paid';
  return 'skipped';
}

function calculateAverage(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((acc, value) => acc.plus(value), new Decimal(0));
  return sum.div(values.length).toDecimalPlaces(2).toNumber();
}

function calculateTrend(monthlyPaidTotalsDesc: number[]): {
  direction: 'improving' | 'worsening' | 'stable';
  percentChange: number;
} {
  if (monthlyPaidTotalsDesc.length < 4) {
    return { direction: 'stable', percentChange: 0 };
  }

  const recent3 = monthlyPaidTotalsDesc.slice(0, 3);
  const previous3 = monthlyPaidTotalsDesc.slice(3, 6);
  if (previous3.length === 0) {
    return { direction: 'stable', percentChange: 0 };
  }

  const recentAvg = calculateAverage(recent3);
  const previousAvg = calculateAverage(previous3);
  if (recentAvg === null || previousAvg === null || previousAvg === 0) {
    return { direction: 'stable', percentChange: 0 };
  }

  const percentChange = new Decimal(recentAvg)
    .minus(previousAvg)
    .div(previousAvg)
    .times(100)
    .toDecimalPlaces(1)
    .toNumber();

  if (percentChange < -5) return { direction: 'improving', percentChange };
  if (percentChange > 5) return { direction: 'worsening', percentChange };
  return { direction: 'stable', percentChange };
}

function calculateRecommendedBudget(
  monthlyPaidTotalsDesc: number[],
  trendDirection: 'improving' | 'worsening' | 'stable',
  currentExpected: number
): number {
  const sixMonthAvg = calculateAverage(monthlyPaidTotalsDesc.slice(0, 6));
  if (sixMonthAvg === null) return roundMoney(currentExpected);

  const bufferMultiplier = trendDirection === 'worsening' ? 1.15 : 1.1;
  return new Decimal(sixMonthAvg).times(bufferMultiplier).toDecimalPlaces(2).toNumber();
}

function buildMonthKeys(startYear: number, startMonth: number, count: number): string[] {
  const keys: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const date = new Date(startYear, startMonth - 1 + index, 1);
    keys.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

function aggregateOccurrencesByMonth(occurrences: OccurrenceLike[]): Map<string, MonthAggregate> {
  const byMonth = new Map<string, MonthAggregate>();

  for (const occurrence of occurrences) {
    const month = asMonthKey(occurrence.dueDate);
    const existing = byMonth.get(month) || {
      month,
      expected: 0,
      actualKnown: 0,
      hasAnyActual: false,
      status: null,
      settled: true,
      dueDate: null,
      paidDate: null,
      instanceIds: [],
    };

    const expectedAmount = centsToAmount(occurrence.amountDueCents);
    existing.expected = new Decimal(existing.expected).plus(expectedAmount).toNumber();

    const actualCents = occurrence.actualAmountCents ?? (occurrence.amountPaidCents > 0 ? occurrence.amountPaidCents : null);
    if (actualCents !== null) {
      existing.actualKnown = new Decimal(existing.actualKnown).plus(centsToAmount(actualCents)).toNumber();
      existing.hasAnyActual = true;
    }

    const mappedStatus = mapOccurrenceStatus(occurrence.status);
    existing.status = existing.status ? combineStatuses([existing.status, mappedStatus]) : mappedStatus;
    existing.settled =
      existing.settled && ['paid', 'overpaid', 'skipped'].includes(occurrence.status);
    existing.instanceIds.push(occurrence.id);

    if (existing.dueDate === null || occurrence.dueDate < existing.dueDate) {
      existing.dueDate = occurrence.dueDate;
    }
    if (occurrence.paidDate && (existing.paidDate === null || occurrence.paidDate > existing.paidDate)) {
      existing.paidDate = occurrence.paidDate;
    }

    byMonth.set(month, existing);
  }

  return byMonth;
}

export async function getVariableBillsTrackingData(options: {
  userId: string;
  householdId: string;
  year: number;
  month: number;
  billId?: string | null;
}): Promise<VariableBillsResponse> {
  const { userId, householdId, year, month, billId } = options;
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const { startDate: monthStart, endDate: monthEnd } = getMonthRangeForYearMonth(year, month);
  const historyStart = toLocalDateString(new Date(year, month - 12, 1));

  const templatesResult = await listBillTemplates({
    householdId,
    isActive: true,
    billType: 'expense',
    limit: 5000,
    offset: 0,
  });

  const variableTemplates = templatesResult.data.filter((template) =>
    template.isVariableAmount && (!billId || template.id === billId)
  );

  if (variableTemplates.length === 0) {
    return {
      month: monthKey,
      summary: {
        totalExpected: 0,
        totalActual: 0,
        totalVariance: 0,
        variancePercent: 0,
        billCount: 0,
        paidCount: 0,
        pendingCount: 0,
      },
      bills: [],
    };
  }

  const templateIds = new Set(variableTemplates.map((template) => template.id));
  const occurrencesResult = await listOccurrences({
    userId,
    householdId,
    billType: 'expense',
    from: historyStart,
    to: monthEnd,
    limit: 10000,
    offset: 0,
  });

  const occurrencesByTemplate = new Map<string, OccurrenceLike[]>();
  for (const row of occurrencesResult.data) {
    if (!templateIds.has(row.occurrence.templateId)) continue;
    const existing = occurrencesByTemplate.get(row.occurrence.templateId) || [];
    existing.push(row.occurrence as OccurrenceLike);
    occurrencesByTemplate.set(row.occurrence.templateId, existing);
  }

  const monthKeys = buildMonthKeys(year, month - 11, 12);
  const bills: VariableBillData[] = [];
  let summaryTotalExpected = new Decimal(0);
  let summaryTotalActual = new Decimal(0);
  let summaryPaidCount = 0;
  let summaryPendingCount = 0;

  for (const template of variableTemplates as TemplateLike[]) {
    const templateOccurrences = (occurrencesByTemplate.get(template.id) || []).sort((a, b) =>
      a.dueDate.localeCompare(b.dueDate)
    );
    const monthMap = aggregateOccurrencesByMonth(templateOccurrences);
    const currentMonthAggregate = monthMap.get(monthKey) || null;

    const expectedAmountCurrent = currentMonthAggregate
      ? roundMoney(currentMonthAggregate.expected)
      : centsToAmount(template.defaultAmountCents);

    const currentStatus = currentMonthAggregate?.status || 'pending';
    const currentActual = currentMonthAggregate?.hasAnyActual
      ? roundMoney(currentMonthAggregate.actualKnown)
      : null;
    const shouldComputeVariance =
      Boolean(currentMonthAggregate?.settled) && currentActual !== null;
    const variance = shouldComputeVariance
      ? new Decimal(currentActual).minus(expectedAmountCurrent).toDecimalPlaces(2).toNumber()
      : null;
    const variancePercent =
      variance !== null && expectedAmountCurrent > 0
        ? new Decimal(variance).div(expectedAmountCurrent).times(100).toDecimalPlaces(1).toNumber()
        : null;

    const settledPaidMonthsDesc = Array.from(monthMap.values())
      .filter((value) => value.settled && value.hasAnyActual)
      .sort((left, right) => right.month.localeCompare(left.month))
      .map((value) => roundMoney(value.actualKnown));

    const trend = calculateTrend(settledPaidMonthsDesc);
    const recommendedBudget = calculateRecommendedBudget(
      settledPaidMonthsDesc,
      trend.direction,
      expectedAmountCurrent
    );

    const monthlyBreakdown = monthKeys.map((monthItem) => {
      const aggregate = monthMap.get(monthItem) || null;
      const expected = aggregate ? roundMoney(aggregate.expected) : 0;
      const actual = aggregate?.hasAnyActual ? roundMoney(aggregate.actualKnown) : null;
      const varianceValue =
        actual !== null
          ? new Decimal(actual).minus(expected).toDecimalPlaces(2).toNumber()
          : null;
      return {
        month: monthItem,
        expected,
        actual,
        variance: varianceValue,
        status: aggregate?.status || null,
      };
    });

    bills.push({
      id: template.id,
      name: template.name,
      frequency: template.recurrenceType || null,
      expectedAmount: centsToAmount(template.defaultAmountCents),
      currentMonth: {
        month: monthKey,
        instanceId: currentMonthAggregate?.instanceIds?.[0] || null,
        expectedAmount: expectedAmountCurrent,
        actualAmount: currentActual,
        variance,
        variancePercent,
        status: currentStatus,
        dueDate: currentMonthAggregate?.dueDate || monthStart,
        paidDate: currentMonthAggregate?.paidDate || null,
      },
      historicalAverages: {
        threeMonth: calculateAverage(settledPaidMonthsDesc.slice(0, 3)),
        sixMonth: calculateAverage(settledPaidMonthsDesc.slice(0, 6)),
        twelveMonth: calculateAverage(settledPaidMonthsDesc.slice(0, 12)),
        allTime: calculateAverage(settledPaidMonthsDesc),
      },
      monthlyBreakdown,
      trend: {
        direction: trend.direction,
        percentChange: trend.percentChange,
        recommendedBudget,
      },
    });

    summaryTotalExpected = summaryTotalExpected.plus(amountToCents(expectedAmountCurrent));
    if (currentActual !== null) {
      summaryTotalActual = summaryTotalActual.plus(amountToCents(currentActual));
      summaryPaidCount += 1;
    } else {
      summaryPendingCount += 1;
    }
  }

  const totalExpected = centsToAmount(summaryTotalExpected.toNumber());
  const totalActual = centsToAmount(summaryTotalActual.toNumber());
  const totalVariance = roundMoney(new Decimal(totalActual).minus(totalExpected).toNumber());
  const variancePercent =
    totalExpected > 0
      ? new Decimal(totalVariance).div(totalExpected).times(100).toDecimalPlaces(1).toNumber()
      : 0;

  return {
    month: monthKey,
    summary: {
      totalExpected,
      totalActual,
      totalVariance,
      variancePercent,
      billCount: bills.length,
      paidCount: summaryPaidCount,
      pendingCount: summaryPendingCount,
    },
    bills,
  };
}
