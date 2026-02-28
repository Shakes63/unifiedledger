export type BillType = 'expense' | 'income' | 'savings_transfer';
export type BillClassification =
  | 'subscription'
  | 'utility'
  | 'housing'
  | 'insurance'
  | 'loan_payment'
  | 'membership'
  | 'service'
  | 'other';

export type RecurrenceType =
  | 'one_time'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'semi_annual'
  | 'annual';

export type OccurrenceStatus =
  | 'unpaid'
  | 'partial'
  | 'paid'
  | 'overpaid'
  | 'overdue'
  | 'skipped';

export type PaymentMethod = 'manual' | 'transfer' | 'autopay' | 'match';
export type AutopayAmountType =
  | 'fixed'
  | 'minimum_payment'
  | 'statement_balance'
  | 'full_balance';

export interface BillTemplateDto {
  id: string;
  householdId: string;
  createdByUserId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  billType: BillType;
  classification: BillClassification;
  classificationSubcategory: string | null;
  recurrenceType: RecurrenceType;
  recurrenceDueDay: number | null;
  recurrenceDueWeekday: number | null;
  recurrenceSpecificDueDate: string | null;
  recurrenceStartMonth: number | null;
  defaultAmountCents: number;
  isVariableAmount: boolean;
  amountToleranceBps: number;
  categoryId: string | null;
  merchantId: string | null;
  paymentAccountId: string | null;
  linkedLiabilityAccountId: string | null;
  chargedToAccountId: string | null;
  autoMarkPaid: boolean;
  notes: string | null;
  debtEnabled: boolean;
  debtOriginalBalanceCents: number | null;
  debtRemainingBalanceCents: number | null;
  debtInterestAprBps: number | null;
  debtInterestType: 'fixed' | 'variable' | 'none' | null;
  debtStartDate: string | null;
  debtColor: string | null;
  includeInPayoffStrategy: boolean;
  interestTaxDeductible: boolean;
  interestTaxDeductionType: 'none' | 'mortgage' | 'student_loan' | 'business' | 'heloc_home';
  interestTaxDeductionLimitCents: number | null;
  budgetPeriodAssignment: number | null;
  splitAcrossPeriods: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BillOccurrenceDto {
  id: string;
  templateId: string;
  householdId: string;
  dueDate: string;
  status: OccurrenceStatus;
  amountDueCents: number;
  amountPaidCents: number;
  amountRemainingCents: number;
  actualAmountCents: number | null;
  paidDate: string | null;
  lastTransactionId: string | null;
  daysLate: number;
  lateFeeCents: number;
  isManualOverride: boolean;
  budgetPeriodOverride: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BillOccurrenceAllocationDto {
  id: string;
  occurrenceId: string;
  templateId: string;
  householdId: string;
  periodNumber: number;
  allocatedAmountCents: number;
  paidAmountCents: number;
  isPaid: boolean;
  paymentEventId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BillPaymentEventDto {
  id: string;
  householdId: string;
  templateId: string;
  occurrenceId: string;
  transactionId: string;
  amountCents: number;
  principalCents: number | null;
  interestCents: number | null;
  balanceBeforeCents: number | null;
  balanceAfterCents: number | null;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  sourceAccountId: string | null;
  idempotencyKey: string | null;
  notes: string | null;
  createdAt: string;
}

export interface BillOccurrenceWithTemplateDto {
  occurrence: BillOccurrenceDto;
  template: BillTemplateDto;
  allocations: BillOccurrenceAllocationDto[];
}

export interface CreateBillTemplateRequest {
  name: string;
  description?: string | null;
  isActive?: boolean;
  billType: BillType;
  classification: BillClassification;
  classificationSubcategory?: string | null;
  recurrenceType: RecurrenceType;
  recurrenceDueDay?: number | null;
  recurrenceDueWeekday?: number | null;
  recurrenceSpecificDueDate?: string | null;
  recurrenceStartMonth?: number | null;
  defaultAmountCents: number;
  isVariableAmount?: boolean;
  amountToleranceBps?: number;
  categoryId?: string | null;
  merchantId?: string | null;
  paymentAccountId?: string | null;
  linkedLiabilityAccountId?: string | null;
  chargedToAccountId?: string | null;
  autoMarkPaid?: boolean;
  notes?: string | null;
  debtEnabled?: boolean;
  debtOriginalBalanceCents?: number | null;
  debtRemainingBalanceCents?: number | null;
  debtInterestAprBps?: number | null;
  debtInterestType?: 'fixed' | 'variable' | 'none' | null;
  debtStartDate?: string | null;
  debtColor?: string | null;
  includeInPayoffStrategy?: boolean;
  interestTaxDeductible?: boolean;
  interestTaxDeductionType?: 'none' | 'mortgage' | 'student_loan' | 'business' | 'heloc_home';
  interestTaxDeductionLimitCents?: number | null;
  budgetPeriodAssignment?: number | null;
  splitAcrossPeriods?: boolean;
}

export type UpdateBillTemplateRequest = Partial<CreateBillTemplateRequest>;

export interface PayOccurrenceRequest {
  accountId: string;
  amountCents?: number;
  paymentDate?: string;
  notes?: string;
  allocationId?: string;
  idempotencyKey?: string;
}

export interface PayOccurrenceResponse {
  occurrence: BillOccurrenceDto;
  paymentEvent: BillPaymentEventDto;
  updatedAllocations: BillOccurrenceAllocationDto[];
}

export interface UpdateOccurrenceAllocationsRequest {
  allocations: Array<{
    periodNumber: number;
    allocatedAmountCents: number;
  }>;
}

export interface AutopayRunResultDto {
  runId: string;
  runDate: string;
  runType: 'scheduled' | 'manual' | 'dry_run';
  status: 'started' | 'completed' | 'failed';
  processedCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  totalAmountCents: number;
  errors: Array<{
    templateId: string;
    occurrenceId: string;
    message: string;
    code: string;
  }>;
}

export interface BillsDashboardSummaryDto {
  overdueCount: number;
  overdueAmountCents: number;
  upcomingCount: number;
  upcomingAmountCents: number;
  nextDueDate: string | null;
  paidThisPeriodCount: number;
  paidThisPeriodAmountCents: number;
  activeTemplateCount: number;
}
