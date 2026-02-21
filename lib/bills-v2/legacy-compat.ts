import Decimal from 'decimal.js';

import type {
  AutopayAmountType,
  BillClassification,
  BillOccurrenceAllocationDto,
  BillOccurrenceDto,
  BillTemplateDto,
  CreateBillTemplateRequest,
  OccurrenceStatus,
  RecurrenceType,
  UpdateBillTemplateRequest,
} from '@/lib/bills-v2/contracts';

const LEGACY_TO_RECURRENCE: Record<string, RecurrenceType> = {
  'one-time': 'one_time',
  weekly: 'weekly',
  biweekly: 'biweekly',
  monthly: 'monthly',
  quarterly: 'quarterly',
  'semi-annual': 'semi_annual',
  annual: 'annual',
};

const RECURRENCE_TO_LEGACY: Record<RecurrenceType, string> = {
  one_time: 'one-time',
  weekly: 'weekly',
  biweekly: 'biweekly',
  monthly: 'monthly',
  quarterly: 'quarterly',
  semi_annual: 'semi-annual',
  annual: 'annual',
};

const VALID_CLASSIFICATIONS: BillClassification[] = [
  'subscription',
  'utility',
  'housing',
  'insurance',
  'loan_payment',
  'membership',
  'service',
  'other',
];

const VALID_AUTOPAY_AMOUNT_TYPES: AutopayAmountType[] = [
  'fixed',
  'minimum_payment',
  'statement_balance',
  'full_balance',
];

export type LegacyInstanceStatus = 'pending' | 'paid' | 'overdue' | 'skipped';
export type LegacyPaymentStatus = 'unpaid' | 'partial' | 'paid' | 'overpaid';

export interface LegacyAutopayConfig {
  isEnabled: boolean;
  payFromAccountId: string | null;
  amountType: AutopayAmountType;
  fixedAmountCents: number | null;
  daysBeforeDue: number;
}

