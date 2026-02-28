import { addDays, addMonths, endOfDay, format, getDay, isAfter, isBefore, parseISO, startOfDay, subDays } from 'date-fns';
import Decimal from 'decimal.js';
import { nanoid } from 'nanoid';
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  lt,
  lte,
  ne,
  sql,
} from 'drizzle-orm';

import type {
  AutopayRunResultDto,
  BillOccurrenceAllocationDto,
  BillOccurrenceDto,
  BillOccurrenceWithTemplateDto,
  BillPaymentEventDto,
  BillsDashboardSummaryDto,
  BillTemplateDto,
  CreateBillTemplateRequest,
  PayOccurrenceRequest,
  PayOccurrenceResponse,
  UpdateBillTemplateRequest,
  UpdateOccurrenceAllocationsRequest,
} from '@/lib/bills/contracts';
import { db } from '@/lib/db';
import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import {
  accounts,
  autopayRules,
  autopayRuns,
  billOccurrenceAllocations,
  billOccurrences,
  billPaymentEvents,
  billTemplates,
  userHouseholdPreferences,
} from '@/lib/db/schema';
import {
  type BudgetCycleFrequency,
  type BudgetPeriod,
  type BudgetScheduleSettings,
  getCurrentBudgetPeriod,
  getDefaultBudgetScheduleSettings,
  getNextBudgetPeriod,
} from '@/lib/budgets/budget-schedule';
import {
  dueDateMatchesPeriodMonth,
  instanceBelongsToPeriod,
} from '@/lib/budgets/bill-period-assignment';
import {
  getAccountBalanceCents,
  insertTransactionMovement,
  updateScopedAccountBalance,
} from '@/lib/transactions/money-movement-service';

const TEMPLATE_LIMIT_DEFAULT = 50;
const OCCURRENCE_LIMIT_DEFAULT = 50;

const RECURRENCE_MONTH_STEP: Record<
  BillTemplateDto['recurrenceType'],
  number
> = {
  one_time: 0,
  weekly: 0,
  biweekly: 0,
  monthly: 1,
  quarterly: 3,
  semi_annual: 6,
  annual: 12,
};

const RECURRENCE_HORIZON_COUNT: Record<
  BillTemplateDto['recurrenceType'],
  number
> = {
  one_time: 1,
  weekly: 18,
  biweekly: 12,
  monthly: 8,
  quarterly: 8,
  semi_annual: 6,
  annual: 4,
};

const OUTSTANDING_OCCURRENCE_STATUSES: BillOccurrenceDto['status'][] = ['unpaid', 'partial', 'overdue'];

type TemplateRow = typeof billTemplates.$inferSelect;
type OccurrenceRow = typeof billOccurrences.$inferSelect;
type AllocationRow = typeof billOccurrenceAllocations.$inferSelect;
type PaymentEventRow = typeof billPaymentEvents.$inferSelect;

type OccurrenceWithTemplateRow = {
  occurrence: OccurrenceRow;
  template: TemplateRow;
};

export interface ListTemplatesOptions {
  householdId: string;
  isActive?: boolean;
  billType?: BillTemplateDto['billType'];
  classification?: BillTemplateDto['classification'];
  limit?: number;
  offset?: number;
}

export interface ListOccurrencesOptions {
  userId: string;
  householdId: string;
  status?: BillOccurrenceDto['status'][];
  from?: string;
  to?: string;
  periodOffset?: number;
  billType?: BillTemplateDto['billType'];
  limit?: number;
  offset?: number;
}

export interface RunAutopayOptions {
  userId: string;
  householdId: string;
  runDate?: string;
  runType?: 'scheduled' | 'manual' | 'dry_run';
  dryRun?: boolean;
}

function nowIso() {
  return new Date().toISOString();
}

function todayYmd(referenceDate: Date = new Date()): string {
  return format(referenceDate, 'yyyy-MM-dd');
}

