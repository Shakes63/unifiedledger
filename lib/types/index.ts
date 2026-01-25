/**
 * Shared TypeScript Types for Unified Ledger
 *
 * This file contains type definitions used across the application.
 * These types help eliminate `any` types and provide better type safety.
 */

// ============================================================================
// CORE ENTITY TYPES
// ============================================================================

export type AccountType = 'checking' | 'savings' | 'credit' | 'line_of_credit' | 'investment' | 'cash';

export type InterestType = 'fixed' | 'variable' | 'precomputed';

export type PaymentAmountSource = 'minimum_payment' | 'statement_balance' | 'full_balance' | 'fixed';

export interface Account {
  id: string;
  userId: string;
  householdId: string;
  name: string;
  type: AccountType;
  bankName?: string | null;
  accountNumberLast4?: string | null;
  currentBalance: number;
  availableBalance?: number | null;
  creditLimit?: number | null;
  isActive: boolean;
  isBusinessAccount: boolean;
  enableSalesTax: boolean;
  enableTaxDeductions: boolean;
  color: string;
  icon: string;
  sortOrder: number;
  usageCount: number;
  lastUsedAt?: string | null;
  // Statement tracking (for credit accounts)
  statementBalance?: number | null;
  statementDate?: string | null;
  statementDueDate?: string | null;
  minimumPaymentAmount?: number | null;
  lastStatementUpdated?: string | null;
  // Interest & payments (for credit accounts)
  interestRate?: number | null;
  minimumPaymentPercent?: number | null;
  minimumPaymentFloor?: number | null;
  additionalMonthlyPayment?: number | null;
  // Line of credit specific fields
  isSecured?: boolean;
  securedAsset?: string | null;
  drawPeriodEndDate?: string | null;
  repaymentPeriodEndDate?: string | null;
  interestType?: InterestType | null;
  primeRateMargin?: number | null;
  // Annual fee fields (for credit cards)
  annualFee?: number | null;
  annualFeeMonth?: number | null;
  annualFeeBillId?: string | null;
  // Automation and strategy fields
  autoCreatePaymentBill?: boolean;
  includeInPayoffStrategy?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CategoryType = 'income' | 'expense' | 'savings';

export type IncomeFrequency = 'weekly' | 'biweekly' | 'monthly' | 'variable';

export interface Category {
  id: string;
  userId: string;
  householdId: string;
  name: string;
  type: CategoryType;
  monthlyBudget: number;
  dueDate?: number | null;
  isActive: boolean;
  isTaxDeductible: boolean;
  sortOrder: number;
  usageCount: number;
  lastUsedAt?: string | null;
  incomeFrequency?: IncomeFrequency | null;
  createdAt: string;
}

export type TransactionType = 'income' | 'expense' | 'transfer_in' | 'transfer_out';

export interface Transaction {
  id: string;
  userId: string;
  householdId: string;
  accountId: string;
  categoryId?: string | null;
  merchantId?: string | null;
  billId?: string | null;
  debtId?: string | null;
  date: string;
  amount: number;
  description: string;
  notes?: string | null;
  type: TransactionType;
  transferId?: string | null;
  isPending: boolean;
  isRecurring: boolean;
  recurringRule?: string | null;
  receiptUrl?: string | null;
  isSplit: boolean;
  splitParentId?: string | null;
  isTaxDeductible: boolean;
  isSalesTaxable: boolean;
  syncStatus?: 'pending' | 'syncing' | 'synced' | 'error' | 'offline';
  createdAt: string;
  updatedAt: string;
}

export interface TransactionWithRelations extends Transaction {
  account?: Account;
  category?: Category | null;
  merchant?: Merchant | null;
}

export interface Merchant {
  id: string;
  userId: string;
  householdId: string;
  name: string;
  normalizedName: string;
  categoryId?: string | null;
  isSalesTaxExempt: boolean;
  usageCount: number;
  lastUsedAt?: string | null;
  totalSpent: number;
  averageTransaction: number;
  createdAt: string;
  updatedAt: string;
}

export type BillFrequency =
  | 'one-time'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'semi-annual'
  | 'annual';

// Split allocation template for a bill (stored as JSON in splitAllocations)
export interface SplitAllocationTemplate {
  periodNumber: number;
  percentage: number; // 0-100
}

export interface Bill {
  id: string;
  userId: string;
  householdId: string;
  name: string;
  categoryId?: string | null;
  merchantId?: string | null;
  debtId?: string | null;
  expectedAmount: number;
  dueDate: number;
  frequency: BillFrequency;
  specificDueDate?: string | null;
  startMonth?: number | null;
  isVariableAmount: boolean;
  amountTolerance: number;
  payeePatterns?: string | null;
  accountId?: string | null;
  isActive: boolean;
  autoMarkPaid: boolean;
  notes?: string | null;
  budgetPeriodAssignment?: number | null;
  // Split payment across periods (for partial payment budgeting)
  splitAcrossPeriods?: boolean;
  splitAllocations?: string | null; // JSON of SplitAllocationTemplate[]
  createdAt: string;
}

export type BillInstanceStatus = 'pending' | 'paid' | 'overdue' | 'skipped';

export type BillPaymentStatus = 'unpaid' | 'partial' | 'paid' | 'overpaid';

export interface BillInstance {
  id: string;
  userId: string;
  householdId: string;
  billId: string;
  dueDate: string;
  expectedAmount: number;
  actualAmount?: number | null;
  paidDate?: string | null;
  transactionId?: string | null;
  status: BillInstanceStatus;
  daysLate: number;
  lateFee: number;
  isManualOverride: boolean;
  notes?: string | null;
  budgetPeriodOverride?: number | null;
  // Partial payment tracking
  paidAmount?: number;
  remainingAmount?: number | null;
  paymentStatus?: BillPaymentStatus;
  principalPaid?: number;
  interestPaid?: number;
  createdAt: string;
  updatedAt: string;
}

// Bill instance allocation for tracking period splits
export interface BillInstanceAllocation {
  id: string;
  billInstanceId: string;
  billId: string;
  userId: string;
  householdId: string;
  periodNumber: number;
  allocatedAmount: number;
  isPaid: boolean;
  paidAmount: number;
  allocationId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DebtType =
  | 'credit_card'
  | 'personal_loan'
  | 'auto_loan'
  | 'student_loan'
  | 'mortgage'
  | 'medical'
  | 'other';

export type DebtStatus = 'active' | 'paid_off';

export interface Debt {
  id: string;
  userId: string;
  householdId: string;
  name: string;
  type: DebtType;
  categoryId?: string | null;
  accountId?: string | null;
  originalAmount: number;
  remainingBalance: number;
  interestRate: number;
  minimumPayment: number;
  dueDay?: number | null;
  startDate?: string | null;
  expectedPayoffDate?: string | null;
  status: DebtStatus;
  lender?: string | null;
  accountNumber?: string | null;
  notes?: string | null;
  isAutoPay: boolean;
  createdAt: string;
  updatedAt: string;
}

export type GoalStatus = 'active' | 'completed' | 'cancelled' | 'on_hold';

export interface Goal {
  id: string;
  userId: string;
  householdId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string | null;
  description?: string | null;
  color: string;
  icon: string;
  status: GoalStatus;
  linkedAccountId?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// HOUSEHOLD TYPES
// ============================================================================

export type HouseholdRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface Household {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface HouseholdMember {
  id: string;
  householdId: string;
  userId: string;
  userEmail: string;
  userName?: string | null;
  role: HouseholdRole;
  joinedAt: string;
  invitedBy?: string | null;
  isActive: boolean;
  isFavorite: boolean;
  customPermissions?: string | null;
  userAvatarUrl?: string | null;
}

// ============================================================================
// CHART TYPES (for Recharts)
// ============================================================================

export interface ChartPayloadItem {
  value: number;
  name?: string;
  dataKey?: string;
  payload?: Record<string, unknown>;
  color?: string;
  fill?: string;
}

export interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartPayloadItem[];
  label?: string;
}

/**
 * Props for custom pie chart label renderer
 * Compatible with Recharts PieLabelRenderProps
 */
export interface PieLabelRenderProps {
  cx?: string | number;
  cy?: string | number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
  name?: string;
  value?: number;
  fill?: string;
  index?: number;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  color?: string;
  fill?: string;
}

/**
 * Extended Recharts tooltip props with typed payload
 * Generic T allows specifying the shape of the data point
 */
export interface RechartsTooltipPayloadItem<T = Record<string, unknown>> {
  value: number;
  name?: string;
  dataKey?: string;
  color?: string;
  fill?: string;
  payload: T;
}

export interface RechartsTooltipProps<T = Record<string, unknown>> {
  active?: boolean;
  payload?: RechartsTooltipPayloadItem<T>[];
  label?: string | number;
}

/**
 * Click event data from Recharts charts
 * Generic T allows specifying the shape of the data point
 */
export interface RechartsClickData<T = Record<string, unknown>> {
  activePayload?: Array<{
    payload: T;
    dataKey?: string;
    value?: number;
  }>;
  activeLabel?: string;
  activeTooltipIndex?: number;
}

/**
 * Pie chart data point with total for percentage calculations
 */
export interface PieChartDataPoint {
  name: string;
  value: number;
  total: number;
}

// ============================================================================
// FORM TYPES
// ============================================================================

export interface FormErrors {
  [key: string]: string | undefined;
}

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Form data for DebtForm component
 * Uses string | number for numeric inputs to handle empty states
 */
export interface DebtFormData {
  name: string;
  description: string;
  creditorName: string;
  originalAmount: string | number;
  remainingBalance: string | number;
  minimumPayment: string | number;
  additionalMonthlyPayment: string | number;
  interestRate: number;
  interestType: 'none' | 'fixed' | 'variable' | 'precomputed';
  type: DebtType;
  color: string;
  startDate: string;
  targetPayoffDate: string;
  priority: number;
  loanType: 'revolving' | 'installment';
  loanTermMonths: string | number;
  originationDate: string;
  compoundingFrequency: 'daily' | 'monthly' | 'quarterly' | 'annually';
  billingCycleDays: number;
  lastStatementDate: string;
  lastStatementBalance: string | number;
  notes: string;
  creditLimit: string | number;
}

/**
 * Form data for GoalForm component
 */
export interface GoalFormData {
  name: string;
  description: string;
  targetAmount: string | number;
  currentAmount: number;
  category: string;
  color: string;
  targetDate: string;
  priority: number;
  monthlyContribution: string | number;
  notes: string;
}

/**
 * Form data for AccountForm component
 */
export interface AccountFormData {
  name: string;
  type: AccountType;
  bankName: string | null;
  accountNumberLast4: string | null;
  currentBalance: number;
  creditLimit: string | number | null;
  color: string;
  icon: string;
  isBusinessAccount: boolean;
  enableSalesTax: boolean;
  enableTaxDeductions: boolean;
  // Credit/Line of Credit fields (Phase 2)
  interestRate?: number | null;
  minimumPaymentPercent?: number | null;
  minimumPaymentFloor?: number | null;
  statementDueDay?: number | null;
  annualFee?: number | null;
  annualFeeMonth?: number | null;
  autoCreatePaymentBill?: boolean;
  includeInPayoffStrategy?: boolean;
  paymentAmountSource?: PaymentAmountSource;
  // Line of Credit specific fields
  isSecured?: boolean;
  securedAsset?: string | null;
  drawPeriodEndDate?: string | null;
  repaymentPeriodEndDate?: string | null;
  interestType?: InterestType;
  primeRateMargin?: number | null;
  // Budget integration (Paycheck Balance Widget)
  includeInDiscretionary?: boolean;
}

/**
 * Form data for CategoryForm component
 */
export interface CategoryFormData {
  name: string;
  type: CategoryType;
  monthlyBudget: number;
  dueDate: string | number | null;
  isTaxDeductible: boolean;
  isBusinessCategory: boolean;
  isActive: boolean;
  incomeFrequency: IncomeFrequency;
  parentId?: string | null;
  isBudgetGroup?: boolean;
  targetAllocation?: number | null;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApiError {
  error: string;
  details?: string;
}

// Bill API response includes nested data
export interface BillWithRelations {
  bill: Bill;
  category?: Category | null;
  account?: Account | null;
  merchant?: Merchant | null;
  upcomingInstances?: BillInstance[];
}

// ============================================================================
// RULES TYPES
// ============================================================================

export type RuleOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'between'
  | 'regex'
  | 'in_list'
  | 'matches_day'
  | 'matches_weekday'
  | 'matches_month';

export type RuleField =
  | 'description'
  | 'amount'
  | 'account_name'
  | 'date'
  | 'day_of_month'
  | 'weekday'
  | 'month'
  | 'notes';

export type RuleActionType =
  | 'set_category'
  | 'set_merchant'
  | 'set_description'
  | 'prepend_description'
  | 'append_description'
  | 'set_tax_deduction'
  | 'set_sales_tax'
  | 'convert_to_transfer'
  | 'create_split'
  | 'set_account';

export interface RuleCondition {
  field: RuleField;
  operator: RuleOperator;
  value: string;
}

export interface RuleConditionGroup {
  logic: 'AND' | 'OR';
  conditions: (RuleCondition | RuleConditionGroup)[];
}

export interface RuleAction {
  type: RuleActionType;
  value: string;
  config?: Record<string, unknown>;
}

export interface Rule {
  id: string;
  userId: string;
  householdId: string;
  name: string;
  description?: string | null;
  priority: number;
  conditions: string; // JSON string of RuleConditionGroup
  actions: string; // JSON string of RuleAction[]
  isActive: boolean;
  matchCount: number;
  lastMatchedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export type NotificationType =
  | 'bill_reminder'
  | 'budget_warning'
  | 'budget_exceeded'
  | 'budget_review'
  | 'low_balance'
  | 'savings_milestone'
  | 'debt_milestone'
  | 'weekly_summary'
  | 'monthly_summary';

export type NotificationChannel = 'push' | 'email';

export interface NotificationPreferences {
  userId: string;
  billReminderEnabled: boolean;
  billReminderDaysBefore: number;
  billReminderOnDueDate: boolean;
  billReminderChannels: NotificationChannel[];
  budgetWarningEnabled: boolean;
  budgetWarningThreshold: number;
  budgetWarningChannels: NotificationChannel[];
  budgetExceededEnabled: boolean;
  budgetExceededChannels: NotificationChannel[];
  budgetReviewEnabled: boolean;
  budgetReviewChannels: NotificationChannel[];
  lowBalanceEnabled: boolean;
  lowBalanceThreshold: number;
  lowBalanceChannels: NotificationChannel[];
  savingsMilestoneEnabled: boolean;
  savingsMilestoneChannels: NotificationChannel[];
  debtMilestoneEnabled: boolean;
  debtMilestoneChannels: NotificationChannel[];
  weeklySummaryEnabled: boolean;
  weeklySummaryChannels: NotificationChannel[];
  monthlySummaryEnabled: boolean;
  monthlySummaryChannels: NotificationChannel[];
}

// ============================================================================
// SEARCH TYPES
// ============================================================================

export interface SearchFilter {
  id?: string;
  name?: string;
  query?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  categoryIds?: string[];
  accountIds?: string[];
  merchantIds?: string[];
  types?: TransactionType[];
  isTaxDeductible?: boolean;
  hasNotes?: boolean;
  isRecurring?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// CSV IMPORT TYPES
// ============================================================================

export interface ColumnMapping {
  csvColumn: string;
  appField: string;
  transform?: string;
}

export interface ImportTemplate {
  id: string;
  userId: string;
  name: string;
  columnMappings: string; // JSON string of ColumnMapping[]
  dateFormat?: string;
  amountFormat?: string;
  skipRows?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ImportPreviewRow {
  rowNumber: number;
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  category?: string;
  merchant?: string;
  notes?: string;
  isDuplicate?: boolean;
  errors?: string[];
}

// ============================================================================
// ACTIVITY & AUDIT TYPES
// ============================================================================

export type ActivityAction =
  | 'transaction_created'
  | 'transaction_updated'
  | 'transaction_deleted'
  | 'account_created'
  | 'account_updated'
  | 'account_deleted'
  | 'bill_paid'
  | 'budget_updated'
  | 'goal_updated'
  | 'goal_completed'
  | 'debt_payment'
  | 'member_joined'
  | 'member_left'
  | 'member_role_changed';

export interface ActivityLogEntry {
  id: string;
  userId: string;
  householdId: string;
  action: ActivityAction;
  entityType: string;
  entityId: string;
  entityName?: string | null;
  details?: string | null;
  createdAt: string;
  userName?: string | null;
  userAvatarUrl?: string | null;
}

// ============================================================================
// OFFLINE SYNC TYPES
// ============================================================================

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'error';

export interface OfflineQueueItem {
  id: string;
  action: 'create' | 'update' | 'delete';
  entityType: string;
  data: Record<string, unknown>;
  status: SyncStatus;
  attempts: number;
  lastError?: string;
  createdAt: string;
}

// ============================================================================
// EVENT HANDLER TYPES
// ============================================================================

export type SelectChangeEvent = React.ChangeEvent<HTMLSelectElement>;
export type InputChangeEvent = React.ChangeEvent<HTMLInputElement>;
export type TextAreaChangeEvent = React.ChangeEvent<HTMLTextAreaElement>;

// ============================================================================
// RULE ACTION CONFIG TYPES
// ============================================================================

/**
 * Configuration for a split in a create_split rule action
 */
export interface SplitConfig {
  categoryId: string;
  amount: number;
  percentage: number;
  isPercentage: boolean;
  description: string;
}

/**
 * Configuration object for rule actions
 * Different action types use different config properties
 */
export interface RuleActionConfig {
  splits?: SplitConfig[];
  targetAccountId?: string;
  description?: string;
  [key: string]: unknown;
}

// ============================================================================
// ADDITIONAL FORM DATA TYPES
// ============================================================================

/**
 * Form data for BillForm component
 */
export interface BillFormData {
  name: string;
  categoryId?: string | null;
  merchantId?: string | null;
  amount: number | string;
  frequency: BillFrequency;
  dueDate: number;
  specificDueDate?: string;
  startMonth?: number;
  isAutoPay?: boolean;
  notes?: string;
  accountId?: string | null;
  isVariableAmount?: boolean;
  amountTolerance?: number;
  payeePatterns?: string;
}

/**
 * Form data for TransactionForm component
 */
export interface TransactionFormData {
  accountId: string;
  toAccountId?: string;
  categoryId?: string | null;
  merchantId?: string | null;
  amount: number | string;
  type: TransactionType;
  date: string;
  description: string;
  notes?: string;
  billId?: string | null;
  billInstanceId?: string | null;
  debtId?: string | null;
  isTaxDeductible?: boolean;
  isSalesTaxable?: boolean;
}

// ============================================================================
// REPORT EXPORT TYPES
// ============================================================================

/**
 * Individual row in a report export
 */
export interface ReportDataItem {
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Report data structure that may contain array of items
 */
export interface ReportData {
  data?: ReportDataItem[];
  [key: string]: unknown;
}

/**
 * Summary data for report exports
 */
export interface ReportSummary {
  [key: string]: string | number;
}

// ============================================================================
// UNPAID BILL TYPES
// ============================================================================

/**
 * Unpaid bill instance with bill details for dropdown selection
 */
export interface UnpaidBillInstance {
  id: string;
  billId: string;
  billName: string;
  dueDate: string;
  expectedAmount: number;
  status: BillInstanceStatus;
  categoryId?: string | null;
  merchantId?: string | null;
  debtId?: string | null;
}

// ============================================================================
// TRANSACTION SPLIT TYPES
// ============================================================================

/**
 * Transaction split entity representing a portion of a split transaction
 */
export interface TransactionSplit {
  id: string;
  userId: string;
  householdId: string;
  transactionId: string;
  categoryId: string;
  amount: number;
  description?: string | null;
  percentage?: number | null;
  isPercentage: boolean;
  sortOrder: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Single split item for batch update request
 * If id is provided, it's an update; if absent, it's a create
 */
export interface BatchSplitRequestItem {
  /** If present, updates existing split; if absent, creates new split */
  id?: string;
  /** Category ID for this split (required) */
  categoryId: string;
  /** Fixed amount for this split (used when isPercentage is false) */
  amount?: number;
  /** Percentage of transaction for this split (used when isPercentage is true) */
  percentage?: number;
  /** Whether this split uses percentage (true) or fixed amount (false) */
  isPercentage: boolean;
  /** Optional description for this split */
  description?: string;
  /** Optional notes for this split */
  notes?: string;
  /** Sort order for display (0-indexed) */
  sortOrder?: number;
}

/**
 * Request body for batch split update endpoint
 */
export interface BatchSplitRequest {
  /** Array of splits defining the complete desired state */
  splits: BatchSplitRequestItem[];
  /** 
   * If true (default), delete existing splits not in the array.
   * If false, only create/update specified splits.
   */
  deleteOthers?: boolean;
}

/**
 * Response from batch split update endpoint
 */
export interface BatchSplitResponse {
  /** Number of new splits created */
  created: number;
  /** Number of existing splits updated */
  updated: number;
  /** Number of splits deleted */
  deleted: number;
  /** Final state of all splits for the transaction */
  splits: TransactionSplit[];
}

