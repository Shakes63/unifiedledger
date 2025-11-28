/**
 * Shared TypeScript Types for Unified Ledger
 *
 * This file contains type definitions used across the application.
 * These types help eliminate `any` types and provide better type safety.
 */

// ============================================================================
// CORE ENTITY TYPES
// ============================================================================

export type AccountType = 'checking' | 'savings' | 'credit' | 'investment' | 'cash';

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
  color: string;
  icon: string;
  sortOrder: number;
  usageCount: number;
  lastUsedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CategoryType =
  | 'income'
  | 'variable_expense'
  | 'monthly_bill'
  | 'savings'
  | 'debt'
  | 'non_monthly_bill';

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
  createdAt: string;
}

export type BillInstanceStatus = 'pending' | 'paid' | 'overdue' | 'skipped';

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

export interface PieLabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
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