export interface LegacyBillUpsertPayload {
  name?: string;
  expectedAmount?: number;
  dueDate?: number | null;
  specificDueDate?: string | null;
  startMonth?: number | null;
  frequency?: string;
  isVariableAmount?: boolean;
  amountTolerance?: number;
  categoryId?: string | null;
  merchantId?: string | null;
  accountId?: string | null;
  autoMarkPaid?: boolean;
  notes?: string | null;
  billType?: 'expense' | 'income' | 'savings_transfer';
  billClassification?: string | null;
  classificationSubcategory?: string | null;
  linkedAccountId?: string | null;
  chargedToAccountId?: string | null;
  isAutopayEnabled?: boolean;
  autopayAccountId?: string | null;
  autopayAmountType?: string;
  autopayFixedAmount?: number;
  autopayDaysBefore?: number;
  isDebt?: boolean;
  originalBalance?: number;
  remainingBalance?: number;
  billInterestRate?: number;
  interestType?: 'fixed' | 'variable' | 'none';
  debtStartDate?: string | null;
  billColor?: string | null;
  includeInPayoffStrategy?: boolean;
  isInterestTaxDeductible?: boolean;
  taxDeductionType?: 'none' | 'mortgage' | 'student_loan' | 'business' | 'heloc_home';
  taxDeductionLimit?: number;
  budgetPeriodAssignment?: number | null;
  splitAcrossPeriods?: boolean;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function dollarsToCents(value: unknown): number | undefined {
  const amount = toNumber(value);
  if (amount === undefined) return undefined;
  return new Decimal(amount).mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

export function centsToDollars(value: number | null | undefined): number {
  return new Decimal(value || 0).div(100).toNumber();
}

export function recurrenceToLegacyFrequency(recurrenceType: RecurrenceType): string {
  return RECURRENCE_TO_LEGACY[recurrenceType] || 'monthly';
}

export function legacyFrequencyToRecurrence(frequency: unknown): RecurrenceType {
  if (typeof frequency !== 'string') return 'monthly';
  return LEGACY_TO_RECURRENCE[frequency] || 'monthly';
}

function normalizeClassification(
  billType: CreateBillTemplateRequest['billType'],
  classification: unknown,
  subcategory: unknown
): { classification: BillClassification; classificationSubcategory: string | null } {
  const maybeClassification =
    typeof classification === 'string' && VALID_CLASSIFICATIONS.includes(classification as BillClassification)
      ? (classification as BillClassification)
      : null;

  if (maybeClassification) {
    return {
      classification: maybeClassification,
      classificationSubcategory: typeof subcategory === 'string' && subcategory.trim() ? subcategory.trim() : null,
    };
  }

  if (typeof classification === 'string' && classification.trim().length > 0) {
    return {
      classification: billType === 'income' ? 'other' : 'other',
      classificationSubcategory:
        typeof subcategory === 'string' && subcategory.trim()
          ? subcategory.trim()
          : classification.trim(),
    };
  }

  return {
    classification: 'other',
    classificationSubcategory: typeof subcategory === 'string' && subcategory.trim() ? subcategory.trim() : null,
  };
}

function normalizeAutopayAmountType(value: unknown): AutopayAmountType {
  if (typeof value === 'string' && VALID_AUTOPAY_AMOUNT_TYPES.includes(value as AutopayAmountType)) {
    return value as AutopayAmountType;
  }
  return 'fixed';
}

function safeLegacyDueDate(template: BillTemplateDto): number {
  if (template.recurrenceType === 'weekly' || template.recurrenceType === 'biweekly') {
    return template.recurrenceDueWeekday ?? 0;
  }

  if (template.recurrenceType === 'one_time') {
    if (template.recurrenceSpecificDueDate) {
      const parts = template.recurrenceSpecificDueDate.split('-');
      const day = Number(parts[2]);
      if (Number.isFinite(day) && day > 0) return day;
    }
    return 1;
  }

  return template.recurrenceDueDay ?? 1;
}

export function legacyStatusFromOccurrence(status: OccurrenceStatus): LegacyInstanceStatus {
  if (status === 'paid' || status === 'overpaid') return 'paid';
  if (status === 'overdue') return 'overdue';
  if (status === 'skipped') return 'skipped';
  return 'pending';
}

export function legacyPaymentStatusFromOccurrence(status: OccurrenceStatus): LegacyPaymentStatus {
  if (status === 'paid') return 'paid';
  if (status === 'overpaid') return 'overpaid';
  if (status === 'partial') return 'partial';
  return 'unpaid';
}

export function legacyStatusesToOccurrenceStatuses(legacyStatuses: string[]): OccurrenceStatus[] {
  const mapped = new Set<OccurrenceStatus>();

  legacyStatuses.forEach((status) => {
    if (status === 'pending') {
      mapped.add('unpaid');
      mapped.add('partial');
    } else if (status === 'paid') {
      mapped.add('paid');
      mapped.add('overpaid');
    } else if (status === 'overdue') {
      mapped.add('overdue');
    } else if (status === 'skipped') {
      mapped.add('skipped');
    }
  });

  return Array.from(mapped);
}

export function toLegacyBill(
  template: BillTemplateDto,
  autopay: LegacyAutopayConfig | null
) {
  return {
    id: template.id,
    userId: template.createdByUserId,
    householdId: template.householdId,
    name: template.name,
    categoryId: template.categoryId,
    merchantId: template.merchantId,
    debtId: null,
    expectedAmount: centsToDollars(template.defaultAmountCents),
    dueDate: safeLegacyDueDate(template),
    frequency: recurrenceToLegacyFrequency(template.recurrenceType),
    specificDueDate: template.recurrenceSpecificDueDate,
    startMonth: template.recurrenceStartMonth,
    isVariableAmount: template.isVariableAmount,
    amountTolerance: new Decimal(template.amountToleranceBps).div(100).toNumber(),
    payeePatterns: null,
    accountId: template.paymentAccountId,
    isActive: template.isActive,
    autoMarkPaid: template.autoMarkPaid,
    notes: template.notes,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    billType: template.billType,
    billClassification: template.classification,
    classificationSubcategory: template.classificationSubcategory,
    linkedAccountId: template.linkedLiabilityAccountId,
    amountSource: 'fixed',
    chargedToAccountId: template.chargedToAccountId,
    isAutopayEnabled: autopay?.isEnabled || false,
    autopayAccountId: autopay?.payFromAccountId || null,
    autopayAmountType: autopay?.amountType || 'fixed',
    autopayFixedAmount: autopay?.fixedAmountCents !== null ? centsToDollars(autopay?.fixedAmountCents) : null,
    autopayDaysBefore: autopay?.daysBeforeDue || 0,
    isDebt: template.debtEnabled,
    originalBalance: template.debtOriginalBalanceCents !== null ? centsToDollars(template.debtOriginalBalanceCents) : null,
    remainingBalance: template.debtRemainingBalanceCents !== null ? centsToDollars(template.debtRemainingBalanceCents) : null,
    billInterestRate:
      template.debtInterestAprBps !== null && template.debtInterestAprBps !== undefined
        ? new Decimal(template.debtInterestAprBps).div(100).toNumber()
        : null,
    interestType: template.debtInterestType || 'none',
    debtStartDate: template.debtStartDate,
    billColor: template.debtColor,
    includeInPayoffStrategy: template.includeInPayoffStrategy,
    isInterestTaxDeductible: template.interestTaxDeductible,
    taxDeductionType: template.interestTaxDeductionType,
    taxDeductionLimit:
      template.interestTaxDeductionLimitCents !== null
        ? centsToDollars(template.interestTaxDeductionLimitCents)
        : null,
    budgetPeriodAssignment: template.budgetPeriodAssignment,
    splitAcrossPeriods: template.splitAcrossPeriods,
    splitAllocations: null,
  };
}

export function toLegacyInstance(occurrence: BillOccurrenceDto) {
  return {
    id: occurrence.id,
    userId: '',
    householdId: occurrence.householdId,
    billId: occurrence.templateId,
    dueDate: occurrence.dueDate,
    expectedAmount: centsToDollars(occurrence.amountDueCents),
    actualAmount: occurrence.actualAmountCents !== null ? centsToDollars(occurrence.actualAmountCents) : null,
    paidDate: occurrence.paidDate,
    transactionId: occurrence.lastTransactionId,
    status: legacyStatusFromOccurrence(occurrence.status),
    daysLate: occurrence.daysLate,
    lateFee: centsToDollars(occurrence.lateFeeCents),
    isManualOverride: occurrence.isManualOverride,
    notes: occurrence.notes,
    budgetPeriodOverride: occurrence.budgetPeriodOverride,
    paidAmount: centsToDollars(occurrence.amountPaidCents),
    remainingAmount: centsToDollars(occurrence.amountRemainingCents),
    paymentStatus: legacyPaymentStatusFromOccurrence(occurrence.status),
    principalPaid: null,
    interestPaid: null,
    createdAt: occurrence.createdAt,
    updatedAt: occurrence.updatedAt,
  };
}

export function toLegacyAllocation(allocation: BillOccurrenceAllocationDto) {
  return {
    id: allocation.id,
    billInstanceId: allocation.occurrenceId,
    billId: allocation.templateId,
    userId: '',
    householdId: allocation.householdId,
    periodNumber: allocation.periodNumber,
    allocatedAmount: centsToDollars(allocation.allocatedAmountCents),
    isPaid: allocation.isPaid,
    paidAmount: centsToDollars(allocation.paidAmountCents),
    allocationId: allocation.paymentEventId,
    createdAt: allocation.createdAt,
    updatedAt: allocation.updatedAt,
  };
}

export function buildCreateTemplateRequestFromLegacy(
  payload: LegacyBillUpsertPayload
): { template: CreateBillTemplateRequest; autopay: LegacyAutopayConfig | null } {
  const billType = payload.billType || 'expense';
  const recurrenceType = legacyFrequencyToRecurrence(payload.frequency || 'monthly');

  const expectedAmountCents = dollarsToCents(payload.expectedAmount);
  const dueDate = toNumber(payload.dueDate);

  const classification = normalizeClassification(
    billType,
    payload.billClassification,
    payload.classificationSubcategory
  );

  const template: CreateBillTemplateRequest = {
    name: (payload.name || '').trim(),
    billType,
    classification: classification.classification,
    classificationSubcategory: classification.classificationSubcategory,
    recurrenceType,
    defaultAmountCents: expectedAmountCents || 0,
    isVariableAmount: payload.isVariableAmount || false,
    amountToleranceBps: Math.max(0, Math.round((toNumber(payload.amountTolerance) || 5) * 100)),
    categoryId: payload.categoryId || null,
    merchantId: payload.merchantId || null,
    paymentAccountId: payload.accountId || null,
    linkedLiabilityAccountId: payload.linkedAccountId || null,
    chargedToAccountId: payload.chargedToAccountId || null,
    autoMarkPaid: payload.autoMarkPaid ?? true,
    notes: payload.notes || null,
    isActive: true,
    debtEnabled: payload.isDebt || false,
    debtOriginalBalanceCents: payload.isDebt ? dollarsToCents(payload.originalBalance) || null : null,
    debtRemainingBalanceCents:
      payload.isDebt
        ? dollarsToCents(payload.remainingBalance ?? payload.originalBalance) || null
        : null,
    debtInterestAprBps:
      payload.isDebt && payload.billInterestRate !== undefined
        ? Math.round((toNumber(payload.billInterestRate) || 0) * 100)
        : null,
    debtInterestType: payload.isDebt ? payload.interestType || 'fixed' : null,
    debtStartDate: payload.isDebt ? payload.debtStartDate || null : null,
    debtColor: payload.isDebt ? payload.billColor || null : null,
    includeInPayoffStrategy: payload.isDebt ? payload.includeInPayoffStrategy ?? true : true,
    interestTaxDeductible: payload.isDebt ? payload.isInterestTaxDeductible || false : false,
    interestTaxDeductionType: payload.isDebt
      ? payload.taxDeductionType || 'none'
      : 'none',
    interestTaxDeductionLimitCents:
      payload.isDebt && payload.isInterestTaxDeductible
        ? dollarsToCents(payload.taxDeductionLimit) || null
        : null,
    budgetPeriodAssignment:
      payload.budgetPeriodAssignment !== undefined ? payload.budgetPeriodAssignment : null,
    splitAcrossPeriods: payload.splitAcrossPeriods || false,
  };

  if (recurrenceType === 'one_time') {
    template.recurrenceSpecificDueDate = payload.specificDueDate || null;
    template.recurrenceDueDay = null;
    template.recurrenceDueWeekday = null;
    template.recurrenceStartMonth = null;
  } else if (recurrenceType === 'weekly' || recurrenceType === 'biweekly') {
    template.recurrenceDueWeekday = dueDate ?? 0;
    template.recurrenceDueDay = null;
    template.recurrenceSpecificDueDate = null;
    template.recurrenceStartMonth = null;
  } else {
    template.recurrenceDueDay = dueDate ?? 1;
    template.recurrenceDueWeekday = null;
    template.recurrenceSpecificDueDate = null;
    template.recurrenceStartMonth =
      recurrenceType === 'quarterly' || recurrenceType === 'semi_annual' || recurrenceType === 'annual'
        ? payload.startMonth ?? null
        : null;
  }

  const isAutopayEnabled = payload.isAutopayEnabled || false;
  const autopay: LegacyAutopayConfig | null = isAutopayEnabled
    ? {
        isEnabled: true,
        payFromAccountId: payload.autopayAccountId || null,
        amountType: normalizeAutopayAmountType(payload.autopayAmountType),
        fixedAmountCents:
          normalizeAutopayAmountType(payload.autopayAmountType) === 'fixed'
            ? dollarsToCents(payload.autopayFixedAmount) || expectedAmountCents || 0
            : null,
        daysBeforeDue: Math.max(0, Math.round(toNumber(payload.autopayDaysBefore) || 0)),
      }
    : null;

  return { template, autopay };
}

export function buildUpdateTemplateRequestFromLegacy(
  payload: LegacyBillUpsertPayload
): {
  template: UpdateBillTemplateRequest;
  autopay: LegacyAutopayConfig | null | undefined;
} {
  const template: UpdateBillTemplateRequest = {};

  if (payload.name !== undefined) template.name = (payload.name || '').trim();
  if (payload.expectedAmount !== undefined) template.defaultAmountCents = dollarsToCents(payload.expectedAmount) || 0;
  if (payload.isVariableAmount !== undefined) template.isVariableAmount = payload.isVariableAmount;
  if (payload.amountTolerance !== undefined) {
    template.amountToleranceBps = Math.max(0, Math.round((toNumber(payload.amountTolerance) || 0) * 100));
  }
  if (payload.categoryId !== undefined) template.categoryId = payload.categoryId;
  if (payload.merchantId !== undefined) template.merchantId = payload.merchantId;
  if (payload.accountId !== undefined) template.paymentAccountId = payload.accountId;
  if (payload.autoMarkPaid !== undefined) template.autoMarkPaid = payload.autoMarkPaid;
  if (payload.notes !== undefined) template.notes = payload.notes;
  if (payload.billType !== undefined) template.billType = payload.billType;
  if (payload.linkedAccountId !== undefined) template.linkedLiabilityAccountId = payload.linkedAccountId;
  if (payload.chargedToAccountId !== undefined) template.chargedToAccountId = payload.chargedToAccountId;
  if (payload.budgetPeriodAssignment !== undefined) template.budgetPeriodAssignment = payload.budgetPeriodAssignment;
  if (payload.splitAcrossPeriods !== undefined) template.splitAcrossPeriods = payload.splitAcrossPeriods;

  if (payload.billClassification !== undefined || payload.classificationSubcategory !== undefined || payload.billType !== undefined) {
    const normalized = normalizeClassification(
      payload.billType || 'expense',
      payload.billClassification,
      payload.classificationSubcategory
    );

    if (payload.billClassification !== undefined) template.classification = normalized.classification;
    if (payload.classificationSubcategory !== undefined || payload.billClassification !== undefined) {
      template.classificationSubcategory = normalized.classificationSubcategory;
    }
  }

  if (payload.frequency !== undefined) {
    const recurrenceType = legacyFrequencyToRecurrence(payload.frequency);
    template.recurrenceType = recurrenceType;

    if (recurrenceType === 'one_time') {
      template.recurrenceSpecificDueDate = payload.specificDueDate || null;
      template.recurrenceDueDay = null;
      template.recurrenceDueWeekday = null;
      template.recurrenceStartMonth = null;
    } else if (recurrenceType === 'weekly' || recurrenceType === 'biweekly') {
      template.recurrenceDueWeekday = toNumber(payload.dueDate) ?? 0;
      template.recurrenceDueDay = null;
      template.recurrenceSpecificDueDate = null;
      template.recurrenceStartMonth = null;
    } else {
      template.recurrenceDueDay = toNumber(payload.dueDate) ?? 1;
      template.recurrenceDueWeekday = null;
      template.recurrenceSpecificDueDate = null;
      template.recurrenceStartMonth =
        recurrenceType === 'quarterly' || recurrenceType === 'semi_annual' || recurrenceType === 'annual'
          ? payload.startMonth ?? null
          : null;
    }
  } else {
    if (payload.specificDueDate !== undefined) template.recurrenceSpecificDueDate = payload.specificDueDate;
    if (payload.dueDate !== undefined) {
      template.recurrenceDueDay = toNumber(payload.dueDate) ?? null;
      template.recurrenceDueWeekday = toNumber(payload.dueDate) ?? null;
    }
    if (payload.startMonth !== undefined) template.recurrenceStartMonth = payload.startMonth;
  }

  if (payload.isDebt !== undefined) template.debtEnabled = payload.isDebt;
  if (payload.originalBalance !== undefined) template.debtOriginalBalanceCents = dollarsToCents(payload.originalBalance) || null;
  if (payload.remainingBalance !== undefined) template.debtRemainingBalanceCents = dollarsToCents(payload.remainingBalance) || null;
  if (payload.billInterestRate !== undefined) {
    template.debtInterestAprBps = Math.round((toNumber(payload.billInterestRate) || 0) * 100);
  }
  if (payload.interestType !== undefined) template.debtInterestType = payload.interestType;
  if (payload.debtStartDate !== undefined) template.debtStartDate = payload.debtStartDate;
  if (payload.billColor !== undefined) template.debtColor = payload.billColor;
  if (payload.includeInPayoffStrategy !== undefined) template.includeInPayoffStrategy = payload.includeInPayoffStrategy;
  if (payload.isInterestTaxDeductible !== undefined) template.interestTaxDeductible = payload.isInterestTaxDeductible;
  if (payload.taxDeductionType !== undefined) template.interestTaxDeductionType = payload.taxDeductionType;
  if (payload.taxDeductionLimit !== undefined) {
    template.interestTaxDeductionLimitCents = dollarsToCents(payload.taxDeductionLimit) || null;
  }

  let autopay: LegacyAutopayConfig | null | undefined;
  if (
    payload.isAutopayEnabled !== undefined ||
    payload.autopayAccountId !== undefined ||
    payload.autopayAmountType !== undefined ||
    payload.autopayFixedAmount !== undefined ||
    payload.autopayDaysBefore !== undefined
  ) {
    if (payload.isAutopayEnabled === false) {
      autopay = null;
    } else {
      const amountType = normalizeAutopayAmountType(payload.autopayAmountType);
      autopay = {
        isEnabled: payload.isAutopayEnabled ?? true,
        payFromAccountId: payload.autopayAccountId || null,
        amountType,
        fixedAmountCents: amountType === 'fixed' ? dollarsToCents(payload.autopayFixedAmount) || null : null,
        daysBeforeDue: Math.max(0, Math.round(toNumber(payload.autopayDaysBefore) || 0)),
      };
    }
  }

  return { template, autopay };
}