function parseDateOrThrow(value: string, field: string): Date {
  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${field}`);
  }
  return parsed;
}

function normalizeLimit(value: number | undefined, fallback: number): number {
  if (!value || Number.isNaN(value)) return fallback;
  return Math.min(Math.max(value, 1), 500);
}

function normalizeOffset(value: number | undefined): number {
  if (!value || Number.isNaN(value)) return 0;
  return Math.max(value, 0);
}

function toBillTemplateDto(row: TemplateRow): BillTemplateDto {
  return {
    id: row.id,
    householdId: row.householdId,
    createdByUserId: row.createdByUserId,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    billType: row.billType,
    classification: row.classification,
    classificationSubcategory: row.classificationSubcategory,
    recurrenceType: row.recurrenceType,
    recurrenceDueDay: row.recurrenceDueDay,
    recurrenceDueWeekday: row.recurrenceDueWeekday,
    recurrenceSpecificDueDate: row.recurrenceSpecificDueDate,
    recurrenceStartMonth: row.recurrenceStartMonth,
    defaultAmountCents: row.defaultAmountCents,
    isVariableAmount: row.isVariableAmount,
    amountToleranceBps: row.amountToleranceBps,
    categoryId: row.categoryId,
    merchantId: row.merchantId,
    paymentAccountId: row.paymentAccountId,
    linkedLiabilityAccountId: row.linkedLiabilityAccountId,
    chargedToAccountId: row.chargedToAccountId,
    autoMarkPaid: row.autoMarkPaid,
    notes: row.notes,
    debtEnabled: row.debtEnabled,
    debtOriginalBalanceCents: row.debtOriginalBalanceCents,
    debtRemainingBalanceCents: row.debtRemainingBalanceCents,
    debtInterestAprBps: row.debtInterestAprBps,
    debtInterestType: row.debtInterestType,
    debtStartDate: row.debtStartDate,
    debtColor: row.debtColor,
    includeInPayoffStrategy: row.includeInPayoffStrategy,
    interestTaxDeductible: row.interestTaxDeductible,
    interestTaxDeductionType: row.interestTaxDeductionType,
    interestTaxDeductionLimitCents: row.interestTaxDeductionLimitCents,
    budgetPeriodAssignment: row.budgetPeriodAssignment,
    splitAcrossPeriods: row.splitAcrossPeriods,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toOccurrenceDto(row: OccurrenceRow): BillOccurrenceDto {
  return {
    id: row.id,
    templateId: row.templateId,
    householdId: row.householdId,
    dueDate: row.dueDate,
    status: row.status,
    amountDueCents: row.amountDueCents,
    amountPaidCents: row.amountPaidCents,
    amountRemainingCents: row.amountRemainingCents,
    actualAmountCents: row.actualAmountCents,
    paidDate: row.paidDate,
    lastTransactionId: row.lastTransactionId,
    daysLate: row.daysLate,
    lateFeeCents: row.lateFeeCents,
    isManualOverride: row.isManualOverride,
    budgetPeriodOverride: row.budgetPeriodOverride,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toAllocationDto(row: AllocationRow): BillOccurrenceAllocationDto {
  return {
    id: row.id,
    occurrenceId: row.occurrenceId,
    templateId: row.templateId,
    householdId: row.householdId,
    periodNumber: row.periodNumber,
    allocatedAmountCents: row.allocatedAmountCents,
    paidAmountCents: row.paidAmountCents,
    isPaid: row.isPaid,
    paymentEventId: row.paymentEventId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toPaymentEventDto(row: PaymentEventRow): BillPaymentEventDto {
  return {
    id: row.id,
    householdId: row.householdId,
    templateId: row.templateId,
    occurrenceId: row.occurrenceId,
    transactionId: row.transactionId,
    amountCents: row.amountCents,
    principalCents: row.principalCents,
    interestCents: row.interestCents,
    balanceBeforeCents: row.balanceBeforeCents,
    balanceAfterCents: row.balanceAfterCents,
    paymentDate: row.paymentDate,
    paymentMethod: row.paymentMethod,
    sourceAccountId: row.sourceAccountId,
    idempotencyKey: row.idempotencyKey,
    notes: row.notes,
    createdAt: row.createdAt,
  };
}

function normalizeTemplatePatch(
  input: UpdateBillTemplateRequest | CreateBillTemplateRequest,
  mode: 'create' | 'update'
) {
  if (mode === 'create') {
    const createInput = input as CreateBillTemplateRequest;
    if (!createInput.name?.trim()) {
      throw new Error('Template name is required');
    }
    if (createInput.defaultAmountCents === undefined || createInput.defaultAmountCents < 0) {
      throw new Error('defaultAmountCents must be >= 0');
    }
    if (!createInput.billType) {
      throw new Error('billType is required');
    }
    if (!createInput.classification) {
      throw new Error('classification is required');
    }
    if (!createInput.recurrenceType) {
      throw new Error('recurrenceType is required');
    }
  }

  const recurrenceType = input.recurrenceType;
  const recurrenceDueDay = input.recurrenceDueDay;
  const recurrenceDueWeekday = input.recurrenceDueWeekday;

  if (recurrenceType === 'one_time' && input.recurrenceSpecificDueDate) {
    parseDateOrThrow(input.recurrenceSpecificDueDate, 'recurrenceSpecificDueDate');
  }

  if (recurrenceType === 'one_time' && mode === 'create' && !input.recurrenceSpecificDueDate) {
    throw new Error('recurrenceSpecificDueDate is required for one_time recurrence');
  }

  if ((recurrenceType === 'weekly' || recurrenceType === 'biweekly') && recurrenceDueWeekday === undefined) {
    throw new Error('recurrenceDueWeekday is required for weekly/biweekly recurrence');
  }

  if ((recurrenceType === 'weekly' || recurrenceType === 'biweekly') && recurrenceDueWeekday != null) {
    if (recurrenceDueWeekday < 0 || recurrenceDueWeekday > 6) {
      throw new Error('recurrenceDueWeekday must be between 0 and 6');
    }
  }

  if (
    recurrenceType &&
    recurrenceType !== 'one_time' &&
    recurrenceType !== 'weekly' &&
    recurrenceType !== 'biweekly' &&
    recurrenceDueDay != null
  ) {
    if (recurrenceDueDay < 1 || recurrenceDueDay > 31) {
      throw new Error('recurrenceDueDay must be between 1 and 31');
    }
  }

  if (
    (recurrenceType === 'quarterly' || recurrenceType === 'semi_annual' || recurrenceType === 'annual') &&
    input.recurrenceStartMonth !== undefined &&
    input.recurrenceStartMonth !== null &&
    (input.recurrenceStartMonth < 0 || input.recurrenceStartMonth > 11)
  ) {
    throw new Error('recurrenceStartMonth must be between 0 and 11');
  }

  if (input.amountToleranceBps !== undefined && input.amountToleranceBps < 0) {
    throw new Error('amountToleranceBps must be >= 0');
  }
}

function monthDate(year: number, monthIndex: number, dayOfMonth: number): Date {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(dayOfMonth, daysInMonth));
}

function generateOccurrenceDates(
  template: TemplateRow,
  fromDate: Date,
  toDate: Date
): string[] {
  const dates: string[] = [];
  const from = startOfDay(fromDate);
  const to = endOfDay(toDate);

  if (template.recurrenceType === 'one_time') {
    if (!template.recurrenceSpecificDueDate) return dates;
    const dueDate = parseDateOrThrow(template.recurrenceSpecificDueDate, 'recurrenceSpecificDueDate');
    if ((isAfter(dueDate, from) || dueDate.getTime() === from.getTime()) && !isAfter(dueDate, to)) {
      dates.push(format(dueDate, 'yyyy-MM-dd'));
    }
    return dates;
  }

  if (template.recurrenceType === 'weekly' || template.recurrenceType === 'biweekly') {
    const weekday = template.recurrenceDueWeekday;
    if (weekday === null || weekday === undefined) return dates;

    const stepDays = template.recurrenceType === 'weekly' ? 7 : 14;
    const first = addDays(from, (weekday - getDay(from) + 7) % 7);

    for (
      let current = first;
      !isAfter(current, to) && dates.length < RECURRENCE_HORIZON_COUNT[template.recurrenceType];
      current = addDays(current, stepDays)
    ) {
      dates.push(format(current, 'yyyy-MM-dd'));
    }

    return dates;
  }

  const dayOfMonth = template.recurrenceDueDay;
  if (!dayOfMonth) return dates;

  const monthStep = RECURRENCE_MONTH_STEP[template.recurrenceType];
  if (!monthStep) return dates;

  let cursorYear = from.getFullYear();
  let cursorMonth = from.getMonth();

  if (
    (template.recurrenceType === 'quarterly' ||
      template.recurrenceType === 'semi_annual' ||
      template.recurrenceType === 'annual') &&
    template.recurrenceStartMonth !== null
  ) {
    cursorMonth = template.recurrenceStartMonth;
    if (cursorMonth < from.getMonth()) {
      cursorYear += 1;
    }
  }

  let current = monthDate(cursorYear, cursorMonth, dayOfMonth);
  let safetyCounter = 0;

  while (isBefore(current, from) && safetyCounter < 120) {
    current = addMonths(current, monthStep);
    safetyCounter += 1;
  }

  safetyCounter = 0;
  const maxCount = RECURRENCE_HORIZON_COUNT[template.recurrenceType];
  while (!isAfter(current, to) && dates.length < maxCount && safetyCounter < 120) {
    dates.push(format(current, 'yyyy-MM-dd'));
    current = addMonths(current, monthStep);
    safetyCounter += 1;
  }

  return dates;
}

function getDefaultOccurrenceAmountCents(template: TemplateRow): number {
  return Math.max(0, template.defaultAmountCents);
}

async function ensureTemplateOccurrences(
  template: TemplateRow,
  fromDate: Date,
  toDate: Date
) {
  if (!template.isActive) return;

  const candidateDueDates = generateOccurrenceDates(template, fromDate, toDate);
  if (candidateDueDates.length === 0) return;

  const existing = await db
    .select({ dueDate: billOccurrences.dueDate })
    .from(billOccurrences)
    .where(eq(billOccurrences.templateId, template.id));

  const existingDueDateSet = new Set(existing.map((row) => row.dueDate));
  const now = nowIso();

  const inserts = candidateDueDates
    .filter((dueDate) => !existingDueDateSet.has(dueDate))
    .map((dueDate) => {
      const amountDueCents = getDefaultOccurrenceAmountCents(template);
      return {
        id: nanoid(),
        templateId: template.id,
        householdId: template.householdId,
        dueDate,
        status: 'unpaid' as const,
        amountDueCents,
        amountPaidCents: 0,
        amountRemainingCents: amountDueCents,
        actualAmountCents: null,
        paidDate: null,
        lastTransactionId: null,
        daysLate: 0,
        lateFeeCents: 0,
        isManualOverride: false,
        budgetPeriodOverride: null,
        notes: null,
        createdAt: now,
        updatedAt: now,
      };
    });

  if (inserts.length > 0) {
    await db.insert(billOccurrences).values(inserts);

    if (template.budgetPeriodAssignment !== null) {
      const createdRows = await db
        .select()
        .from(billOccurrences)
        .where(
          and(
            eq(billOccurrences.templateId, template.id),
            inArray(
              billOccurrences.dueDate,
              inserts.map((row) => row.dueDate)
            )
          )
        );

      const allocationInserts = createdRows.map((occurrence) => ({
        id: nanoid(),
        occurrenceId: occurrence.id,
        templateId: template.id,
        householdId: template.householdId,
        periodNumber: template.budgetPeriodAssignment as number,
        allocatedAmountCents: occurrence.amountDueCents,
        paidAmountCents: 0,
        isPaid: false,
        paymentEventId: null,
        createdAt: now,
        updatedAt: now,
      }));

      if (allocationInserts.length > 0) {
        await db.insert(billOccurrenceAllocations).values(allocationInserts);
      }
    }
  }
}

async function ensureOccurrencesForHousehold(
  householdId: string,
  windowStart: Date,
  windowEnd: Date,
  billType?: BillTemplateDto['billType']
) {
  const whereConditions = [eq(billTemplates.householdId, householdId), eq(billTemplates.isActive, true)];
  if (billType) {
    whereConditions.push(eq(billTemplates.billType, billType));
  }

  const templates = await db
    .select()
    .from(billTemplates)
    .where(and(...whereConditions));

  await Promise.all(templates.map((template) => ensureTemplateOccurrences(template, windowStart, windowEnd)));
}

async function refreshOccurrenceStatuses(householdId: string) {
  const today = todayYmd();

  const shouldBeOverdue = await db
    .select()
    .from(billOccurrences)
    .where(
      and(
        eq(billOccurrences.householdId, householdId),
        inArray(billOccurrences.status, ['unpaid', 'partial']),
        lt(billOccurrences.dueDate, today),
        ne(billOccurrences.amountRemainingCents, 0)
      )
    );

  const now = nowIso();
  if (shouldBeOverdue.length > 0) {
    await Promise.all(
      shouldBeOverdue.map((row) => {
        const due = parseDateOrThrow(row.dueDate, 'dueDate');
        const dayDiff = Math.max(
          0,
          Math.floor((startOfDay(new Date()).getTime() - startOfDay(due).getTime()) / (24 * 60 * 60 * 1000))
        );

        return db
          .update(billOccurrences)
          .set({ status: 'overdue', daysLate: dayDiff, updatedAt: now })
          .where(eq(billOccurrences.id, row.id));
      })
    );
  }

  const shouldBeCurrent = await db
    .select()
    .from(billOccurrences)
    .where(
      and(
        eq(billOccurrences.householdId, householdId),
        eq(billOccurrences.status, 'overdue'),
        gte(billOccurrences.dueDate, today)
      )
    );

  if (shouldBeCurrent.length > 0) {
    await Promise.all(
      shouldBeCurrent.map((row) => {
        const status = row.amountRemainingCents <= 0 ? 'paid' : row.amountPaidCents > 0 ? 'partial' : 'unpaid';
        return db
          .update(billOccurrences)
          .set({ status, daysLate: 0, updatedAt: now })
          .where(eq(billOccurrences.id, row.id));
      })
    );
  }
}

async function getBudgetSettings(userId: string, householdId: string): Promise<BudgetScheduleSettings> {
  const [prefs] = await db
    .select()
    .from(userHouseholdPreferences)
    .where(
      and(
        eq(userHouseholdPreferences.userId, userId),
        eq(userHouseholdPreferences.householdId, householdId)
      )
    )
    .limit(1);

  const defaults = getDefaultBudgetScheduleSettings();
  if (!prefs) {
    return defaults;
  }

  return {
    budgetCycleFrequency: (prefs.budgetCycleFrequency as BudgetCycleFrequency) || defaults.budgetCycleFrequency,
    budgetCycleStartDay: prefs.budgetCycleStartDay ?? defaults.budgetCycleStartDay,
    budgetCycleReferenceDate: prefs.budgetCycleReferenceDate ?? defaults.budgetCycleReferenceDate,
    budgetCycleSemiMonthlyDays: prefs.budgetCycleSemiMonthlyDays ?? defaults.budgetCycleSemiMonthlyDays,
    budgetPeriodRollover: prefs.budgetPeriodRollover ?? defaults.budgetPeriodRollover,
    budgetPeriodManualAmount: prefs.budgetPeriodManualAmount ?? defaults.budgetPeriodManualAmount,
  };
}

function getPeriodByOffset(settings: BudgetScheduleSettings, offset: number): BudgetPeriod {
  let period = getCurrentBudgetPeriod(settings);

  if (offset > 0) {
    for (let i = 0; i < offset; i += 1) {
      period = getNextBudgetPeriod(settings, period.end);
    }
  } else if (offset < 0) {
    for (let i = 0; i < Math.abs(offset); i += 1) {
      period = getCurrentBudgetPeriod(settings, subDays(period.start, 1));
    }
  }

  return period;
}

async function loadAllocationsByOccurrenceIds(occurrenceIds: string[]) {
  if (occurrenceIds.length === 0) {
    return new Map<string, AllocationRow[]>();
  }

  const allocations = await db
    .select()
    .from(billOccurrenceAllocations)
    .where(inArray(billOccurrenceAllocations.occurrenceId, occurrenceIds))
    .orderBy(asc(billOccurrenceAllocations.periodNumber));

  const allocationMap = new Map<string, AllocationRow[]>();
  for (const allocation of allocations) {
    const rows = allocationMap.get(allocation.occurrenceId) || [];
    rows.push(allocation);
    allocationMap.set(allocation.occurrenceId, rows);
  }

  return allocationMap;
}

function occurrenceMatchesPeriod(
  row: OccurrenceWithTemplateRow,
  allocations: AllocationRow[],
  settings: BudgetScheduleSettings,
  period: BudgetPeriod
) {
  if (allocations.length > 0) {
    const hasCurrentPeriodAllocation = allocations.some((allocation) => allocation.periodNumber === period.periodNumber);
    return hasCurrentPeriodAllocation && dueDateMatchesPeriodMonth(row.occurrence.dueDate, period);
  }

  return instanceBelongsToPeriod({
    dueDate: row.occurrence.dueDate,
    settings,
    period,
    billPeriodAssignment: row.template.budgetPeriodAssignment,
    instancePeriodOverride: row.occurrence.budgetPeriodOverride,
  });
}

export async function listBillTemplates(options: ListTemplatesOptions) {
  const limit = normalizeLimit(options.limit, TEMPLATE_LIMIT_DEFAULT);
  const offset = normalizeOffset(options.offset);

  const filters = [eq(billTemplates.householdId, options.householdId)];
  if (options.isActive !== undefined) {
    filters.push(eq(billTemplates.isActive, options.isActive));
  }
  if (options.billType) {
    filters.push(eq(billTemplates.billType, options.billType));
  }
  if (options.classification) {
    filters.push(eq(billTemplates.classification, options.classification));
  }

  const whereClause = and(...filters);

  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(billTemplates)
      .where(whereClause)
      .orderBy(desc(billTemplates.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(billTemplates)
      .where(whereClause),
  ]);

  return {
    data: rows.map(toBillTemplateDto),
    total: Number(countRows[0]?.count ?? 0),
    limit,
    offset,
  };
}

export async function createBillTemplate(
  userId: string,
  householdId: string,
  input: CreateBillTemplateRequest
): Promise<BillTemplateDto> {
  normalizeTemplatePatch(input, 'create');

  const now = nowIso();
  const templateId = nanoid();

  await db.insert(billTemplates).values({
    id: templateId,
    householdId,
    createdByUserId: userId,
    name: input.name.trim(),
    description: input.description ?? null,
    isActive: input.isActive ?? true,
    billType: input.billType,
    classification: input.classification,
    classificationSubcategory: input.classificationSubcategory ?? null,
    recurrenceType: input.recurrenceType,
    recurrenceDueDay: input.recurrenceDueDay ?? null,
    recurrenceDueWeekday: input.recurrenceDueWeekday ?? null,
    recurrenceSpecificDueDate: input.recurrenceSpecificDueDate ?? null,
    recurrenceStartMonth: input.recurrenceStartMonth ?? null,
    defaultAmountCents: Math.max(0, input.defaultAmountCents),
    isVariableAmount: input.isVariableAmount ?? false,
    amountToleranceBps: input.amountToleranceBps ?? 500,
    categoryId: input.categoryId ?? null,
    merchantId: input.merchantId ?? null,
    paymentAccountId: input.paymentAccountId ?? null,
    linkedLiabilityAccountId: input.linkedLiabilityAccountId ?? null,
    chargedToAccountId: input.chargedToAccountId ?? null,
    autoMarkPaid: input.autoMarkPaid ?? true,
    notes: input.notes ?? null,
    debtEnabled: input.debtEnabled ?? false,
    debtOriginalBalanceCents: input.debtOriginalBalanceCents ?? null,
    debtRemainingBalanceCents: input.debtRemainingBalanceCents ?? null,
    debtInterestAprBps: input.debtInterestAprBps ?? null,
    debtInterestType: input.debtInterestType ?? null,
    debtStartDate: input.debtStartDate ?? null,
    debtColor: input.debtColor ?? null,
    includeInPayoffStrategy: input.includeInPayoffStrategy ?? true,
    interestTaxDeductible: input.interestTaxDeductible ?? false,
    interestTaxDeductionType: input.interestTaxDeductionType ?? 'none',
    interestTaxDeductionLimitCents: input.interestTaxDeductionLimitCents ?? null,
    budgetPeriodAssignment: input.budgetPeriodAssignment ?? null,
    splitAcrossPeriods: input.splitAcrossPeriods ?? false,
    createdAt: now,
    updatedAt: now,
  });

  const [created] = await db
    .select()
    .from(billTemplates)
    .where(eq(billTemplates.id, templateId))
    .limit(1);

  if (!created) {
    throw new Error('Failed to create template');
  }

  await ensureTemplateOccurrences(created, addDays(new Date(), -45), addDays(new Date(), 180));
  return toBillTemplateDto(created);
}

export async function updateBillTemplate(
  templateId: string,
  householdId: string,
  input: UpdateBillTemplateRequest
): Promise<BillTemplateDto> {
  normalizeTemplatePatch(input, 'update');

  const [existing] = await db
    .select()
    .from(billTemplates)
    .where(and(eq(billTemplates.id, templateId), eq(billTemplates.householdId, householdId)))
    .limit(1);

  if (!existing) {
    throw new Error('Template not found');
  }

  const nextValues: Partial<typeof billTemplates.$inferInsert> = {
    updatedAt: nowIso(),
  };

  if (input.name !== undefined) nextValues.name = input.name.trim();
  if (input.description !== undefined) nextValues.description = input.description;
  if (input.isActive !== undefined) nextValues.isActive = input.isActive;
  if (input.billType !== undefined) nextValues.billType = input.billType;
  if (input.classification !== undefined) nextValues.classification = input.classification;
  if (input.classificationSubcategory !== undefined) {
    nextValues.classificationSubcategory = input.classificationSubcategory;
  }
  if (input.recurrenceType !== undefined) nextValues.recurrenceType = input.recurrenceType;
  if (input.recurrenceDueDay !== undefined) nextValues.recurrenceDueDay = input.recurrenceDueDay;
  if (input.recurrenceDueWeekday !== undefined) nextValues.recurrenceDueWeekday = input.recurrenceDueWeekday;
  if (input.recurrenceSpecificDueDate !== undefined) {
    nextValues.recurrenceSpecificDueDate = input.recurrenceSpecificDueDate;
  }
  if (input.recurrenceStartMonth !== undefined) nextValues.recurrenceStartMonth = input.recurrenceStartMonth;
  if (input.defaultAmountCents !== undefined) nextValues.defaultAmountCents = Math.max(0, input.defaultAmountCents);
  if (input.isVariableAmount !== undefined) nextValues.isVariableAmount = input.isVariableAmount;
  if (input.amountToleranceBps !== undefined) nextValues.amountToleranceBps = input.amountToleranceBps;
  if (input.categoryId !== undefined) nextValues.categoryId = input.categoryId;
  if (input.merchantId !== undefined) nextValues.merchantId = input.merchantId;
  if (input.paymentAccountId !== undefined) nextValues.paymentAccountId = input.paymentAccountId;
  if (input.linkedLiabilityAccountId !== undefined) {
    nextValues.linkedLiabilityAccountId = input.linkedLiabilityAccountId;
  }
  if (input.chargedToAccountId !== undefined) nextValues.chargedToAccountId = input.chargedToAccountId;
  if (input.autoMarkPaid !== undefined) nextValues.autoMarkPaid = input.autoMarkPaid;
  if (input.notes !== undefined) nextValues.notes = input.notes;
  if (input.debtEnabled !== undefined) nextValues.debtEnabled = input.debtEnabled;
  if (input.debtOriginalBalanceCents !== undefined) {
    nextValues.debtOriginalBalanceCents = input.debtOriginalBalanceCents;
  }
  if (input.debtRemainingBalanceCents !== undefined) {
    nextValues.debtRemainingBalanceCents = input.debtRemainingBalanceCents;
  }
  if (input.debtInterestAprBps !== undefined) nextValues.debtInterestAprBps = input.debtInterestAprBps;
  if (input.debtInterestType !== undefined) nextValues.debtInterestType = input.debtInterestType;
  if (input.debtStartDate !== undefined) nextValues.debtStartDate = input.debtStartDate;
  if (input.debtColor !== undefined) nextValues.debtColor = input.debtColor;
  if (input.includeInPayoffStrategy !== undefined) {
    nextValues.includeInPayoffStrategy = input.includeInPayoffStrategy;
  }
  if (input.interestTaxDeductible !== undefined) {
    nextValues.interestTaxDeductible = input.interestTaxDeductible;
  }
  if (input.interestTaxDeductionType !== undefined) {
    nextValues.interestTaxDeductionType = input.interestTaxDeductionType;
  }
  if (input.interestTaxDeductionLimitCents !== undefined) {
    nextValues.interestTaxDeductionLimitCents = input.interestTaxDeductionLimitCents;
  }
  if (input.budgetPeriodAssignment !== undefined) {
    nextValues.budgetPeriodAssignment = input.budgetPeriodAssignment;
  }
  if (input.splitAcrossPeriods !== undefined) nextValues.splitAcrossPeriods = input.splitAcrossPeriods;

  await db
    .update(billTemplates)
    .set(nextValues)
    .where(and(eq(billTemplates.id, templateId), eq(billTemplates.householdId, householdId)));

  const [updated] = await db
    .select()
    .from(billTemplates)
    .where(and(eq(billTemplates.id, templateId), eq(billTemplates.householdId, householdId)))
    .limit(1);

  if (!updated) {
    throw new Error('Template not found after update');
  }

  await ensureTemplateOccurrences(updated, addDays(new Date(), -45), addDays(new Date(), 180));
  return toBillTemplateDto(updated);
}

export async function deleteBillTemplate(templateId: string, householdId: string) {
  const [existing] = await db
    .select()
    .from(billTemplates)
    .where(and(eq(billTemplates.id, templateId), eq(billTemplates.householdId, householdId)))
    .limit(1);

  if (!existing) {
    throw new Error('Template not found');
  }

  await runInDatabaseTransaction(async (tx) => {
    const occurrences = await tx
      .select({ id: billOccurrences.id })
      .from(billOccurrences)
      .where(eq(billOccurrences.templateId, templateId));

    const occurrenceIds = occurrences.map((row) => row.id);

    if (occurrenceIds.length > 0) {
      await tx
        .delete(billOccurrenceAllocations)
        .where(inArray(billOccurrenceAllocations.occurrenceId, occurrenceIds));
      await tx.delete(billPaymentEvents).where(inArray(billPaymentEvents.occurrenceId, occurrenceIds));
      await tx.delete(billOccurrences).where(inArray(billOccurrences.id, occurrenceIds));
    }

    await tx.delete(autopayRules).where(eq(autopayRules.templateId, templateId));
    await tx.delete(billTemplates).where(eq(billTemplates.id, templateId));
  });
}

function summarizeOccurrences(rows: BillOccurrenceWithTemplateDto[], period: BudgetPeriod | null) {
  const today = todayYmd();

  const overdue = rows.filter((row) => row.occurrence.status === 'overdue');
  const upcoming = rows.filter(
    (row) =>
      OUTSTANDING_OCCURRENCE_STATUSES.includes(row.occurrence.status) &&
      row.occurrence.dueDate >= today
  );

  const paidInPeriod = period
    ? rows.filter(
        (row) =>
          (row.occurrence.status === 'paid' || row.occurrence.status === 'overpaid') &&
          row.occurrence.paidDate !== null &&
          row.occurrence.paidDate >= format(period.start, 'yyyy-MM-dd') &&
          row.occurrence.paidDate <= format(period.end, 'yyyy-MM-dd')
      )
    : rows.filter(
        (row) =>
          (row.occurrence.status === 'paid' || row.occurrence.status === 'overpaid') &&
          row.occurrence.paidDate?.startsWith(today.slice(0, 7))
      );

  const nextDueDate = upcoming
    .map((row) => row.occurrence.dueDate)
    .sort((a, b) => a.localeCompare(b))[0] ?? null;

  return {
    overdueCount: overdue.length,
    overdueAmountCents: overdue.reduce(
      (sum, row) => new Decimal(sum).plus(row.occurrence.amountRemainingCents).toNumber(),
      0
    ),
    upcomingCount: upcoming.length,
    upcomingAmountCents: upcoming.reduce(
      (sum, row) => new Decimal(sum).plus(row.occurrence.amountRemainingCents).toNumber(),
      0
    ),
    nextDueDate,
    paidThisPeriodCount: paidInPeriod.length,
    paidThisPeriodAmountCents: paidInPeriod.reduce(
      (sum, row) => new Decimal(sum).plus(row.occurrence.amountPaidCents).toNumber(),
      0
    ),
  };
}

export async function listOccurrences(options: ListOccurrencesOptions) {
  const limit = normalizeLimit(options.limit, OCCURRENCE_LIMIT_DEFAULT);
  const offset = normalizeOffset(options.offset);

  const periodSettings =
    options.periodOffset !== undefined
      ? await getBudgetSettings(options.userId, options.householdId)
      : null;
  const selectedPeriod =
    options.periodOffset !== undefined
      ? getPeriodByOffset(periodSettings as BudgetScheduleSettings, options.periodOffset)
      : null;

  const windowStart = options.from
    ? parseDateOrThrow(options.from, 'from')
    : selectedPeriod
      ? startOfDay(selectedPeriod.start)
      : addDays(new Date(), -45);
  const windowEnd = options.to
    ? parseDateOrThrow(options.to, 'to')
    : selectedPeriod
      ? startOfDay(selectedPeriod.end)
      : addDays(new Date(), 120);

  await ensureOccurrencesForHousehold(options.householdId, windowStart, windowEnd, options.billType);
  await refreshOccurrenceStatuses(options.householdId);

  const whereFilters = [
    eq(billOccurrences.householdId, options.householdId),
    gte(billOccurrences.dueDate, format(windowStart, 'yyyy-MM-dd')),
    lte(billOccurrences.dueDate, format(windowEnd, 'yyyy-MM-dd')),
  ];

  if (options.status && options.status.length > 0) {
    whereFilters.push(inArray(billOccurrences.status, options.status));
  }

  if (options.billType) {
    whereFilters.push(eq(billTemplates.billType, options.billType));
  }

  const whereClause = and(...whereFilters);

  const rows = await db
    .select({
      occurrence: billOccurrences,
      template: billTemplates,
    })
    .from(billOccurrences)
    .innerJoin(billTemplates, eq(billOccurrences.templateId, billTemplates.id))
    .where(whereClause)
    .orderBy(asc(billOccurrences.dueDate), asc(billOccurrences.createdAt));

  const allocationMap = await loadAllocationsByOccurrenceIds(rows.map((row) => row.occurrence.id));

  let filteredRows = rows;

  if (options.periodOffset !== undefined) {
    filteredRows = rows.filter((row) => {
      const allocations = allocationMap.get(row.occurrence.id) || [];
      return occurrenceMatchesPeriod(
        row,
        allocations,
        periodSettings as BudgetScheduleSettings,
        selectedPeriod as BudgetPeriod
      );
    });
  }

  const total = filteredRows.length;
  const paginatedRows = filteredRows.slice(offset, offset + limit);

  const data: BillOccurrenceWithTemplateDto[] = paginatedRows.map((row) => ({
    occurrence: toOccurrenceDto(row.occurrence),
    template: toBillTemplateDto(row.template),
    allocations: (allocationMap.get(row.occurrence.id) || []).map(toAllocationDto),
  }));

  const summarySource: BillOccurrenceWithTemplateDto[] = filteredRows.map((row) => ({
    occurrence: toOccurrenceDto(row.occurrence),
    template: toBillTemplateDto(row.template),
    allocations: (allocationMap.get(row.occurrence.id) || []).map(toAllocationDto),
  }));

  return {
    data,
    summary: summarizeOccurrences(summarySource, selectedPeriod),
    total,
    limit,
    offset,
  };
}

interface PayOccurrenceInternalOptions {
  userId: string;
  householdId: string;
  occurrenceId: string;
  input: PayOccurrenceRequest;
  paymentMethod: BillPaymentEventDto['paymentMethod'];
}

async function applyAllocationPayment(
  tx: typeof db,
  occurrenceId: string,
  paymentEventId: string,
  amountCents: number,
  allocationId?: string
) {
  const allocations = await tx
    .select()
    .from(billOccurrenceAllocations)
    .where(eq(billOccurrenceAllocations.occurrenceId, occurrenceId))
    .orderBy(asc(billOccurrenceAllocations.periodNumber));

  if (allocations.length === 0) {
    return allocations;
  }

  const sortedAllocations = allocationId
    ? [
        ...allocations.filter((allocation) => allocation.id === allocationId),
        ...allocations.filter((allocation) => allocation.id !== allocationId),
      ]
    : allocations;

  let remainingCents = amountCents;
  const now = nowIso();

  for (const allocation of sortedAllocations) {
    if (remainingCents <= 0) break;

    const allocationRemaining = new Decimal(allocation.allocatedAmountCents)
      .minus(allocation.paidAmountCents)
      .toNumber();

    if (allocationRemaining <= 0) continue;

    const applied = Math.min(remainingCents, allocationRemaining);
    const nextPaidAmount = new Decimal(allocation.paidAmountCents).plus(applied).toNumber();
    const isPaid = nextPaidAmount >= allocation.allocatedAmountCents;

    await tx
      .update(billOccurrenceAllocations)
      .set({
        paidAmountCents: nextPaidAmount,
        isPaid,
        paymentEventId,
        updatedAt: now,
      })
      .where(eq(billOccurrenceAllocations.id, allocation.id));

    remainingCents = new Decimal(remainingCents).minus(applied).toNumber();
  }

  return tx
    .select()
    .from(billOccurrenceAllocations)
    .where(eq(billOccurrenceAllocations.occurrenceId, occurrenceId))
    .orderBy(asc(billOccurrenceAllocations.periodNumber));
}

async function payOccurrenceInternal(options: PayOccurrenceInternalOptions): Promise<PayOccurrenceResponse> {
  if (!options.input.accountId) {
    throw new Error('accountId is required');
  }

  if (options.input.idempotencyKey) {
    const [existingEvent] = await db
      .select()
      .from(billPaymentEvents)
      .where(
        and(
          eq(billPaymentEvents.householdId, options.householdId),
          eq(billPaymentEvents.idempotencyKey, options.input.idempotencyKey)
        )
      )
      .limit(1);

    if (existingEvent) {
      const [occurrence] = await db
        .select()
        .from(billOccurrences)
        .where(eq(billOccurrences.id, existingEvent.occurrenceId))
        .limit(1);

      if (!occurrence) {
        throw new Error('Occurrence not found for idempotent payment');
      }

      const allocations = await db
        .select()
        .from(billOccurrenceAllocations)
        .where(eq(billOccurrenceAllocations.occurrenceId, occurrence.id))
        .orderBy(asc(billOccurrenceAllocations.periodNumber));

      return {
        occurrence: toOccurrenceDto(occurrence),
        paymentEvent: toPaymentEventDto(existingEvent),
        updatedAllocations: allocations.map(toAllocationDto),
      };
    }
  }

  return runInDatabaseTransaction(async (tx) => {
    const [joined] = await tx
      .select({
        occurrence: billOccurrences,
        template: billTemplates,
      })
      .from(billOccurrences)
      .innerJoin(billTemplates, eq(billOccurrences.templateId, billTemplates.id))
      .where(
        and(
          eq(billOccurrences.id, options.occurrenceId),
          eq(billOccurrences.householdId, options.householdId)
        )
      )
      .limit(1);

    if (!joined) {
      throw new Error('Occurrence not found');
    }

    const { occurrence, template } = joined;

    if (occurrence.status === 'paid' || occurrence.status === 'overpaid') {
      throw new Error('Occurrence is already fully paid');
    }

    const [account] = await tx
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.id, options.input.accountId),
          eq(accounts.userId, options.userId),
          eq(accounts.householdId, options.householdId)
        )
      )
      .limit(1);

    if (!account) {
      throw new Error('Account not found');
    }

    const amountCents = options.input.amountCents ?? occurrence.amountRemainingCents;
    if (amountCents <= 0) {
      throw new Error('Payment amount must be greater than 0');
    }

    const paymentDate = options.input.paymentDate ?? todayYmd();
    parseDateOrThrow(paymentDate, 'paymentDate');

    const transactionType = template.billType === 'income' ? 'income' : 'expense';
    const signedAmount = transactionType === 'income' ? amountCents : -amountCents;

    const accountBalanceCents = getAccountBalanceCents(account);
    const nextBalanceCents = new Decimal(accountBalanceCents).plus(signedAmount).toNumber();

    const transactionId = nanoid();
    const now = nowIso();

    await insertTransactionMovement(tx, {
      id: transactionId,
      userId: options.userId,
      householdId: options.householdId,
      accountId: account.id,
      categoryId: template.categoryId,
      merchantId: template.merchantId,
      date: paymentDate,
      amountCents,
      description: template.name,
      notes: options.input.notes ?? null,
      type: transactionType,
      isPending: false,
      syncStatus: 'synced',
      createdAt: now,
      updatedAt: now,
    });

    await updateScopedAccountBalance(tx, {
      accountId: account.id,
      userId: options.userId,
      householdId: options.householdId,
      balanceCents: nextBalanceCents,
      usageCount: (account.usageCount || 0) + 1,
      lastUsedAt: now,
      updatedAt: now,
    });

    const balanceBeforeCents = template.debtRemainingBalanceCents;
    const principalCents = balanceBeforeCents !== null ? Math.min(amountCents, balanceBeforeCents) : null;
    const interestCents = balanceBeforeCents !== null ? Math.max(0, amountCents - (principalCents || 0)) : null;
    const balanceAfterCents =
      balanceBeforeCents !== null && principalCents !== null
        ? Math.max(0, new Decimal(balanceBeforeCents).minus(principalCents).toNumber())
        : null;

    if (balanceBeforeCents !== null && balanceAfterCents !== null) {
      await tx
        .update(billTemplates)
        .set({
          debtRemainingBalanceCents: balanceAfterCents,
          updatedAt: now,
        })
        .where(eq(billTemplates.id, template.id));
    }

    const paymentEventId = nanoid();

    await tx.insert(billPaymentEvents).values({
      id: paymentEventId,
      householdId: options.householdId,
      templateId: template.id,
      occurrenceId: occurrence.id,
      transactionId,
      amountCents,
      principalCents,
      interestCents,
      balanceBeforeCents,
      balanceAfterCents,
      paymentDate,
      paymentMethod: options.paymentMethod,
      sourceAccountId: account.id,
      idempotencyKey: options.input.idempotencyKey ?? null,
      notes: options.input.notes ?? null,
      createdAt: now,
    });

    const totalPaidCents = new Decimal(occurrence.amountPaidCents).plus(amountCents).toNumber();
    const remainingCents = Math.max(
      0,
      new Decimal(occurrence.amountDueCents).minus(totalPaidCents).toNumber()
    );

    let nextStatus: BillOccurrenceDto['status'];
    if (remainingCents === 0) {
      nextStatus = totalPaidCents > occurrence.amountDueCents ? 'overpaid' : 'paid';
    } else if (paymentDate > occurrence.dueDate) {
      nextStatus = 'overdue';
    } else {
      nextStatus = totalPaidCents > 0 ? 'partial' : 'unpaid';
    }

    await tx
      .update(billOccurrences)
      .set({
        status: nextStatus,
        amountPaidCents: totalPaidCents,
        amountRemainingCents: remainingCents,
        actualAmountCents: totalPaidCents,
        paidDate: remainingCents === 0 ? paymentDate : null,
        lastTransactionId: transactionId,
        daysLate: nextStatus === 'overdue' ? occurrence.daysLate : 0,
        updatedAt: now,
      })
      .where(eq(billOccurrences.id, occurrence.id));

    const updatedAllocations = await applyAllocationPayment(
      tx,
      occurrence.id,
      paymentEventId,
      amountCents,
      options.input.allocationId
    );

    if (template.recurrenceType === 'one_time' && (nextStatus === 'paid' || nextStatus === 'overpaid')) {
      await tx
        .update(billTemplates)
        .set({
          isActive: false,
          updatedAt: now,
        })
        .where(eq(billTemplates.id, template.id));
    }

    const [updatedOccurrence] = await tx
      .select()
      .from(billOccurrences)
      .where(eq(billOccurrences.id, occurrence.id))
      .limit(1);

    if (!updatedOccurrence) {
      throw new Error('Occurrence not found after payment');
    }

    const [paymentEvent] = await tx
      .select()
      .from(billPaymentEvents)
      .where(eq(billPaymentEvents.id, paymentEventId))
      .limit(1);

    if (!paymentEvent) {
      throw new Error('Payment event not found after payment');
    }

    return {
      occurrence: toOccurrenceDto(updatedOccurrence),
      paymentEvent: toPaymentEventDto(paymentEvent),
      updatedAllocations: updatedAllocations.map(toAllocationDto),
    };
  });
}

export async function payOccurrence(
  userId: string,
  householdId: string,
  occurrenceId: string,
  input: PayOccurrenceRequest
): Promise<PayOccurrenceResponse> {
  return payOccurrenceInternal({
    userId,
    householdId,
    occurrenceId,
    input,
    paymentMethod: 'manual',
  });
}

export async function skipOccurrence(
  householdId: string,
  occurrenceId: string,
  notes?: string
): Promise<BillOccurrenceDto> {
  const [occurrence] = await db
    .select()
    .from(billOccurrences)
    .where(and(eq(billOccurrences.id, occurrenceId), eq(billOccurrences.householdId, householdId)))
    .limit(1);

  if (!occurrence) {
    throw new Error('Occurrence not found');
  }

  const now = nowIso();
  await db
    .update(billOccurrences)
    .set({
      status: 'skipped',
      notes: notes ?? occurrence.notes,
      updatedAt: now,
    })
    .where(eq(billOccurrences.id, occurrenceId));

  const [updated] = await db
    .select()
    .from(billOccurrences)
    .where(eq(billOccurrences.id, occurrenceId))
    .limit(1);

  if (!updated) {
    throw new Error('Occurrence not found after skip');
  }

  return toOccurrenceDto(updated);
}

export async function resetOccurrence(
  householdId: string,
  occurrenceId: string
): Promise<BillOccurrenceDto> {
  const [occurrence] = await db
    .select()
    .from(billOccurrences)
    .where(and(eq(billOccurrences.id, occurrenceId), eq(billOccurrences.householdId, householdId)))
    .limit(1);

  if (!occurrence) {
    throw new Error('Occurrence not found');
  }

  const now = nowIso();
  const status = occurrence.dueDate < todayYmd() ? 'overdue' : 'unpaid';

  await runInDatabaseTransaction(async (tx) => {
    await tx
      .update(billOccurrences)
      .set({
        status,
        amountPaidCents: 0,
        amountRemainingCents: occurrence.amountDueCents,
        actualAmountCents: null,
        paidDate: null,
        lastTransactionId: null,
        daysLate: status === 'overdue' ? occurrence.daysLate : 0,
        updatedAt: now,
      })
      .where(eq(billOccurrences.id, occurrenceId));

    await tx
      .update(billOccurrenceAllocations)
      .set({
        paidAmountCents: 0,
        isPaid: false,
        paymentEventId: null,
        updatedAt: now,
      })
      .where(eq(billOccurrenceAllocations.occurrenceId, occurrenceId));
  });

  const [updated] = await db
    .select()
    .from(billOccurrences)
    .where(eq(billOccurrences.id, occurrenceId))
    .limit(1);

  if (!updated) {
    throw new Error('Occurrence not found after reset');
  }

  return toOccurrenceDto(updated);
}

export async function updateOccurrenceAllocations(
  householdId: string,
  occurrenceId: string,
  input: UpdateOccurrenceAllocationsRequest
): Promise<BillOccurrenceAllocationDto[]> {
  if (!Array.isArray(input.allocations) || input.allocations.length === 0) {
    throw new Error('allocations is required');
  }

  const [occurrence] = await db
    .select()
    .from(billOccurrences)
    .where(and(eq(billOccurrences.id, occurrenceId), eq(billOccurrences.householdId, householdId)))
    .limit(1);

  if (!occurrence) {
    throw new Error('Occurrence not found');
  }

  if (occurrence.amountPaidCents > 0) {
    throw new Error('Cannot rewrite allocations after payments have started');
  }

  const totalAllocationCents = input.allocations.reduce(
    (sum, allocation) => new Decimal(sum).plus(allocation.allocatedAmountCents).toNumber(),
    0
  );

  if (totalAllocationCents !== occurrence.amountDueCents) {
    throw new Error('Allocation total must match occurrence amountDueCents');
  }

  const duplicatePeriods = new Set<number>();
  for (const allocation of input.allocations) {
    if (allocation.periodNumber < 1) {
      throw new Error('periodNumber must be >= 1');
    }
    if (allocation.allocatedAmountCents < 0) {
      throw new Error('allocatedAmountCents must be >= 0');
    }
    if (duplicatePeriods.has(allocation.periodNumber)) {
      throw new Error('periodNumber must be unique');
    }
    duplicatePeriods.add(allocation.periodNumber);
  }

  const now = nowIso();

  await runInDatabaseTransaction(async (tx) => {
    await tx
      .delete(billOccurrenceAllocations)
      .where(eq(billOccurrenceAllocations.occurrenceId, occurrenceId));

    await tx.insert(billOccurrenceAllocations).values(
      input.allocations.map((allocation) => ({
        id: nanoid(),
        occurrenceId,
        templateId: occurrence.templateId,
        householdId,
        periodNumber: allocation.periodNumber,
        allocatedAmountCents: allocation.allocatedAmountCents,
        paidAmountCents: 0,
        isPaid: false,
        paymentEventId: null,
        createdAt: now,
        updatedAt: now,
      }))
    );
  });

  const rows = await db
    .select()
    .from(billOccurrenceAllocations)
    .where(eq(billOccurrenceAllocations.occurrenceId, occurrenceId))
    .orderBy(asc(billOccurrenceAllocations.periodNumber));

  return rows.map(toAllocationDto);
}

export async function runAutopay(options: RunAutopayOptions): Promise<AutopayRunResultDto> {
  const runDate = options.runDate ?? todayYmd();
  parseDateOrThrow(runDate, 'runDate');
  const runDateObj = parseDateOrThrow(runDate, 'runDate');

  const runType: AutopayRunResultDto['runType'] = options.dryRun ? 'dry_run' : options.runType || 'manual';

  const runId = nanoid();
  const startAt = nowIso();

  await db.insert(autopayRuns).values({
    id: runId,
    householdId: options.householdId,
    runDate,
    runType,
    status: 'started',
    processedCount: 0,
    successCount: 0,
    failedCount: 0,
    skippedCount: 0,
    totalAmountCents: 0,
    errorSummary: null,
    startedAt: startAt,
    completedAt: null,
  });

  const errors: AutopayRunResultDto['errors'] = [];

  let processedCount = 0;
  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  let totalAmountCents = 0;

  try {
    const rules = await db
      .select()
      .from(autopayRules)
      .where(
        and(
          eq(autopayRules.householdId, options.householdId),
          eq(autopayRules.isEnabled, true)
        )
      );

    if (rules.length === 0) {
      await db
        .update(autopayRuns)
        .set({
          status: 'completed',
          completedAt: nowIso(),
        })
        .where(eq(autopayRuns.id, runId));

      return {
        runId,
        runDate,
        runType,
        status: 'completed',
        processedCount,
        successCount,
        failedCount,
        skippedCount,
        totalAmountCents,
        errors,
      };
    }

    const templateIds = rules.map((rule) => rule.templateId);
    const templateRows = await db
      .select()
      .from(billTemplates)
      .where(
        and(
          inArray(billTemplates.id, templateIds),
          eq(billTemplates.householdId, options.householdId),
          eq(billTemplates.isActive, true)
        )
      );

    if (templateRows.length === 0) {
      await db
        .update(autopayRuns)
        .set({
          status: 'completed',
          completedAt: nowIso(),
        })
        .where(eq(autopayRuns.id, runId));

      return {
        runId,
        runDate,
        runType,
        status: 'completed',
        processedCount,
        successCount,
        failedCount,
        skippedCount,
        totalAmountCents,
        errors,
      };
    }

    const ruleByTemplateId = new Map(rules.map((rule) => [rule.templateId, rule]));

    await Promise.all(
      templateRows.map((template) =>
        ensureTemplateOccurrences(template, addDays(runDateObj, -60), addDays(runDateObj, 60))
      )
    );

    await refreshOccurrenceStatuses(options.householdId);

    const occurrences = await db
      .select()
      .from(billOccurrences)
      .where(
        and(
          eq(billOccurrences.householdId, options.householdId),
          inArray(billOccurrences.templateId, templateRows.map((template) => template.id)),
          inArray(billOccurrences.status, OUTSTANDING_OCCURRENCE_STATUSES)
        )
      );

    for (const occurrence of occurrences) {
      const rule = ruleByTemplateId.get(occurrence.templateId);
      if (!rule) {
        continue;
      }

      const processDate = format(subDays(parseDateOrThrow(occurrence.dueDate, 'dueDate'), rule.daysBeforeDue), 'yyyy-MM-dd');
      if (processDate !== runDate) {
        continue;
      }

      processedCount += 1;

      let amountCents = occurrence.amountRemainingCents;
      if (rule.amountType === 'fixed' && rule.fixedAmountCents !== null) {
        amountCents = Math.min(rule.fixedAmountCents, occurrence.amountRemainingCents);
      }

      if (amountCents <= 0) {
        skippedCount += 1;
        continue;
      }

      if (runType === 'dry_run' || options.dryRun) {
        skippedCount += 1;
        totalAmountCents = new Decimal(totalAmountCents).plus(amountCents).toNumber();
        continue;
      }

      try {
        await payOccurrenceInternal({
          userId: options.userId,
          householdId: options.householdId,
          occurrenceId: occurrence.id,
          input: {
            accountId: rule.payFromAccountId,
            amountCents,
            paymentDate: runDate,
            notes: `Autopay ${runDate}`,
          },
          paymentMethod: 'autopay',
        });

        successCount += 1;
        totalAmountCents = new Decimal(totalAmountCents).plus(amountCents).toNumber();
      } catch (error) {
        failedCount += 1;
        errors.push({
          templateId: occurrence.templateId,
          occurrenceId: occurrence.id,
          message: error instanceof Error ? error.message : 'Autopay failed',
          code: 'AUTOPAY_PAYMENT_FAILED',
        });
      }
    }

    const completedAt = nowIso();
    const status = failedCount > 0 ? 'failed' : 'completed';

    await db
      .update(autopayRuns)
      .set({
        status,
        processedCount,
        successCount,
        failedCount,
        skippedCount,
        totalAmountCents,
        errorSummary: errors.length > 0 ? JSON.stringify(errors) : null,
        completedAt,
      })
      .where(eq(autopayRuns.id, runId));

    return {
      runId,
      runDate,
      runType,
      status,
      processedCount,
      successCount,
      failedCount,
      skippedCount,
      totalAmountCents,
      errors,
    };
  } catch (error) {
    const completedAt = nowIso();
    const message = error instanceof Error ? error.message : 'Autopay run failed';

    await db
      .update(autopayRuns)
      .set({
        status: 'failed',
        processedCount,
        successCount,
        failedCount: failedCount + 1,
        skippedCount,
        totalAmountCents,
        errorSummary: message,
        completedAt,
      })
      .where(eq(autopayRuns.id, runId));

    throw error;
  }
}

export async function getDashboardSummary(
  userId: string,
  householdId: string
): Promise<BillsDashboardSummaryDto> {
  await ensureOccurrencesForHousehold(householdId, addDays(new Date(), -45), addDays(new Date(), 120));
  await refreshOccurrenceStatuses(householdId);

  const [occurrenceRows, templateCountRows] = await Promise.all([
    db
      .select()
      .from(billOccurrences)
      .where(eq(billOccurrences.householdId, householdId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(billTemplates)
      .where(
        and(
          eq(billTemplates.householdId, householdId),
          eq(billTemplates.isActive, true)
        )
      ),
  ]);

  const today = todayYmd();

  const overdue = occurrenceRows.filter((row) => row.status === 'overdue');
  const upcoming = occurrenceRows.filter(
    (row) => OUTSTANDING_OCCURRENCE_STATUSES.includes(row.status) && row.dueDate >= today
  );

  const nextDueDate = upcoming
    .map((row) => row.dueDate)
    .sort((a, b) => a.localeCompare(b))[0] ?? null;

  const settings = await getBudgetSettings(userId, householdId);
  const currentPeriod = getCurrentBudgetPeriod(settings);

  const paidThisPeriod = occurrenceRows.filter(
    (row) =>
      (row.status === 'paid' || row.status === 'overpaid') &&
      row.paidDate !== null &&
      row.paidDate >= format(currentPeriod.start, 'yyyy-MM-dd') &&
      row.paidDate <= format(currentPeriod.end, 'yyyy-MM-dd')
  );

  return {
    overdueCount: overdue.length,
    overdueAmountCents: overdue.reduce(
      (sum, row) => new Decimal(sum).plus(row.amountRemainingCents).toNumber(),
      0
    ),
    upcomingCount: upcoming.length,
    upcomingAmountCents: upcoming.reduce(
      (sum, row) => new Decimal(sum).plus(row.amountRemainingCents).toNumber(),
      0
    ),
    nextDueDate,
    paidThisPeriodCount: paidThisPeriod.length,
    paidThisPeriodAmountCents: paidThisPeriod.reduce(
      (sum, row) => new Decimal(sum).plus(row.amountPaidCents).toNumber(),
      0
    ),
    activeTemplateCount: Number(templateCountRows[0]?.count ?? 0),
  };
}
