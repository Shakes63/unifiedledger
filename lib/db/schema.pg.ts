import { pgTable, text, integer, bigint, doublePrecision, boolean, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// IMPORTANT:
// - Do NOT use `default(new Date().toISOString())` in schema definitions.
//   It bakes a build-time timestamp into migrations and produces incorrect DB defaults.
// - Use a database-evaluated default instead (UTC ISO-ish text).
const pgNowIso = sql`(to_char((now() at time zone 'utc'),'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))`;

// ============================================================================
// CORE TABLES
// ============================================================================

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    entityId: text('entity_id'),
    name: text('name').notNull(),
    type: text('type', {
      enum: ['checking', 'savings', 'credit', 'line_of_credit', 'investment', 'cash'],
    }).notNull(),
    bankName: text('bank_name').notNull(),
    accountNumberLast4: text('account_number_last4'),
    currentBalance: doublePrecision('current_balance').default(0),
    currentBalanceCents: bigint('current_balance_cents', { mode: 'number' }).notNull().default(0),
    availableBalance: doublePrecision('available_balance'),
    availableBalanceCents: bigint('available_balance_cents', { mode: 'number' }),
    creditLimit: doublePrecision('credit_limit'),
    creditLimitCents: bigint('credit_limit_cents', { mode: 'number' }),
    isActive: boolean('is_active').default(true),
    isBusinessAccount: boolean('is_business_account').default(false),
    enableSalesTax: boolean('enable_sales_tax').default(false),
    enableTaxDeductions: boolean('enable_tax_deductions').default(false),
    color: text('color').default('#3b82f6'),
    icon: text('icon').default('wallet'),
    sortOrder: integer('sort_order').default(0),
    usageCount: integer('usage_count').default(0),
    lastUsedAt: text('last_used_at'),
    // Statement tracking (for credit accounts)
    statementBalance: doublePrecision('statement_balance'),
    statementDate: text('statement_date'),
    statementDueDate: text('statement_due_date'),
    minimumPaymentAmount: doublePrecision('minimum_payment_amount'),
    lastStatementUpdated: text('last_statement_updated'),
    // Interest & payments (for credit accounts)
    interestRate: doublePrecision('interest_rate'),
    minimumPaymentPercent: doublePrecision('minimum_payment_percent'),
    minimumPaymentFloor: doublePrecision('minimum_payment_floor'),
    additionalMonthlyPayment: doublePrecision('additional_monthly_payment'),
    // Line of credit specific fields
    isSecured: boolean('is_secured').default(false),
    securedAsset: text('secured_asset'),
    drawPeriodEndDate: text('draw_period_end_date'),
    repaymentPeriodEndDate: text('repayment_period_end_date'),
    interestType: text('interest_type', {
      enum: ['fixed', 'variable'],
    }).default('fixed'),
    primeRateMargin: doublePrecision('prime_rate_margin'),
    // Annual fee fields (for credit cards)
    annualFee: doublePrecision('annual_fee'),
    annualFeeMonth: integer('annual_fee_month'),
    annualFeeBillId: text('annual_fee_bill_id'),
    // Automation and strategy fields
    autoCreatePaymentBill: boolean('auto_create_payment_bill').default(true),
    includeInPayoffStrategy: boolean('include_in_payoff_strategy').default(true),
    // Budget integration (Phase 7)
    budgetedMonthlyPayment: doublePrecision('budgeted_monthly_payment'),
    // Discretionary calculation (Paycheck Balance Widget)
    includeInDiscretionary: boolean('include_in_discretionary').default(true),
    createdAt: text('created_at').default(pgNowIso),
    updatedAt: text('updated_at').default(pgNowIso),
  },
  (table) => ({
    userIdIdx: index('idx_accounts_user').on(table.userId),
    householdIdIdx: index('idx_accounts_household').on(table.householdId),
    entityIdIdx: index('idx_accounts_entity').on(table.entityId),
    userHouseholdIdx: index('idx_accounts_user_household').on(table.userId, table.householdId),
    userUsageIdx: index('idx_accounts_user_usage').on(table.userId, table.usageCount),
    userActiveIdx: index('idx_accounts_user_active').on(table.userId, table.isActive),
    currentBalanceCentsIdx: index('idx_accounts_current_balance_cents').on(table.currentBalanceCents),
    interestRateIdx: index('idx_accounts_interest_rate').on(table.interestRate),
    includeInStrategyIdx: index('idx_accounts_include_in_strategy').on(table.includeInPayoffStrategy),
  })
);

// Credit Limit History - Track credit limit changes over time
export const creditLimitHistory = pgTable(
  'credit_limit_history',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    previousLimit: doublePrecision('previous_limit'),
    newLimit: doublePrecision('new_limit').notNull(),
    changeDate: text('change_date').notNull(),
    changeReason: text('change_reason', {
      enum: ['user_update', 'bank_increase', 'bank_decrease', 'initial'],
    }).default('user_update'),
    utilizationBefore: doublePrecision('utilization_before'),
    utilizationAfter: doublePrecision('utilization_after'),
    createdAt: text('created_at').default(pgNowIso),
  },
  (table) => ({
    accountIdIdx: index('idx_credit_limit_history_account').on(table.accountId),
    userIdIdx: index('idx_credit_limit_history_user').on(table.userId),
    householdIdIdx: index('idx_credit_limit_history_household').on(table.householdId),
    changeDateIdx: index('idx_credit_limit_history_change_date').on(table.changeDate),
  })
);

// Account Balance History - Track balance for utilization trends
export const accountBalanceHistory = pgTable(
  'account_balance_history',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    snapshotDate: text('snapshot_date').notNull(),
    balance: doublePrecision('balance').notNull(),
    creditLimit: doublePrecision('credit_limit'),
    availableCredit: doublePrecision('available_credit'),
    utilizationPercent: doublePrecision('utilization_percent'),
    createdAt: text('created_at').default(pgNowIso),
  },
  (table) => ({
    accountIdIdx: index('idx_account_balance_history_account').on(table.accountId),
    userIdIdx: index('idx_account_balance_history_user').on(table.userId),
    householdIdIdx: index('idx_account_balance_history_household').on(table.householdId),
    snapshotDateIdx: index('idx_account_balance_history_date').on(table.snapshotDate),
    accountDateIdx: index('idx_account_balance_history_account_date').on(
      table.accountId,
      table.snapshotDate
    ),
  })
);

export const budgetCategories = pgTable(
  'budget_categories',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    name: text('name').notNull(),
    type: text('type', {
      enum: ['income', 'expense', 'savings'],
    }).notNull(),
    monthlyBudget: doublePrecision('monthly_budget').default(0),
    dueDate: integer('due_date'),
    isActive: boolean('is_active').default(true),
    isTaxDeductible: boolean('is_tax_deductible').default(false),
    isBusinessCategory: boolean('is_business_category').default(false),
    sortOrder: integer('sort_order').default(0),
    usageCount: integer('usage_count').default(0),
    lastUsedAt: text('last_used_at'),
    incomeFrequency: text('income_frequency', {
      enum: ['weekly', 'biweekly', 'monthly', 'variable'],
    }).default('variable'),
    // System category flags (Phase 1.4)
    isSystemCategory: boolean('is_system_category').default(false),
    isInterestCategory: boolean('is_interest_category').default(false),
    // Budget rollover (Phase 1.4)
    rolloverEnabled: boolean('rollover_enabled').default(false),
    rolloverBalance: doublePrecision('rollover_balance').default(0),
    rolloverLimit: doublePrecision('rollover_limit'), // null = unlimited
    // Budget groups / subcategories
    parentId: text('parent_id'), // null = top-level category, id = child of a budget group
    isBudgetGroup: boolean('is_budget_group').default(false), // true = parent group (Needs, Wants, Savings)
    targetAllocation: doublePrecision('target_allocation'), // percentage allocation for budget groups (e.g., 50 for 50%)
    createdAt: text('created_at').default(pgNowIso),
  },
  (table) => ({
    userIdIdx: index('idx_budget_categories_user').on(table.userId),
    householdIdIdx: index('idx_budget_categories_household').on(table.householdId),
    userHouseholdIdx: index('idx_budget_categories_user_household').on(table.userId, table.householdId),
    userTypeIdx: index('idx_budget_categories_user_type').on(table.userId, table.type),
    userUsageIdx: index('idx_budget_categories_user_usage').on(table.userId, table.usageCount),
    userActiveIdx: index('idx_budget_categories_user_active').on(table.userId, table.isActive),
    systemCategoryIdx: index('idx_budget_categories_system').on(table.isSystemCategory),
    rolloverIdx: index('idx_budget_categories_rollover').on(table.rolloverEnabled),
    parentIdIdx: index('idx_budget_categories_parent').on(table.parentId),
    budgetGroupIdx: index('idx_budget_categories_budget_group').on(table.isBudgetGroup),
  })
);

export const merchants = pgTable(
  'merchants',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    name: text('name').notNull(),
    normalizedName: text('normalized_name').notNull(),
    categoryId: text('category_id'),
    isSalesTaxExempt: boolean('is_sales_tax_exempt').default(false),
    usageCount: integer('usage_count').default(1),
    lastUsedAt: text('last_used_at').default(pgNowIso),
    totalSpent: doublePrecision('total_spent').default(0),
    averageTransaction: doublePrecision('average_transaction').default(0),
    createdAt: text('created_at').default(pgNowIso),
    updatedAt: text('updated_at').default(pgNowIso),
  },
  (table) => ({
    userHouseholdNormalizedNameUnique: uniqueIndex('idx_merchants_user_household_normalized').on(
      table.userId,
      table.householdId,
      table.normalizedName
    ),
    userIdIdx: index('idx_merchants_user').on(table.userId),
    householdIdIdx: index('idx_merchants_household').on(table.householdId),
    userHouseholdIdx: index('idx_merchants_user_household').on(table.userId, table.householdId),
    userUsageIdx: index('idx_merchants_user_usage').on(table.userId, table.usageCount),
    userLastUsedIdx: index('idx_merchants_user_lastused').on(table.userId, table.lastUsedAt),
  })
);

export const usageAnalytics = pgTable(
  'usage_analytics',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    itemType: text('item_type', {
      enum: ['account', 'category', 'merchant', 'transfer_pair', 'bill'],
    }).notNull(),
    itemId: text('item_id').notNull(),
    itemSecondaryId: text('item_secondary_id'),
    usageCount: integer('usage_count').default(1),
    lastUsedAt: text('last_used_at').default(pgNowIso),
    contextData: text('context_data'),
    createdAt: text('created_at').default(pgNowIso),
  },
  (table) => ({
    uniqueUsageAnalytics: uniqueIndex('idx_usage_analytics_unique').on(
      table.userId,
      table.householdId,
      table.itemType,
      table.itemId,
      table.itemSecondaryId
    ),
    userIdIdx: index('idx_usage_analytics_user').on(table.userId),
    householdIdIdx: index('idx_usage_analytics_household').on(table.householdId),
    userHouseholdIdx: index('idx_usage_analytics_user_household').on(table.userId, table.householdId),
  })
);

export const transactions = pgTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    entityId: text('entity_id'),
    accountId: text('account_id').notNull(),
    categoryId: text('category_id'),
    merchantId: text('merchant_id'),
    billId: text('bill_id'),
    debtId: text('debt_id'), // Direct link to debt for manual/irregular payments
    savingsGoalId: text('savings_goal_id'), // Link to savings goal for contributions (Phase 1.5)
    date: text('date').notNull(),
    amount: doublePrecision('amount').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull().default(0),
    description: text('description').notNull(),
    notes: text('notes'),
    type: text('type', {
      enum: ['income', 'expense', 'transfer_in', 'transfer_out'],
    }).default('expense'),
    transferId: text('transfer_id'),
    transferGroupId: text('transfer_group_id'),
    pairedTransactionId: text('paired_transaction_id'),
    transferSourceAccountId: text('transfer_source_account_id'),
    transferDestinationAccountId: text('transfer_destination_account_id'),
    isPending: boolean('is_pending').default(false),
    isRecurring: boolean('is_recurring').default(false),
    recurringRule: text('recurring_rule'),
    receiptUrl: text('receipt_url'),
    isSplit: boolean('is_split').default(false),
    splitParentId: text('split_parent_id'),
    isTaxDeductible: boolean('is_tax_deductible').default(false),
    taxDeductionType: text('tax_deduction_type', {
      enum: ['business', 'personal', 'none'],
    }).default('none'),
    isSalesTaxable: boolean('is_sales_taxable').default(false),
    // Phase 5: Transaction flow fields
    isBalanceTransfer: boolean('is_balance_transfer').default(false),
    isRefund: boolean('is_refund').default(false),
    importHistoryId: text('import_history_id'),
    importRowNumber: integer('import_row_number'),
    // Offline sync tracking fields
    syncStatus: text('sync_status', {
      enum: ['pending', 'syncing', 'synced', 'error', 'offline'],
    }).default('synced'),
    offlineId: text('offline_id'),
    syncedAt: text('synced_at'),
    syncError: text('sync_error'),
    syncAttempts: integer('sync_attempts').default(0),
    createdAt: text('created_at').default(pgNowIso),
    updatedAt: text('updated_at').default(pgNowIso),
  },
  (table) => ({
    accountIdIdx: index('idx_transactions_account').on(table.accountId),
    userIdIdx: index('idx_transactions_user').on(table.userId),
    householdIdIdx: index('idx_transactions_household').on(table.householdId),
    entityIdIdx: index('idx_transactions_entity').on(table.entityId),
    userHouseholdIdx: index('idx_transactions_user_household').on(table.userId, table.householdId),
    householdDateIdx: index('idx_transactions_household_date').on(table.householdId, table.date),
    dateIdx: index('idx_transactions_date').on(table.date),
    categoryIdIdx: index('idx_transactions_category').on(table.categoryId),
    merchantIdIdx: index('idx_transactions_merchant').on(table.merchantId),
    transferSourceAccountIdIdx: index('idx_transactions_transfer_source_account').on(table.transferSourceAccountId),
    transferDestinationAccountIdIdx: index('idx_transactions_transfer_destination_account').on(table.transferDestinationAccountId),
    transferGroupIdIdx: index('idx_transactions_transfer_group').on(table.transferGroupId),
    pairedTransactionIdIdx: index('idx_transactions_paired_transaction').on(table.pairedTransactionId),
    amountCentsIdx: index('idx_transactions_amount_cents').on(table.amountCents),
    typeIdx: index('idx_transactions_type').on(table.type),
    amountIdx: index('idx_transactions_amount').on(table.amount),
    userDateIdx: index('idx_transactions_user_date').on(table.userId, table.date),
    userCategoryIdx: index('idx_transactions_user_category').on(table.userId, table.categoryId),
    importIdx: index('idx_transactions_import').on(table.importHistoryId),
    // Sync tracking indexes for efficient queries
    syncStatusIdx: index('idx_transactions_sync_status').on(table.syncStatus),
    userSyncIdx: index('idx_transactions_user_sync').on(table.userId, table.syncStatus),
    offlineIdIdx: index('idx_transactions_offline_id').on(table.offlineId),
    // Sales tax indexes for efficient reporting
    salesTaxableIdx: index('idx_transactions_sales_taxable').on(table.isSalesTaxable),
    userSalesTaxableIdx: index('idx_transactions_user_sales_taxable').on(table.userId, table.isSalesTaxable),
    // Savings goal index (Phase 1.5)
    savingsGoalIdx: index('idx_transactions_savings_goal').on(table.savingsGoalId),
    // Phase 5: Balance transfer and refund indexes
    balanceTransferIdx: index('idx_transactions_balance_transfer').on(table.isBalanceTransfer),
    refundIdx: index('idx_transactions_refund').on(table.isRefund),
  })
);

export const transactionSplits = pgTable(
  'transaction_splits',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    transactionId: text('transaction_id').notNull(),
    categoryId: text('category_id').notNull(),
    amount: doublePrecision('amount').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull().default(0),
    description: text('description'),
    percentage: doublePrecision('percentage'),
    isPercentage: boolean('is_percentage').default(false),
    sortOrder: integer('sort_order').default(0),
    notes: text('notes'),
    createdAt: text('created_at').default(pgNowIso),
    updatedAt: text('updated_at').default(pgNowIso),
  },
  (table) => ({
    transactionIdIdx: index('idx_transaction_splits').on(table.transactionId),
    userIdIdx: index('idx_transaction_splits_user').on(table.userId),
    householdIdIdx: index('idx_transaction_splits_household').on(table.householdId),
    userHouseholdIdx: index('idx_transaction_splits_user_household').on(table.userId, table.householdId),
    categoryIdIdx: index('idx_transaction_splits_category').on(table.categoryId),
    userTransactionIdx: index('idx_transaction_splits_user_tx').on(table.userId, table.transactionId),
    amountCentsIdx: index('idx_transaction_splits_amount_cents').on(table.amountCents),
  })
);

// Bill Payments - Track individual payments toward bill instances (Phase 1.3)
export const billPayments = pgTable(
  'bill_payments',
  {
    id: text('id').primaryKey(),
    billId: text('bill_id').notNull(),
    billInstanceId: text('bill_instance_id'),
    transactionId: text('transaction_id'),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    amount: doublePrecision('amount').notNull(),
    principalAmount: doublePrecision('principal_amount'),
    interestAmount: doublePrecision('interest_amount'),
    paymentDate: text('payment_date').notNull(),
    paymentMethod: text('payment_method', {
      enum: ['manual', 'transfer', 'autopay'],
    }).default('manual'),
    linkedAccountId: text('linked_account_id'),
    balanceBeforePayment: doublePrecision('balance_before_payment'),
    balanceAfterPayment: doublePrecision('balance_after_payment'),
    notes: text('notes'),
    createdAt: text('created_at').default(pgNowIso),
  },
  (table) => ({
    billIdIdx: index('idx_bill_payments_bill').on(table.billId),
    billInstanceIdIdx: index('idx_bill_payments_instance').on(table.billInstanceId),
    transactionIdIdx: index('idx_bill_payments_transaction').on(table.transactionId),
    userIdIdx: index('idx_bill_payments_user').on(table.userId),
    householdIdIdx: index('idx_bill_payments_household').on(table.householdId),
    paymentDateIdx: index('idx_bill_payments_date').on(table.paymentDate),
  })
);

// Bill Instance Allocations - Track how bill instances are split across budget periods
export const billInstanceAllocations = pgTable(
  'bill_instance_allocations',
  {
    id: text('id').primaryKey(),
    billInstanceId: text('bill_instance_id').notNull(),
    billId: text('bill_id').notNull(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    periodNumber: integer('period_number').notNull(), // 1, 2, etc.
    allocatedAmount: doublePrecision('allocated_amount').notNull(),
    isPaid: boolean('is_paid').default(false),
    paidAmount: doublePrecision('paid_amount').default(0),
    allocationId: text('allocation_id'), // Links to specific bill payment
    createdAt: text('created_at').default(pgNowIso),
    updatedAt: text('updated_at').default(pgNowIso),
  },
  (table) => ({
    billInstanceIdIdx: index('idx_bill_allocations_instance').on(table.billInstanceId),
    billIdIdx: index('idx_bill_allocations_bill').on(table.billId),
    userIdIdx: index('idx_bill_allocations_user').on(table.userId),
    householdIdIdx: index('idx_bill_allocations_household').on(table.householdId),
    periodNumberIdx: index('idx_bill_allocations_period').on(table.periodNumber),
    householdPeriodInstanceIdx: index('idx_bill_allocations_household_period_instance').on(
      table.householdId,
      table.periodNumber,
      table.billInstanceId
    ),
    instancePeriodUnique: uniqueIndex('idx_bill_allocations_unique').on(
      table.billInstanceId,
      table.periodNumber
    ),
  })
);

export const billTemplates = pgTable(
  'bill_templates',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id').notNull(),
    createdByUserId: text('created_by_user_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    isActive: boolean('is_active').notNull().default(true),
    billType: text('bill_type', {
      enum: ['expense', 'income', 'savings_transfer'],
    }).notNull(),
    classification: text('classification', {
      enum: ['subscription', 'utility', 'housing', 'insurance', 'loan_payment', 'membership', 'service', 'other'],
    }).notNull(),
    classificationSubcategory: text('classification_subcategory'),
    recurrenceType: text('recurrence_type', {
      enum: ['one_time', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semi_annual', 'annual'],
    }).notNull(),
    recurrenceDueDay: integer('recurrence_due_day'),
    recurrenceDueWeekday: integer('recurrence_due_weekday'),
    recurrenceSpecificDueDate: text('recurrence_specific_due_date'),
    recurrenceStartMonth: integer('recurrence_start_month'),
    defaultAmountCents: bigint('default_amount_cents', { mode: 'number' }).notNull().default(0),
    isVariableAmount: boolean('is_variable_amount').notNull().default(false),
    amountToleranceBps: integer('amount_tolerance_bps').notNull().default(500),
    categoryId: text('category_id'),
    merchantId: text('merchant_id'),
    paymentAccountId: text('payment_account_id'),
    linkedLiabilityAccountId: text('linked_liability_account_id'),
    chargedToAccountId: text('charged_to_account_id'),
    autoMarkPaid: boolean('auto_mark_paid').notNull().default(true),
    notes: text('notes'),
    debtEnabled: boolean('debt_enabled').notNull().default(false),
    debtOriginalBalanceCents: bigint('debt_original_balance_cents', { mode: 'number' }),
    debtRemainingBalanceCents: bigint('debt_remaining_balance_cents', { mode: 'number' }),
    debtInterestAprBps: integer('debt_interest_apr_bps'),
    debtInterestType: text('debt_interest_type', {
      enum: ['fixed', 'variable', 'none'],
    }),
    debtStartDate: text('debt_start_date'),
    debtColor: text('debt_color'),
    includeInPayoffStrategy: boolean('include_in_payoff_strategy').notNull().default(true),
    interestTaxDeductible: boolean('interest_tax_deductible').notNull().default(false),
    interestTaxDeductionType: text('interest_tax_deduction_type', {
      enum: ['none', 'mortgage', 'student_loan', 'business', 'heloc_home'],
    })
      .notNull()
      .default('none'),
    interestTaxDeductionLimitCents: bigint('interest_tax_deduction_limit_cents', { mode: 'number' }),
    budgetPeriodAssignment: integer('budget_period_assignment'),
    splitAcrossPeriods: boolean('split_across_periods').notNull().default(false),
    createdAt: text('created_at').notNull().default(pgNowIso),
    updatedAt: text('updated_at').notNull().default(pgNowIso),
  },
  (table) => ({
    householdActiveIdx: index('idx_bill_templates_household_active').on(table.householdId, table.isActive),
    householdTypeIdx: index('idx_bill_templates_household_type').on(table.householdId, table.billType),
    householdClassIdx: index('idx_bill_templates_household_class').on(table.householdId, table.classification),
    linkedLiabilityIdx: index('idx_bill_templates_linked_liability').on(
      table.householdId,
      table.linkedLiabilityAccountId
    ),
  })
);

export const billOccurrences = pgTable(
  'bill_occurrences',
  {
    id: text('id').primaryKey(),
    templateId: text('template_id').notNull(),
    householdId: text('household_id').notNull(),
    dueDate: text('due_date').notNull(),
    status: text('status', {
      enum: ['unpaid', 'partial', 'paid', 'overpaid', 'overdue', 'skipped'],
    })
      .notNull()
      .default('unpaid'),
    amountDueCents: bigint('amount_due_cents', { mode: 'number' }).notNull(),
    amountPaidCents: bigint('amount_paid_cents', { mode: 'number' }).notNull().default(0),
    amountRemainingCents: bigint('amount_remaining_cents', { mode: 'number' }).notNull(),
    actualAmountCents: bigint('actual_amount_cents', { mode: 'number' }),
    paidDate: text('paid_date'),
    lastTransactionId: text('last_transaction_id'),
    daysLate: integer('days_late').notNull().default(0),
    lateFeeCents: bigint('late_fee_cents', { mode: 'number' }).notNull().default(0),
    isManualOverride: boolean('is_manual_override').notNull().default(false),
    budgetPeriodOverride: integer('budget_period_override'),
    notes: text('notes'),
    createdAt: text('created_at').notNull().default(pgNowIso),
    updatedAt: text('updated_at').notNull().default(pgNowIso),
  },
  (table) => ({
    templateDueUnique: uniqueIndex('idx_bill_occurrences_template_due').on(table.templateId, table.dueDate),
    householdDueIdx: index('idx_bill_occurrences_household_due').on(table.householdId, table.dueDate),
    householdStatusDueIdx: index('idx_bill_occurrences_household_status_due').on(
      table.householdId,
      table.status,
      table.dueDate
    ),
    templateIdx: index('idx_bill_occurrences_template').on(table.templateId),
  })
);

export const billOccurrenceAllocations = pgTable(
  'bill_occurrence_allocations',
  {
    id: text('id').primaryKey(),
    occurrenceId: text('occurrence_id').notNull(),
    templateId: text('template_id').notNull(),
    householdId: text('household_id').notNull(),
    periodNumber: integer('period_number').notNull(),
    allocatedAmountCents: bigint('allocated_amount_cents', { mode: 'number' }).notNull(),
    paidAmountCents: bigint('paid_amount_cents', { mode: 'number' }).notNull().default(0),
    isPaid: boolean('is_paid').notNull().default(false),
    paymentEventId: text('payment_event_id'),
    createdAt: text('created_at').notNull().default(pgNowIso),
    updatedAt: text('updated_at').notNull().default(pgNowIso),
  },
  (table) => ({
    occurrencePeriodUnique: uniqueIndex('idx_bill_occurrence_allocations_unique').on(
      table.occurrenceId,
      table.periodNumber
    ),
    householdOccurrenceIdx: index('idx_bill_occurrence_allocations_household_occurrence').on(
      table.householdId,
      table.occurrenceId
    ),
  })
);

export const billPaymentEvents = pgTable(
  'bill_payment_events',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id').notNull(),
    templateId: text('template_id').notNull(),
    occurrenceId: text('occurrence_id').notNull(),
    transactionId: text('transaction_id').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    principalCents: bigint('principal_cents', { mode: 'number' }),
    interestCents: bigint('interest_cents', { mode: 'number' }),
    balanceBeforeCents: bigint('balance_before_cents', { mode: 'number' }),
    balanceAfterCents: bigint('balance_after_cents', { mode: 'number' }),
    paymentDate: text('payment_date').notNull(),
    paymentMethod: text('payment_method', {
      enum: ['manual', 'transfer', 'autopay', 'match'],
    })
      .notNull()
      .default('manual'),
    sourceAccountId: text('source_account_id'),
    idempotencyKey: text('idempotency_key'),
    notes: text('notes'),
    createdAt: text('created_at').notNull().default(pgNowIso),
  },
  (table) => ({
    idempotencyKeyUnique: uniqueIndex('idx_bill_payment_events_idempotency').on(table.idempotencyKey),
    householdDateIdx: index('idx_bill_payment_events_household_date').on(table.householdId, table.paymentDate),
    occurrenceIdx: index('idx_bill_payment_events_occurrence').on(table.occurrenceId),
  })
);

export const autopayRules = pgTable(
  'autopay_rules',
  {
    id: text('id').primaryKey(),
    templateId: text('template_id').notNull(),
    householdId: text('household_id').notNull(),
    isEnabled: boolean('is_enabled').notNull().default(false),
    payFromAccountId: text('pay_from_account_id').notNull(),
    amountType: text('amount_type', {
      enum: ['fixed', 'minimum_payment', 'statement_balance', 'full_balance'],
    }).notNull(),
    fixedAmountCents: bigint('fixed_amount_cents', { mode: 'number' }),
    daysBeforeDue: integer('days_before_due').notNull().default(0),
    createdAt: text('created_at').notNull().default(pgNowIso),
    updatedAt: text('updated_at').notNull().default(pgNowIso),
  },
  (table) => ({
    templateUnique: uniqueIndex('idx_autopay_rules_template').on(table.templateId),
    householdEnabledIdx: index('idx_autopay_rules_household_enabled').on(table.householdId, table.isEnabled),
  })
);

export const autopayRuns = pgTable(
  'autopay_runs',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id').notNull(),
    runDate: text('run_date').notNull(),
    runType: text('run_type', {
      enum: ['scheduled', 'manual', 'dry_run'],
    }).notNull(),
    status: text('status', {
      enum: ['started', 'completed', 'failed'],
    }).notNull(),
    processedCount: integer('processed_count').notNull().default(0),
    successCount: integer('success_count').notNull().default(0),
    failedCount: integer('failed_count').notNull().default(0),
    skippedCount: integer('skipped_count').notNull().default(0),
    totalAmountCents: bigint('total_amount_cents', { mode: 'number' }).notNull().default(0),
    errorSummary: text('error_summary'),
    startedAt: text('started_at').notNull(),
    completedAt: text('completed_at'),
  },
  (table) => ({
    householdDateIdx: index('idx_autopay_runs_household_date').on(table.householdId, table.runDate),
  })
);

export const billMatchEvents = pgTable(
  'bill_match_events',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id').notNull(),
    transactionId: text('transaction_id').notNull(),
    templateId: text('template_id'),
    occurrenceId: text('occurrence_id'),
    confidenceBps: integer('confidence_bps').notNull(),
    decision: text('decision', {
      enum: ['suggested', 'accepted', 'rejected', 'auto_linked', 'no_match'],
    }).notNull(),
    reasonsJson: text('reasons_json'),
    createdAt: text('created_at').notNull().default(pgNowIso),
  },
  (table) => ({
    householdTxIdx: index('idx_bill_match_events_household_tx').on(table.householdId, table.transactionId),
    householdCreatedIdx: index('idx_bill_match_events_household_created').on(table.householdId, table.createdAt),
  })
);

// Bill Milestones - Track payoff milestones for debt bills and credit accounts (Phase 1.3)
export const billMilestones = pgTable(
  'bill_milestones',
  {
    id: text('id').primaryKey(),
    billId: text('bill_id'), // For debt bills
    accountId: text('account_id'), // For credit accounts
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    percentage: integer('percentage').notNull(), // 25, 50, 75, 100
    milestoneBalance: doublePrecision('milestone_balance').notNull(),
    achievedAt: text('achieved_at'),
    notificationSentAt: text('notification_sent_at'),
    createdAt: text('created_at').default(pgNowIso),
  },
  (table) => ({
    billIdIdx: index('idx_bill_milestones_bill').on(table.billId),
    accountIdIdx: index('idx_bill_milestones_account').on(table.accountId),
    userIdIdx: index('idx_bill_milestones_user').on(table.userId),
    householdIdIdx: index('idx_bill_milestones_household').on(table.householdId),
    percentageIdx: index('idx_bill_milestones_percentage').on(table.percentage),
  })
);

export const transfers = pgTable(
  'transfers',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    fromAccountId: text('from_account_id').notNull(),
    toAccountId: text('to_account_id').notNull(),
    amount: doublePrecision('amount').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull().default(0),
    description: text('description'),
    date: text('date').notNull(),
    status: text('status', {
      enum: ['pending', 'completed', 'failed'],
    }).default('completed'),
    fromTransactionId: text('from_transaction_id'),
    toTransactionId: text('to_transaction_id'),
    fees: doublePrecision('fees').default(0),
    feesCents: bigint('fees_cents', { mode: 'number' }).notNull().default(0),
    notes: text('notes'),
    createdAt: text('created_at').default(pgNowIso),
  },
  (table) => ({
    userIdIdx: index('idx_transfers_user').on(table.userId),
    householdIdIdx: index('idx_transfers_household').on(table.householdId),
    userHouseholdIdx: index('idx_transfers_user_household').on(table.userId, table.householdId),
    amountCentsIdx: index('idx_transfers_amount_cents').on(table.amountCents),
    feesCentsIdx: index('idx_transfers_fees_cents').on(table.feesCents),
  })
);

export const transferSuggestions = pgTable(
  'transfer_suggestions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    sourceTransactionId: text('source_transaction_id').notNull(),
    suggestedTransactionId: text('suggested_transaction_id').notNull(),

    // Scoring breakdown
    amountScore: doublePrecision('amount_score').notNull(),
    dateScore: doublePrecision('date_score').notNull(),
    descriptionScore: doublePrecision('description_score').notNull(),
    accountScore: doublePrecision('account_score').notNull(),
    totalScore: doublePrecision('total_score').notNull(),
    confidence: text('confidence').notNull(),

    // User action tracking
    status: text('status').default('pending'),
    reviewedAt: text('reviewed_at'),

    createdAt: text('created_at').default(pgNowIso),
  },
  (table) => ({
    userIdIdx: index('idx_transfer_suggestions_user').on(table.userId),
    householdIdIdx: index('idx_transfer_suggestions_household').on(table.householdId),
    userHouseholdIdx: index('idx_transfer_suggestions_user_household').on(table.userId, table.householdId),
    sourceIdx: index('idx_transfer_suggestions_source').on(table.sourceTransactionId),
    statusIdx: index('idx_transfer_suggestions_status').on(table.status),
  })
);

export const nonMonthlyBills = pgTable(
  'non_monthly_bills',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    januaryDue: integer('january_due'),
    januaryAmount: doublePrecision('january_amount').default(0),
    februaryDue: integer('february_due'),
    februaryAmount: doublePrecision('february_amount').default(0),
    marchDue: integer('march_due'),
    marchAmount: doublePrecision('march_amount').default(0),
    aprilDue: integer('april_due'),
    aprilAmount: doublePrecision('april_amount').default(0),
    mayDue: integer('may_due'),
    mayAmount: doublePrecision('may_amount').default(0),
    juneDue: integer('june_due'),
    juneAmount: doublePrecision('june_amount').default(0),
    julyDue: integer('july_due'),
    julyAmount: doublePrecision('july_amount').default(0),
    augustDue: integer('august_due'),
    augustAmount: doublePrecision('august_amount').default(0),
    septemberDue: integer('september_due'),
    septemberAmount: doublePrecision('september_amount').default(0),
    octoberDue: integer('october_due'),
    octoberAmount: doublePrecision('october_amount').default(0),
    novemberDue: integer('november_due'),
    novemberAmount: doublePrecision('november_amount').default(0),
    decemberDue: integer('december_due'),
    decemberAmount: doublePrecision('december_amount').default(0),
    createdAt: text('created_at').default(pgNowIso),
  },
  (table) => ({
    userIdIdx: index('idx_non_monthly_bills_user').on(table.userId),
  })
);

export const budgetPeriods = pgTable(
  'budget_periods',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    month: integer('month').notNull(),
    year: integer('year').notNull(),
    totalIncome: doublePrecision('total_income').default(0),
    totalVariableExpenses: doublePrecision('total_variable_expenses').default(0),
    totalMonthlyBills: doublePrecision('total_monthly_bills').default(0),
    totalSavings: doublePrecision('total_savings').default(0),
    totalDebtPayments: doublePrecision('total_debt_payments').default(0),
    isActive: boolean('is_active').default(true),
    createdAt: text('created_at').default(pgNowIso),
  },
  (table) => ({
    userIdMonthYearUnique: uniqueIndex('idx_budget_periods_unique').on(
      table.userId,
      table.month,
      table.year
    ),
  })
);

// ============================================================================
// HOUSEHOLD & MULTI-USER TABLES
// ============================================================================

export const households = pgTable(
  'households',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: text('created_at').default(pgNowIso),
    updatedAt: text('updated_at').default(pgNowIso),
  }
);

export const householdMembers = pgTable(
  'household_members',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id').notNull(),
    userId: text('user_id').notNull(),
    userEmail: text('user_email').notNull(),
    userName: text('user_name'),
    role: text('role', {
      enum: ['owner', 'admin', 'member', 'viewer'],
    }).default('member'),
    joinedAt: text('joined_at').default(pgNowIso),
    invitedBy: text('invited_by'),
    isActive: boolean('is_active').default(true),
    isFavorite: boolean('is_favorite').default(false),
    /**
     * Custom permission overrides stored as JSON object.
     * Format: { "permission_name": true/false }
     * Example: { "create_accounts": false, "edit_accounts": true }
     * Null means no custom overrides (use role defaults).
     */
    customPermissions: text('custom_permissions'),
  },
  (table) => ({
    householdUserUnique: uniqueIndex('idx_household_members_unique').on(
      table.householdId,
      table.userId
    ),
  })
);

export const householdEntities = pgTable(
  'household_entities',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id').notNull(),
    name: text('name').notNull(),
    type: text('type', {
      enum: ['personal', 'business'],
    }).notNull(),
    isDefault: boolean('is_default').default(false),
    enableSalesTax: boolean('enable_sales_tax').default(false),
    isActive: boolean('is_active').default(true),
    createdBy: text('created_by').notNull(),
    createdAt: text('created_at').default(pgNowIso),
    updatedAt: text('updated_at').default(pgNowIso),
  },
  (table) => ({
    householdNameUnique: uniqueIndex('idx_household_entities_household_name').on(
      table.householdId,
      table.name
    ),
    householdIdIdx: index('idx_household_entities_household').on(table.householdId),
    householdTypeIdx: index('idx_household_entities_type').on(table.householdId, table.type),
    householdDefaultIdx: index('idx_household_entities_default').on(table.householdId, table.isDefault),
  })
);

export const householdEntityMembers = pgTable(
  'household_entity_members',
  {
    id: text('id').primaryKey(),
    entityId: text('entity_id').notNull(),
    householdId: text('household_id').notNull(),
    userId: text('user_id').notNull(),
    role: text('role', {
      enum: ['owner', 'manager', 'editor', 'viewer'],
    }).default('viewer'),
    canManageEntity: boolean('can_manage_entity').default(false),
    isActive: boolean('is_active').default(true),
    createdAt: text('created_at').default(pgNowIso),
    updatedAt: text('updated_at').default(pgNowIso),
  },
  (table) => ({
    entityUserUnique: uniqueIndex('idx_household_entity_members_unique').on(
      table.entityId,
      table.userId
    ),
    householdUserIdx: index('idx_household_entity_members_household_user').on(
      table.householdId,
      table.userId
    ),
    entityActiveIdx: index('idx_household_entity_members_entity_active').on(
      table.entityId,
      table.isActive
    ),
  })
);

export const householdInvitations = pgTable(
  'household_invitations',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id').notNull(),
    invitedEmail: text('invited_email').notNull(),
    invitedBy: text('invited_by').notNull(),
    role: text('role').default('member'),
    invitationToken: text('invitation_token').notNull().unique(),
    expiresAt: text('expires_at').notNull(),
    acceptedAt: text('accepted_at'),
    status: text('status', {
      enum: ['pending', 'accepted', 'declined', 'expired'],
    }).default('pending'),
    createdAt: text('created_at').default(pgNowIso),
  },
  (table) => ({
    householdIdIdx: index('idx_household_invitations').on(table.householdId),
  })
);

export const activityLog = pgTable(
  'activity_log',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id').notNull(),
    userId: text('user_id').notNull(),
    actionType: text('action_type', {
      enum: [
        'transaction_created',
        'transaction_updated',
        'transaction_deleted',
        'bill_paid',
        'transfer_created',
        'account_created',
        'budget_updated',
        'settings_changed',
      ],
    }).notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    details: text('details'),
    createdAt: text('created_at').default(pgNowIso),
  },
  (table) => ({
    householdActivityIdx: index('idx_household_activity').on(table.householdId, table.createdAt),
  })
);

export const resourcePermissions = pgTable(
  'resource_permissions',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id').notNull(),
    resourceType: text('resource_type', {
      enum: ['account', 'budget_category', 'savings_goal', 'debt'],
    }).notNull(),
    resourceId: text('resource_id').notNull(),
    visibility: text('visibility', {
      enum: ['shared', 'private'],
    }).default('shared'),
    canView: text('can_view').default('all'),
    canEdit: text('can_edit').default('all'),
    allowedUserIds: text('allowed_user_ids'),
    createdBy: text('created_by').notNull(),
    createdAt: text('created_at').default(pgNowIso),
  },
  (table) => ({
    resourcePermissionsUnique: uniqueIndex('idx_resource_permissions_unique').on(
      table.householdId,
      table.resourceType,
      table.resourceId
    ),
  })
);

// ============================================================================
// NOTIFICATIONS & PREFERENCES TABLES
// ============================================================================

export const notifications = pgTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    householdId: text('household_id'),
    type: text('type', {
      enum: [
        'bill_due',
        'bill_overdue',
        'budget_warning',
        'budget_exceeded',
        'budget_review',
        'low_balance',
        'savings_milestone',
        'debt_milestone',
        'spending_summary',
        'reminder',
        'system',
        'income_late',
        'high_utilization',
        'credit_limit_change',
      ],
    }).notNull(),
    priority: text('priority', {
      enum: ['low', 'normal', 'high', 'urgent'],
    }).default('normal'),
    title: text('title').notNull(),
    message: text('message').notNull(),
    actionUrl: text('action_url'),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    isRead: boolean('is_read').default(false),
    isDismissed: boolean('is_dismissed').default(false),
    isActionable: boolean('is_actionable').default(true),
    actionLabel: text('action_label'),
    scheduledFor: text('scheduled_for'),
    sentAt: text('sent_at'),
    readAt: text('read_at'),
    dismissedAt: text('dismissed_at'),
    expiresAt: text('expires_at'),
    metadata: text('metadata'),
    createdAt: text('created_at').default(pgNowIso),
  },
  (table) => ({
    userNotificationsIdx: index('idx_user_notifications').on(
      table.userId,
      table.isRead,
      table.createdAt
    ),
    scheduledNotificationsIdx: index('idx_scheduled_notifications').on(
      table.scheduledFor,
      table.sentAt
    ),
  })
);

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().unique(),
    householdId: text('household_id'),
    billReminderEnabled: boolean('bill_reminder_enabled').default(true),
    billReminderDaysBefore: integer('bill_reminder_days_before').default(3),
    billReminderOnDueDate: boolean('bill_reminder_on_due_date').default(true),
    billOverdueReminder: boolean('bill_overdue_reminder').default(true),
    billReminderChannels: text('bill_reminder_channels').default('["push"]'), // JSON array: ["push", "email", "sms", "slack"]
    budgetWarningEnabled: boolean('budget_warning_enabled').default(true),
    budgetWarningThreshold: integer('budget_warning_threshold').default(80),
    budgetExceededAlert: boolean('budget_exceeded_alert').default(true),
    budgetWarningChannels: text('budget_warning_channels').default('["push"]'),
    budgetExceededChannels: text('budget_exceeded_channels').default('["push"]'),
    budgetReviewEnabled: boolean('budget_review_enabled').default(true),
    budgetReviewChannels: text('budget_review_channels').default('["push"]'),
    lowBalanceAlertEnabled: boolean('low_balance_alert_enabled').default(true),
    lowBalanceThreshold: doublePrecision('low_balance_threshold').default(100.0),
    lowBalanceChannels: text('low_balance_channels').default('["push"]'),
    savingsMilestoneEnabled: boolean('savings_milestone_enabled').default(true),
    savingsMilestoneChannels: text('savings_milestone_channels').default('["push"]'),
    debtMilestoneEnabled: boolean('debt_milestone_enabled').default(true),
    debtMilestoneChannels: text('debt_milestone_channels').default('["push"]'),
    weeklySummaryEnabled: boolean('weekly_summary_enabled').default(true),
    weeklySummaryDay: text('weekly_summary_day').default('sunday'),
    weeklySummaryChannels: text('weekly_summary_channels').default('["push"]'),
    monthlySummaryEnabled: boolean('monthly_summary_enabled').default(true),
    monthlySummaryDay: integer('monthly_summary_day').default(1),
    monthlySummaryChannels: text('monthly_summary_channels').default('["push"]'),
    // Income late alert settings (Phase 16)
    incomeLateAlertEnabled: boolean('income_late_alert_enabled').default(true),
    incomeLateAlertDays: integer('income_late_alert_days').default(1), // Days after expected before alert
    incomeLateChannels: text('income_late_channels').default('["push"]'),
    // Global settings (kept for backward compatibility and global email config)
    pushNotificationsEnabled: boolean('push_notifications_enabled').default(true),
    emailNotificationsEnabled: boolean('email_notifications_enabled').default(false),
    emailAddress: text('email_address'),
    quietHoursStart: text('quiet_hours_start'),
    quietHoursEnd: text('quiet_hours_end'),
    createdAt: text('created_at').default(pgNowIso),
    updatedAt: text('updated_at').default(pgNowIso),
  }
);

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    endpoint: text('endpoint').notNull().unique(),
    p256dhKey: text('p256dh_key').notNull(),
    authKey: text('auth_key').notNull(),
    userAgent: text('user_agent'),
    deviceName: text('device_name'),
    isActive: boolean('is_active').default(true),
    lastUsedAt: text('last_used_at').default(pgNowIso),
    createdAt: text('created_at').default(pgNowIso),
  },
  (table) => ({
    userIdIdx: index('idx_push_subscriptions_user').on(table.userId),
  })
);

// ============================================================================
// USER SETTINGS & PREFERENCES TABLES
// ============================================================================

export const userSettings = pgTable(
  'user_settings',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().unique(),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    bio: text('bio'),
    timezone: text('timezone').default('America/New_York'),
    currency: text('currency').default('USD'),
    currencySymbol: text('currency_symbol').default('$'),
    dateFormat: text('date_format', {
      enum: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'],
    }).default('MM/DD/YYYY'),
    numberFormat: text('number_format', {
      enum: ['en-US', 'en-GB', 'de-DE', 'fr-FR'],
    }).default('en-US'),
    firstDayOfWeek: text('first_day_of_week', {
      enum: ['sunday', 'monday'],
    }).default('sunday'),
    timeFormat: text('time_format', {
      enum: ['12h', '24h'],
    }).default('12h'),
    defaultHouseholdId: text('default_household_id'),
    profileVisibility: text('profile_visibility', {
      enum: ['public', 'household', 'private'],
    }).default('household'),
    showActivity: boolean('show_activity').default(true),
    allowAnalytics: boolean('allow_analytics').default(true),
    reduceMotion: boolean('reduce_motion').default(false),
    highContrast: boolean('high_contrast').default(false),
    textSize: text('text_size', {
      enum: ['small', 'medium', 'large', 'x-large'],
    }).default('medium'),
    theme: text('theme').default('dark-green'),
    // Financial Preferences
    fiscalYearStart: integer('fiscal_year_start').default(1), // 1-12 (January = 1)
    defaultAccountId: text('default_account_id'),
    defaultBudgetMethod: text('default_budget_method').default('monthly'), // monthly, zero-based, 50/30/20
    budgetPeriod: text('budget_period').default('monthly'), // monthly, bi-weekly, weekly
    showCents: boolean('show_cents').default(true),
    negativeNumberFormat: text('negative_number_format').default('-$100'), // -$100, ($100), $100-
    defaultTransactionType: text('default_transaction_type').default('expense'), // income, expense, transfer
    autoCategorization: boolean('auto_categorization').default(true),
    // Privacy & Security
    sessionTimeout: integer('session_timeout').default(30), // minutes of inactivity
    dataRetentionYears: integer('data_retention_years').default(7), // years to keep transactions
    primaryLoginMethod: text('primary_login_method').default('email'), // 'email', 'google', 'github'
    // Data Management
    defaultImportTemplateId: text('default_import_template_id'), // default CSV import template
    // Advanced
    developerMode: boolean('developer_mode').default(false),
    enableAnimations: boolean('enable_animations').default(true),
    experimentalFeatures: boolean('experimental_features').default(false),
    // Onboarding
    onboardingCompleted: boolean('onboarding_completed').default(false),
    createdAt: text('created_at').default(pgNowIso),
    updatedAt: text('updated_at').default(pgNowIso),
  }
);

// ============================================================================
// USER-PER-HOUSEHOLD PREFERENCES (NEW - Phase 0)
// ============================================================================

export const userHouseholdPreferences = pgTable(
  'user_household_preferences',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),

    // Preferences
    dateFormat: text('date_format', {
      enum: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'],
    }).default('MM/DD/YYYY'),
    numberFormat: text('number_format', {
      enum: ['en-US', 'en-GB', 'de-DE', 'fr-FR'],
    }).default('en-US'),
    defaultAccountId: text('default_account_id'),
    firstDayOfWeek: text('first_day_of_week', {
      enum: ['sunday', 'monday'],
    }).default('sunday'),

    // Financial Display
    showCents: boolean('show_cents').default(true),
    negativeNumberFormat: text('negative_number_format').default('-$100'),
    defaultTransactionType: text('default_transaction_type').default('expense'),
    combinedTransferView: boolean('combined_transfer_view').default(true),

    // Theme
    theme: text('theme').default('dark-green'),

    // Notifications - Bill Reminders
    billRemindersEnabled: boolean('bill_reminders_enabled').default(true),
    billRemindersChannels: text('bill_reminders_channels').default('["push","email"]'),

    // Notifications - Budget Warnings
    budgetWarningsEnabled: boolean('budget_warnings_enabled').default(true),
    budgetWarningsChannels: text('budget_warnings_channels').default('["push","email"]'),

    // Notifications - Budget Exceeded
    budgetExceededEnabled: boolean('budget_exceeded_enabled').default(true),
    budgetExceededChannels: text('budget_exceeded_channels').default('["push","email"]'),

    // Notifications - Budget Reviews
    budgetReviewEnabled: boolean('budget_review_enabled').default(true),
    budgetReviewChannels: text('budget_review_channels').default('["push","email"]'),

    // Notifications - Low Balance
    lowBalanceEnabled: boolean('low_balance_enabled').default(true),
    lowBalanceChannels: text('low_balance_channels').default('["push","email"]'),

    // Notifications - Savings Milestones
    savingsMilestonesEnabled: boolean('savings_milestones_enabled').default(true),
    savingsMilestonesChannels: text('savings_milestones_channels').default('["push","email"]'),

    // Notifications - Debt Milestones
    debtMilestonesEnabled: boolean('debt_milestones_enabled').default(true),
    debtMilestonesChannels: text('debt_milestones_channels').default('["push","email"]'),

    // Notifications - Weekly Summaries
    weeklySummariesEnabled: boolean('weekly_summaries_enabled').default(false),
    weeklySummariesChannels: text('weekly_summaries_channels').default('["email"]'),

    // Notifications - Monthly Summaries
    monthlySummariesEnabled: boolean('monthly_summaries_enabled').default(true),
    monthlySummariesChannels: text('monthly_summaries_channels').default('["email"]'),

    // Notifications - High Utilization Alerts (Phase 10)
    highUtilizationEnabled: boolean('high_utilization_enabled').default(true),
    highUtilizationThreshold: integer('high_utilization_threshold').default(75),
    highUtilizationChannels: text('high_utilization_channels').default('["push"]'),

    // Notifications - Credit Limit Changes (Phase 10)
    creditLimitChangeEnabled: boolean('credit_limit_change_enabled').default(true),
    creditLimitChangeChannels: text('credit_limit_change_channels').default('["push"]'),

    // Notifications - Late Income Alerts (Phase 16)
    incomeLateEnabled: boolean('income_late_enabled').default(true),
    incomeLateChannels: text('income_late_channels').default('["push"]'),

    // Budget Schedule Settings
    budgetCycleFrequency: text('budget_cycle_frequency', {
      enum: ['weekly', 'biweekly', 'semi-monthly', 'monthly'],
    }).default('monthly'),
    budgetCycleStartDay: integer('budget_cycle_start_day'), // 0-6 for weekly/biweekly day of week
    budgetCycleReferenceDate: text('budget_cycle_reference_date'), // ISO date for biweekly (e.g., a known Friday)
    budgetCycleSemiMonthlyDays: text('budget_cycle_semi_monthly_days').default('[1, 15]'), // JSON array for semi-monthly
    budgetPeriodRollover: boolean('budget_period_rollover').default(false),
    budgetPeriodManualAmount: doublePrecision('budget_period_manual_amount'), // Optional override per period

    createdAt: text('created_at').default(pgNowIso),
    updatedAt: text('updated_at').default(pgNowIso),
  },
  (table) => ({
    // Composite unique constraint: one record per user per household
    userHouseholdUnique: uniqueIndex('idx_user_household_prefs_unique').on(
      table.userId,
      table.householdId
    ),
    userIdIdx: index('idx_user_household_prefs_user').on(table.userId),
    householdIdIdx: index('idx_user_household_prefs_household').on(table.householdId),
  })
);

// ============================================================================
// UTILIZATION ALERT STATE (Phase 10)
// Tracks which utilization thresholds have been notified to prevent duplicates
// ============================================================================

export const utilizationAlertState = pgTable(
  'utilization_alert_state',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    // Track which thresholds have been notified (reset when utilization drops below)
    threshold30Notified: boolean('threshold_30_notified').default(false),
    threshold50Notified: boolean('threshold_50_notified').default(false),
    threshold75Notified: boolean('threshold_75_notified').default(false),
    threshold90Notified: boolean('threshold_90_notified').default(false),
    // Last known utilization for comparison
    lastUtilization: doublePrecision('last_utilization'),
    lastCheckedAt: text('last_checked_at'),
    createdAt: text('created_at').default(pgNowIso),
    updatedAt: text('updated_at').default(pgNowIso),
  },
  (table) => ({
    accountIdIdx: index('idx_utilization_alert_account').on(table.accountId),
    userIdIdx: index('idx_utilization_alert_user').on(table.userId),
    householdIdIdx: index('idx_utilization_alert_household').on(table.householdId),
    accountUserUnique: uniqueIndex('idx_utilization_alert_unique').on(table.accountId, table.userId),
  })
);

// ============================================================================
// HOUSEHOLD SETTINGS (NEW - Phase 0)
// ============================================================================

export const householdSettings = pgTable(
  'household_settings',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id').notNull().unique(),

    // Preferences
    currency: text('currency').default('USD'),
    currencySymbol: text('currency_symbol').default('$'),
    timeFormat: text('time_format', {
      enum: ['12h', '24h'],
    }).default('12h'),
    fiscalYearStart: integer('fiscal_year_start').default(1), // 1-12

    // Financial
    defaultBudgetMethod: text('default_budget_method').default('monthly'),
    budgetPeriod: text('budget_period').default('monthly'),
    autoCategorization: boolean('auto_categorization').default(true),

    // Data Management
    dataRetentionYears: integer('data_retention_years').default(7),
    autoCleanupEnabled: boolean('auto_cleanup_enabled').default(false),
    cacheStrategy: text('cache_strategy').default('normal'),

    // Debt Payoff Strategy Settings (Phase 1.4)
    debtStrategyEnabled: boolean('debt_strategy_enabled').default(false),
    debtPayoffMethod: text('debt_payoff_method', {
      enum: ['snowball', 'avalanche'],
    }).default('avalanche'),
    extraMonthlyPayment: doublePrecision('extra_monthly_payment').default(0),
    paymentFrequency: text('payment_frequency', {
      enum: ['weekly', 'biweekly', 'monthly'],
    }).default('monthly'),

    // Budget Rollover Settings (Phase 17)
    allowNegativeRollover: boolean('allow_negative_rollover').default(false),

    createdAt: text('created_at').default(pgNowIso),
    updatedAt: text('updated_at').default(pgNowIso),
  },
  (table) => ({
    householdIdIdx: index('idx_household_settings_household').on(table.householdId),
  })
);

// ============================================================================
// BUDGET ROLLOVER HISTORY (Phase 17)
// ============================================================================

export const budgetRolloverHistory = pgTable(
  'budget_rollover_history',
  {
    id: text('id').primaryKey(),
    categoryId: text('category_id').notNull(),
    householdId: text('household_id').notNull(),
    month: text('month').notNull(), // YYYY-MM format
    previousBalance: doublePrecision('previous_balance').notNull().default(0),
    monthlyBudget: doublePrecision('monthly_budget').notNull().default(0),
    actualSpent: doublePrecision('actual_spent').notNull().default(0),
    rolloverAmount: doublePrecision('rollover_amount').notNull().default(0), // amount added/subtracted this period
    newBalance: doublePrecision('new_balance').notNull().default(0),
    rolloverLimit: doublePrecision('rollover_limit'), // NULL means unlimited
    wasCapped: boolean('was_capped').default(false),
    createdAt: text('created_at').default(pgNowIso),
  },
  (table) => ({
    categoryIdx: index('idx_rollover_history_category').on(table.categoryId),
    householdIdx: index('idx_rollover_history_household').on(table.householdId),
    monthIdx: index('idx_rollover_history_month').on(table.month),
    categoryMonthIdx: index('idx_rollover_history_category_month').on(table.categoryId, table.month),
  })
);

export const userSessions = pgTable(
  'user_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    sessionToken: text('session_token').notNull().unique(),
    deviceName: text('device_name'),
    deviceType: text('device_type'),
    browser: text('browser'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    city: text('city'),
    region: text('region'),
    country: text('country'),
    countryCode: text('country_code'),
    isCurrent: boolean('is_current').default(false),
    lastActiveAt: text('last_active_at').default(pgNowIso),
    createdAt: text('created_at').default(pgNowIso),
    expiresAt: text('expires_at'),
  },
  (table) => ({
    userSessionsIdx: index('idx_user_sessions_user').on(table.userId, table.lastActiveAt),
  })
);

export const dataExportRequests = pgTable(
  'data_export_requests',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    status: text('status', {
      enum: ['pending', 'processing', 'completed', 'failed'],
    }).default('pending'),
    exportFormat: text('export_format', {
      enum: ['json', 'csv', 'zip'],
    }).default('json'),
    fileUrl: text('file_url'),
    fileSize: integer('file_size'),
    expiresAt: text('expires_at'),
    requestedAt: text('requested_at').default(pgNowIso),
    completedAt: text('completed_at'),
  }
);

export const accountDeletionRequests = pgTable(
  'account_deletion_requests',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    reason: text('reason'),
    scheduledDeletionDate: text('scheduled_deletion_date').notNull(),
    status: text('status', {
      enum: ['pending', 'cancelled', 'completed'],
    }).default('pending'),
    requestedAt: text('requested_at').default(pgNowIso),
    cancelledAt: text('cancelled_at'),
    completedAt: text('completed_at'),
  }
);

// ============================================================================
// BACKUP SETTINGS & HISTORY
// ============================================================================

export const backupSettings = pgTable(
  'backup_settings',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    enabled: boolean('enabled').default(false),
    frequency: text('frequency', {
      enum: ['daily', 'weekly', 'monthly'],
    }).default('weekly'),
    format: text('format', {
      enum: ['json', 'csv'],
    }).default('json'),
    retentionCount: integer('retention_count').default(10),
    emailBackups: boolean('email_backups').default(false),
    lastBackupAt: text('last_backup_at'),
    nextBackupAt: text('next_backup_at'),
    createdAt: text('created_at').default(pgNowIso),
    updatedAt: text('updated_at').default(pgNowIso),
  },
  (table) => ({
    userIdIdx: index('idx_backup_settings_user').on(table.userId),
    householdIdx: index('idx_backup_settings_household').on(table.userId, table.householdId),
    userHouseholdUnique: uniqueIndex('idx_backup_settings_user_household_unique').on(
      table.userId,
      table.householdId
    ),
  })
);

export const backupHistory = pgTable(
  'backup_history',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    backupSettingsId: text('backup_settings_id').notNull(),
    filename: text('filename').notNull(),
    fileSize: integer('file_size').notNull(),
    format: text('format', {
      enum: ['json', 'csv'],
    }).default('json'),
    status: text('status', {
      enum: ['pending', 'completed', 'failed'],
    }).default('pending'),
    errorMessage: text('error_message'),
    createdAt: text('created_at').default(pgNowIso),
  },
  (table) => ({
    userIdIdx: index('idx_backup_history_user').on(table.userId),
    householdIdx: index('idx_backup_history_household').on(table.userId, table.householdId),
    createdAtIdx: index('idx_backup_history_created').on(table.createdAt),
    statusIdx: index('idx_backup_history_status').on(table.status),
    userCreatedIdx: index('idx_backup_history_user_created').on(table.userId, table.createdAt),
    userHouseholdCreatedIdx: index('idx_backup_history_user_household_created').on(
      table.userId,
      table.householdId,
      table.createdAt
    ),
  })
);

// ============================================================================
// TRANSACTION TEMPLATES
// ============================================================================

export const transactionTemplates = pgTable(
  'transaction_templates',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    accountId: text('account_id').notNull(),
    categoryId: text('category_id'),
    amount: doublePrecision('amount').notNull(),
    type: text('type', {
      enum: ['income', 'expense', 'transfer_in', 'transfer_out'],
    }).notNull(),
    notes: text('notes'),
    usageCount: integer('usage_count').default(0),
    lastUsedAt: text('last_used_at'),
    createdAt: text('created_at').default(pgNowIso),
    updatedAt: text('updated_at').default(pgNowIso),
  },
  (table) => ({
    userIdIdx: index('idx_transaction_templates_user').on(table.userId),
  })
);

// ============================================================================
// CATEGORIZATION RULES
// ============================================================================

export const categorizationRules = pgTable(
  'categorization_rules',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    name: text('name').notNull(),
    categoryId: text('category_id'), // Nullable for backward compatibility, use actions instead
    description: text('description'),
    priority: integer('priority').default(100), // Lower number = higher priority
    isActive: boolean('is_active').default(true),
    conditions: text('conditions').notNull(), // JSON array of condition groups
    actions: text('actions'), // JSON array of actions to apply (set_category, set_description, etc.)
    matchCount: integer('match_count').default(0),
    lastMatchedAt: text('last_matched_at'),
    testResults: text('test_results'), // JSON with test run results
    createdAt: text('created_at').default(pgNowIso),
    updatedAt: text('updated_at').default(pgNowIso),
  },
  (table) => ({
    userIdIdx: index('idx_categorization_rules_user').on(table.userId),
    householdIdIdx: index('idx_categorization_rules_household').on(table.householdId),
    userHouseholdIdx: index('idx_categorization_rules_user_household').on(table.userId, table.householdId),
    priorityIdx: index('idx_categorization_rules_priority').on(table.priority),
  })
);

export const ruleExecutionLog = pgTable(
  'rule_execution_log',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    ruleId: text('rule_id').notNull(),
    transactionId: text('transaction_id').notNull(),
    appliedCategoryId: text('applied_category_id'), // Nullable - may not set category
    appliedActions: text('applied_actions'), // JSON array of all actions applied
    matched: boolean('matched').notNull(),
    executedAt: text('executed_at').default(pgNowIso),
  },
  (table) => ({
    userIdIdx: index('idx_rule_execution_user').on(table.userId),
    householdIdIdx: index('idx_rule_execution_log_household').on(table.householdId),
    userHouseholdIdx: index('idx_rule_execution_log_user_household').on(table.userId, table.householdId),
    ruleIdIdx: index('idx_rule_execution_rule').on(table.ruleId),
    transactionIdIdx: index('idx_rule_execution_transaction').on(table.transactionId),
  })
);

// ============================================================================
// ADVANCED SEARCH
// ============================================================================

export const savedSearchFilters = pgTable(
  'saved_search_filters',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    filters: text('filters').notNull(), // JSON: { query, categoryIds, accountIds, types, amountMin, amountMax, dateStart, dateEnd, isPending, isSplit, hasNotes, sortBy, sortOrder }
    isDefault: boolean('is_default').default(false),
    usageCount: integer('usage_count').default(0),
    lastUsedAt: text('last_used_at'),
    createdAt: text('created_at').default(pgNowIso),
    updatedAt: text('updated_at').default(pgNowIso),
  },
  (table) => ({
    userIdIdx: index('idx_saved_search_filters_user').on(table.userId),
    userDefaultIdx: index('idx_saved_search_filters_user_default').on(table.userId, table.isDefault),
  })
);

export const searchHistory = pgTable(
  'search_history',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    filters: text('filters').notNull(), // JSON: same structure as savedSearchFilters
    resultCount: integer('result_count').notNull(),
    executionTimeMs: integer('execution_time_ms'),
    savedSearchId: text('saved_search_id'), // FK to savedSearchFilters if from saved search
    executedAt: text('executed_at').default(pgNowIso),
  },
  (table) => ({
    userIdIdx: index('idx_search_history_user').on(table.userId),
    userExecutedAtIdx: index('idx_search_history_user_executed').on(table.userId, table.executedAt),
  })
);

// ============================================================================
// CSV IMPORT TABLES
// ============================================================================

export const importTemplates = pgTable(
  'import_templates',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    householdId: text('household_id'),
    name: text('name').notNull(), // e.g., "Chase Credit Card", "Wells Fargo Checking"
    description: text('description'),
    columnMappings: text('column_mappings').notNull(), // JSON: { csvColumn, appField, transform?, defaultValue? }[]
    dateFormat: text('date_format').notNull(), // e.g., "MM/DD/YYYY", "YYYY-MM-DD"
    delimiter: text('delimiter').default(','),
    hasHeaderRow: boolean('has_header_row').default(true),
    skipRows: integer('skip_rows').default(0),
    defaultAccountId: text('default_account_id'),
    isFavorite: boolean('is_favorite').default(false),
    usageCount: integer('usage_count').default(0),
    lastUsedAt: text('last_used_at'),
    // Phase 12: Credit card import enhancements
    sourceType: text('source_type', {
      enum: ['bank', 'credit_card', 'auto'],
    }).default('auto'),
    issuer: text('issuer', {
      enum: ['chase', 'amex', 'capital_one', 'discover', 'citi', 'bank_of_america', 'wells_fargo', 'other'],
    }),
    amountSignConvention: text('amount_sign_convention', {
      enum: ['standard', 'credit_card'],
    }).default('standard'),
    transactionTypePatterns: text('transaction_type_patterns'), // JSON: custom patterns for detecting transaction types
    statementInfoConfig: text('statement_info_config'), // JSON: config for extracting statement info
    createdAt: text('created_at').default(pgNowIso),
    updatedAt: text('updated_at').default(pgNowIso),
  },
  (table) => ({
    userIdIdx: index('idx_import_templates_user').on(table.userId),
    userHouseholdIdx: index('idx_import_templates_user_household').on(table.userId, table.householdId),
    sourceTypeIdx: index('idx_import_templates_source_type').on(table.sourceType),
  })
);

export const importHistory = pgTable(
  'import_history',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    householdId: text('household_id'),
    templateId: text('template_id'),
    filename: text('filename').notNull(),
    fileSize: integer('file_size'),
    rowsTotal: integer('rows_total').notNull(),
    rowsImported: integer('rows_imported').notNull(),
    rowsSkipped: integer('rows_skipped').notNull(),
    rowsDuplicates: integer('rows_duplicates').notNull(),
    status: text('status', {
      enum: ['pending', 'processing', 'completed', 'failed', 'rolled_back'],
    }).notNull(),
    errorMessage: text('error_message'),
    importSettings: text('import_settings'), // JSON of import configuration
    // Phase 12: Credit card import enhancements
    sourceType: text('source_type', {
      enum: ['bank', 'credit_card', 'auto'],
    }),
    statementInfo: text('statement_info'), // JSON: { statementBalance, statementDate, dueDate, minimumPayment, creditLimit }
    startedAt: text('started_at').default(pgNowIso),
    completedAt: text('completed_at'),
    rolledBackAt: text('rolled_back_at'),
  },
  (table) => ({
    userIdIdx: index('idx_import_history_user').on(table.userId),
    userCreatedAtIdx: index('idx_import_history_user_created').on(table.userId, table.startedAt),
  })
);

export const importStaging = pgTable(
  'import_staging',
  {
    id: text('id').primaryKey(),
    importHistoryId: text('import_history_id').notNull(),
    rowNumber: integer('row_number').notNull(),
    rawData: text('raw_data').notNull(), // JSON of original CSV row
    mappedData: text('mapped_data').notNull(), // JSON of mapped transaction data
    duplicateOf: text('duplicate_of'), // ID of existing transaction if duplicate detected
    duplicateScore: doublePrecision('duplicate_score'), // Similarity score (0-100)
    status: text('status', {
      enum: ['pending', 'review', 'approved', 'skipped', 'imported'],
    }).notNull(),
    validationErrors: text('validation_errors'), // JSON array of validation errors
    // Phase 12: Credit card import enhancements
    ccTransactionType: text('cc_transaction_type', {
      enum: ['purchase', 'payment', 'refund', 'interest', 'fee', 'cash_advance', 'balance_transfer', 'reward'],
    }),
    potentialTransferId: text('potential_transfer_id'), // ID of matching transfer transaction
    transferMatchConfidence: doublePrecision('transfer_match_confidence'), // Confidence score for transfer match
    createdAt: text('created_at').default(pgNowIso),
  },
  (table) => ({
    importHistoryIdIdx: index('idx_import_staging_history').on(table.importHistoryId),
    ccTransactionTypeIdx: index('idx_import_staging_cc_type').on(table.ccTransactionType),
    transferIdx: index('idx_import_staging_transfer').on(table.potentialTransferId),
  })
);

// ============================================================================
// TAGS & CUSTOM FIELDS
// ============================================================================

export const tags = pgTable(
  'tags',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    color: text('color').default('#6366f1'),
    description: text('description'),
    icon: text('icon'),
    usageCount: integer('usage_count').default(0),
    lastUsedAt: text('last_used_at'),
    sortOrder: integer('sort_order').default(0),
    createdAt: text('created_at').default(pgNowIso),
    updatedAt: text('updated_at').default(pgNowIso),
  },
  (table) => ({
    userIdIdx: index('idx_tags_user').on(table.userId),
    userNameUnique: uniqueIndex('idx_tags_user_name').on(table.userId, table.name),
    userUsageIdx: index('idx_tags_user_usage').on(table.userId, table.usageCount),
    userLastUsedIdx: index('idx_tags_user_lastused').on(table.userId, table.lastUsedAt),
  })
);

export const transactionTags = pgTable(
  'transaction_tags',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    transactionId: text('transaction_id').notNull(),
    tagId: text('tag_id').notNull(),
    createdAt: text('created_at').default(pgNowIso),
  },
  (table) => ({
    uniqueTransactionTag: uniqueIndex('idx_transaction_tags_unique').on(
      table.transactionId,
      table.tagId
    ),
    userIdIdx: index('idx_transaction_tags_user').on(table.userId),
    transactionIdIdx: index('idx_transaction_tags_transaction').on(table.transactionId),
    tagIdIdx: index('idx_transaction_tags_tag').on(table.tagId),
  })
);

export const customFields = pgTable(
  'custom_fields',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    type: text('type', {
      enum: ['text', 'number', 'date', 'select', 'multiselect', 'checkbox', 'url', 'email'],
    }).notNull(),
    description: text('description'),
    isRequired: boolean('is_required').default(false),
    isActive: boolean('is_active').default(true),
    sortOrder: integer('sort_order').default(0),
    options: text('options'), // JSON array for select/multiselect fields
    defaultValue: text('default_value'),
    placeholder: text('placeholder'),
    validationPattern: text('validation_pattern'), // Regex pattern for validation
    usageCount: integer('usage_count').default(0),
    createdAt: text('created_at').default(pgNowIso),
    updatedAt: text('updated_at').default(pgNowIso),
  },
  (table) => ({
    userIdIdx: index('idx_custom_fields_user').on(table.userId),
    userNameUnique: uniqueIndex('idx_custom_fields_user_name').on(table.userId, table.name),
    userActiveIdx: index('idx_custom_fields_user_active').on(table.userId, table.isActive),
    userUsageIdx: index('idx_custom_fields_user_usage').on(table.userId, table.usageCount),
  })
);

export const customFieldValues = pgTable(
  'custom_field_values',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    customFieldId: text('custom_field_id').notNull(),
    transactionId: text('transaction_id').notNull(),
    value: text('value'), // JSON for complex types (multiselect, arrays, etc.)
    createdAt: text('created_at').default(pgNowIso),
    updatedAt: text('updated_at').default(pgNowIso),
  },
  (table) => ({
    uniqueCustomFieldValue: uniqueIndex('idx_custom_field_values_unique').on(
      table.customFieldId,
      table.transactionId
    ),
    userIdIdx: index('idx_custom_field_values_user').on(table.userId),
    customFieldIdIdx: index('idx_custom_field_values_field').on(table.customFieldId),
    transactionIdIdx: index('idx_custom_field_values_transaction').on(table.transactionId),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const accountsRelations = relations(accounts, ({ many }) => ({
  transactions: many(transactions),
  savingsGoals: many(savingsGoals),
  debts: many(debts),
  transfers: many(transfers),
  creditLimitHistory: many(creditLimitHistory),
  balanceHistory: many(accountBalanceHistory),
}));

export const creditLimitHistoryRelations = relations(creditLimitHistory, ({ one }) => ({
  account: one(accounts, {
    fields: [creditLimitHistory.accountId],
    references: [accounts.id],
  }),
}));

export const accountBalanceHistoryRelations = relations(accountBalanceHistory, ({ one }) => ({
  account: one(accounts, {
    fields: [accountBalanceHistory.accountId],
    references: [accounts.id],
  }),
}));

export const budgetCategoriesRelations = relations(budgetCategories, ({ one, many }) => ({
  transactions: many(transactions),
  transactionSplits: many(transactionSplits),
  merchants: many(merchants),
  // Self-referential relations for budget groups / subcategories
  parent: one(budgetCategories, {
    fields: [budgetCategories.parentId],
    references: [budgetCategories.id],
    relationName: 'parentChild',
  }),
  children: many(budgetCategories, {
    relationName: 'parentChild',
  }),
}));

export const merchantsRelations = relations(merchants, ({ one }) => ({
  category: one(budgetCategories, {
    fields: [merchants.categoryId],
    references: [budgetCategories.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],
  }),
  category: one(budgetCategories, {
    fields: [transactions.categoryId],
    references: [budgetCategories.id],
  }),
  debt: one(debts, {
    fields: [transactions.debtId],
    references: [debts.id],
  }),
  transfer: one(transfers, {
    fields: [transactions.transferGroupId],
    references: [transfers.id],
  }),
  splits: many(transactionSplits),
  tags: many(transactionTags),
  customFieldValues: many(customFieldValues),
}));

export const transactionSplitsRelations = relations(transactionSplits, ({ one }) => ({
  transaction: one(transactions, {
    fields: [transactionSplits.transactionId],
    references: [transactions.id],
  }),
  category: one(budgetCategories, {
    fields: [transactionSplits.categoryId],
    references: [budgetCategories.id],
  }),
}));

export const transfersRelations = relations(transfers, ({ one }) => ({
  fromAccount: one(accounts, {
    fields: [transfers.fromAccountId],
    references: [accounts.id],
  }),
  toAccount: one(accounts, {
    fields: [transfers.toAccountId],
    references: [accounts.id],
  }),
  fromTransaction: one(transactions, {
    fields: [transfers.fromTransactionId],
    references: [transactions.id],
  }),
  toTransaction: one(transactions, {
    fields: [transfers.toTransactionId],
    references: [transactions.id],
  }),
}));

export const householdMembersRelations = relations(householdMembers, ({ one }) => ({
  household: one(households, {
    fields: [householdMembers.householdId],
    references: [households.id],
  }),
}));

export const householdEntitiesRelations = relations(householdEntities, ({ one, many }) => ({
  household: one(households, {
    fields: [householdEntities.householdId],
    references: [households.id],
  }),
  members: many(householdEntityMembers),
}));

export const householdEntityMembersRelations = relations(householdEntityMembers, ({ one }) => ({
  entity: one(householdEntities, {
    fields: [householdEntityMembers.entityId],
    references: [householdEntities.id],
  }),
}));

export const householdsRelations = relations(households, ({ many }) => ({
  members: many(householdMembers),
  entities: many(householdEntities),
  invitations: many(householdInvitations),
  activityLog: many(activityLog),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  preferences: one(notificationPreferences, {
    fields: [notifications.userId],
    references: [notificationPreferences.userId],
  }),
}));

export const transactionTemplatesRelations = relations(transactionTemplates, ({ one }) => ({
  account: one(accounts, {
    fields: [transactionTemplates.accountId],
    references: [accounts.id],
  }),
  category: one(budgetCategories, {
    fields: [transactionTemplates.categoryId],
    references: [budgetCategories.id],
  }),
}));

export const categorizationRulesRelations = relations(categorizationRules, ({ one, many }) => ({
  category: one(budgetCategories, {
    fields: [categorizationRules.categoryId],
    references: [budgetCategories.id],
  }),
  executionLog: many(ruleExecutionLog),
}));

export const ruleExecutionLogRelations = relations(ruleExecutionLog, ({ one }) => ({
  rule: one(categorizationRules, {
    fields: [ruleExecutionLog.ruleId],
    references: [categorizationRules.id],
  }),
  transaction: one(transactions, {
    fields: [ruleExecutionLog.transactionId],
    references: [transactions.id],
  }),
  appliedCategory: one(budgetCategories, {
    fields: [ruleExecutionLog.appliedCategoryId],
    references: [budgetCategories.id],
  }),
}));

export const savedSearchFiltersRelations = relations(savedSearchFilters, ({ many }) => ({
  searchHistory: many(searchHistory),
}));

export const searchHistoryRelations = relations(searchHistory, ({ one }) => ({
  savedSearchFilter: one(savedSearchFilters, {
    fields: [searchHistory.savedSearchId],
    references: [savedSearchFilters.id],
  }),
}));

export const importTemplatesRelations = relations(importTemplates, ({ one, many }) => ({
  account: one(accounts, {
    fields: [importTemplates.defaultAccountId],
    references: [accounts.id],
  }),
  importHistories: many(importHistory),
}));

export const importHistoryRelations = relations(importHistory, ({ one, many }) => ({
  template: one(importTemplates, {
    fields: [importHistory.templateId],
    references: [importTemplates.id],
  }),
  stagingRecords: many(importStaging),
}));

export const importStagingRelations = relations(importStaging, ({ one }) => ({
  importHistory: one(importHistory, {
    fields: [importStaging.importHistoryId],
    references: [importHistory.id],
  }),
  duplicateTransaction: one(transactions, {
    fields: [importStaging.duplicateOf],
    references: [transactions.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  transactionTags: many(transactionTags),
}));

export const transactionTagsRelations = relations(transactionTags, ({ one }) => ({
  transaction: one(transactions, {
    fields: [transactionTags.transactionId],
    references: [transactions.id],
  }),
  tag: one(tags, {
    fields: [transactionTags.tagId],
    references: [tags.id],
  }),
}));

export const customFieldsRelations = relations(customFields, ({ many }) => ({
  values: many(customFieldValues),
}));

export const customFieldValuesRelations = relations(customFieldValues, ({ one }) => ({
  customField: one(customFields, {
    fields: [customFieldValues.customFieldId],
    references: [customFields.id],
  }),
  transaction: one(transactions, {
    fields: [customFieldValues.transactionId],
    references: [transactions.id],
  }),
}));

// ============================================================================
// SAVINGS GOALS SYSTEM
// ============================================================================

export const savingsGoals = pgTable(
  'savings_goals',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    targetAmount: doublePrecision('target_amount').notNull(),
    currentAmount: doublePrecision('current_amount').default(0),
    accountId: text('account_id'),
    category: text('category', {
      enum: ['emergency_fund', 'vacation', 'purchase', 'education', 'home', 'vehicle', 'retirement', 'debt_payoff', 'other'],
    }).default('other'),
    color: text('color').default('#10b981'),
    icon: text('icon').default('target'),
    targetDate: text('target_date'),
    status: text('status', {
      enum: ['active', 'paused', 'completed', 'cancelled'],
    }).default('active'),
    priority: integer('priority').default(0),
    monthlyContribution: doublePrecision('monthly_contribution'),
    notes: text('notes'),
    createdAt: text('created_at').default(pgNowIso),
    updatedAt: text('updated_at').default(pgNowIso),
  },
  (table) => ({
    userIdIdx: index('idx_savings_goals_user').on(table.userId),
    householdIdIdx: index('idx_savings_goals_household').on(table.householdId),
    userHouseholdIdx: index('idx_savings_goals_user_household').on(table.userId, table.householdId),
    statusIdx: index('idx_savings_goals_status').on(table.status),
  })
);

export const savingsMilestones = pgTable(
  'savings_milestones',
  {
    id: text('id').primaryKey(),
    goalId: text('goal_id').notNull(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    percentage: integer('percentage').notNull(), // 25, 50, 75, 100
    milestoneAmount: doublePrecision('milestone_amount').notNull(),
    achievedAt: text('achieved_at'),
    notificationSentAt: text('notification_sent_at'),
    notes: text('notes'),
    createdAt: text('created_at').default(pgNowIso),
  },
  (table) => ({
    userIdIdx: index('idx_savings_milestones_user').on(table.userId),
    householdIdIdx: index('idx_savings_milestones_household').on(table.householdId),
    userHouseholdIdx: index('idx_savings_milestones_user_household').on(table.userId, table.householdId),
    goalIdIdx: index('idx_savings_milestones_goal').on(table.goalId),
  })
);

export const savingsGoalsRelations = relations(savingsGoals, ({ many }) => ({
  milestones: many(savingsMilestones),
  contributions: many(savingsGoalContributions),
}));

export const savingsMilestonesRelations = relations(savingsMilestones, ({ one }) => ({
  goal: one(savingsGoals, {
    fields: [savingsMilestones.goalId],
    references: [savingsGoals.id],
  }),
}));

// Savings Goal Contributions - for tracking transaction contributions to goals (Phase 18)
export const savingsGoalContributions = pgTable(
  'savings_goal_contributions',
  {
    id: text('id').primaryKey(),
    transactionId: text('transaction_id').notNull(),
    goalId: text('goal_id').notNull(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    amount: doublePrecision('amount').notNull(),
    createdAt: text('created_at').default(pgNowIso),
  },
  (table) => ({
    transactionIdx: index('idx_goal_contributions_transaction').on(table.transactionId),
    goalIdx: index('idx_goal_contributions_goal').on(table.goalId),
    userHouseholdIdx: index('idx_goal_contributions_user_household').on(table.userId, table.householdId),
    goalCreatedIdx: index('idx_goal_contributions_goal_created').on(table.goalId, table.createdAt),
  })
);

export const savingsGoalContributionsRelations = relations(savingsGoalContributions, ({ one }) => ({
  transaction: one(transactions, {
    fields: [savingsGoalContributions.transactionId],
    references: [transactions.id],
  }),
  goal: one(savingsGoals, {
    fields: [savingsGoalContributions.goalId],
    references: [savingsGoals.id],
  }),
}));

// ============================================================================
// DEBT MANAGEMENT SYSTEM
// ============================================================================

export const debts = pgTable(
  'debts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    creditorName: text('creditor_name').notNull(),
    originalAmount: doublePrecision('original_amount').notNull(),
    remainingBalance: doublePrecision('remaining_balance').notNull(),
    minimumPayment: doublePrecision('minimum_payment'),
    additionalMonthlyPayment: doublePrecision('additional_monthly_payment').default(0),
    interestRate: doublePrecision('interest_rate').default(0),
    interestType: text('interest_type', {
      enum: ['fixed', 'variable', 'none', 'precomputed'],
    }).default('none'),
    accountId: text('account_id'),
    categoryId: text('category_id'), // Auto-created category for tracking debt payments
    type: text('type', {
      enum: ['credit_card', 'personal_loan', 'student_loan', 'mortgage', 'auto_loan', 'medical', 'other'],
    }).default('other'),
    color: text('color').default('#ef4444'),
    icon: text('icon').default('credit-card'),
    startDate: text('start_date').notNull(),
    targetPayoffDate: text('target_payoff_date'),
    status: text('status', {
      enum: ['active', 'paused', 'paid_off', 'charged_off'],
    }).default('active'),
    priority: integer('priority').default(0),
    // Loan structure fields
    loanType: text('loan_type', {
      enum: ['revolving', 'installment'],
    }).default('revolving'),
    loanTermMonths: integer('loan_term_months'),
    originationDate: text('origination_date'),
    // Interest calculation fields
    compoundingFrequency: text('compounding_frequency', {
      enum: ['daily', 'monthly', 'quarterly', 'annually'],
    }).default('monthly'),
    billingCycleDays: integer('billing_cycle_days').default(30),
    // Credit card specific fields
    lastStatementDate: text('last_statement_date'),
    lastStatementBalance: doublePrecision('last_statement_balance'),
    creditLimit: doublePrecision('credit_limit'), // Credit limit for credit cards (for utilization tracking)
    notes: text('notes'),
    createdAt: text('created_at').default(pgNowIso),
    updatedAt: text('updated_at').default(pgNowIso),
  },
  (table) => ({
    userIdIdx: index('idx_debts_user').on(table.userId),
    householdIdIdx: index('idx_debts_household').on(table.householdId),
    userHouseholdIdx: index('idx_debts_user_household').on(table.userId, table.householdId),
    statusIdx: index('idx_debts_status').on(table.status),
    categoryIdx: index('idx_debts_category').on(table.categoryId),
  })
);

export const debtPayments = pgTable(
  'debt_payments',
  {
    id: text('id').primaryKey(),
    debtId: text('debt_id').notNull(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    amount: doublePrecision('amount').notNull(),
    principalAmount: doublePrecision('principal_amount').default(0),
    interestAmount: doublePrecision('interest_amount').default(0),
    paymentDate: text('payment_date').notNull(),
    transactionId: text('transaction_id'),
    notes: text('notes'),
    createdAt: text('created_at').default(pgNowIso),
  },
  (table) => ({
    userIdIdx: index('idx_debt_payments_user').on(table.userId),
    householdIdIdx: index('idx_debt_payments_household').on(table.householdId),
    userHouseholdIdx: index('idx_debt_payments_user_household').on(table.userId, table.householdId),
    debtIdIdx: index('idx_debt_payments_debt').on(table.debtId),
  })
);

export const debtPayoffMilestones = pgTable(
  'debt_payoff_milestones',
  {
    id: text('id').primaryKey(),
    debtId: text('debt_id').notNull(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    percentage: integer('percentage').notNull(), // 25, 50, 75, 100
    milestoneBalance: doublePrecision('milestone_balance').notNull(), // Balance at which milestone is hit
    achievedAt: text('achieved_at'),
    notificationSentAt: text('notification_sent_at'),
    notes: text('notes'),
    createdAt: text('created_at').default(pgNowIso),
  },
  (table) => ({
    userIdIdx: index('idx_debt_payoff_milestones_user').on(table.userId),
    householdIdIdx: index('idx_debt_payoff_milestones_household').on(table.householdId),
    userHouseholdIdx: index('idx_debt_payoff_milestones_user_household').on(table.userId, table.householdId),
    debtIdIdx: index('idx_debt_payoff_milestones_debt').on(table.debtId),
  })
);

export const debtSettings = pgTable(
  'debt_settings',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    extraMonthlyPayment: doublePrecision('extra_monthly_payment').default(0),
    preferredMethod: text('preferred_method', {
      enum: ['snowball', 'avalanche'],
    }).default('avalanche'),
    paymentFrequency: text('payment_frequency', {
      enum: ['weekly', 'biweekly', 'monthly', 'quarterly'],
    }).default('monthly'),
    createdAt: text('created_at').default(pgNowIso),
    updatedAt: text('updated_at').default(pgNowIso),
  },
  (table) => ({
    userIdIdx: index('idx_debt_settings_user').on(table.userId),
    householdIdIdx: index('idx_debt_settings_household').on(table.householdId),
    userHouseholdIdx: index('idx_debt_settings_user_household').on(table.userId, table.householdId),
  })
);

export const debtsRelations = relations(debts, ({ many }) => ({
  payments: many(debtPayments),
  milestones: many(debtPayoffMilestones),
}));

export const debtPaymentsRelations = relations(debtPayments, ({ one }) => ({
  debt: one(debts, {
    fields: [debtPayments.debtId],
    references: [debts.id],
  }),
  transaction: one(transactions, {
    fields: [debtPayments.transactionId],
    references: [transactions.id],
  }),
}));

export const debtPayoffMilestonesRelations = relations(debtPayoffMilestones, ({ one }) => ({
  debt: one(debts, {
    fields: [debtPayoffMilestones.debtId],
    references: [debts.id],
  }),
}));

// ============================================================================
// HOUSEHOLD ACTIVITY LOGGING
// ============================================================================

export const householdActivityLog = pgTable(
  'household_activity_log',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id'),
    userId: text('user_id').notNull(),
    userName: text('user_name'), // Denormalized for display if user is deleted
    activityType: text('activity_type', {
      enum: [
        'transaction_created',
        'transaction_updated',
        'transaction_deleted',
        'bill_created',
        'bill_updated',
        'bill_deleted',
        'bill_paid',
        'goal_created',
        'goal_updated',
        'goal_deleted',
        'goal_completed',
        'debt_created',
        'debt_updated',
        'debt_deleted',
        'debt_paid',
        'debt_payoff_milestone',
        'member_added',
        'member_removed',
        'member_left',
        'settings_updated',
        'transfer_created',
        'transfer_deleted',
      ],
    }).notNull(),
    entityType: text('entity_type', {
      enum: ['transaction', 'bill', 'goal', 'debt', 'household', 'transfer'],
    }),
    entityId: text('entity_id'),
    entityName: text('entity_name'), // Denormalized name for display
    description: text('description'),
    metadata: text('metadata'), // JSON string for additional data
    createdAt: text('created_at').default(pgNowIso),
  },
  (table) => ({
    userIdIdx: index('idx_activity_log_user').on(table.userId),
    householdIdIdx: index('idx_activity_log_household').on(table.householdId),
    typeIdx: index('idx_activity_log_type').on(table.activityType),
    createdAtIdx: index('idx_activity_log_created_at').on(table.createdAt),
  })
);

// ============================================================================
// TAX TABLES
// ============================================================================

export const taxCategories = pgTable(
  'tax_categories',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    // Tax form references (Schedule C, Schedule A, 1040, etc.)
    formType: text('form_type', {
      enum: ['schedule_c', 'schedule_a', 'schedule_d', 'schedule_e', 'form_1040', 'other'],
    }).notNull(),
    lineNumber: text('line_number'), // Line number on tax form
    deductible: boolean('deductible').default(true),
    category: text('category', {
      enum: ['business_income', 'business_expense', 'rental_income', 'rental_expense',
              'investment_income', 'investment_expense', 'personal_deduction', 'other'],
    }).notNull(),
    sortOrder: integer('sort_order').default(0),
    isActive: boolean('is_active').default(true),
    createdAt: text('created_at').default(pgNowIso),
  },
  (table) => ({
    formTypeIdx: index('idx_tax_categories_form').on(table.formType),
    categoryIdx: index('idx_tax_categories_category').on(table.category),
  })
);

export const categoryTaxMappings = pgTable(
  'category_tax_mappings',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    budgetCategoryId: text('budget_category_id').notNull(),
    taxCategoryId: text('tax_category_id').notNull(),
    taxYear: integer('tax_year').notNull(),
    // Allow custom allocation if a budget category maps to multiple tax categories
    allocationPercentage: doublePrecision('allocation_percentage').default(100),
    notes: text('notes'),
    createdAt: text('created_at').default(pgNowIso),
    updatedAt: text('updated_at').default(pgNowIso),
  },
  (table) => ({
    userIdIdx: index('idx_category_tax_mappings_user').on(table.userId),
    budgetCategoryIdIdx: index('idx_category_tax_mappings_budget_cat').on(table.budgetCategoryId),
    taxCategoryIdIdx: index('idx_category_tax_mappings_tax_cat').on(table.taxCategoryId),
    yearIdx: index('idx_category_tax_mappings_year').on(table.taxYear),
    userYearIdx: index('idx_category_tax_mappings_user_year').on(table.userId, table.taxYear),
  })
);

export const transactionTaxClassifications = pgTable(
  'transaction_tax_classifications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    transactionId: text('transaction_id').notNull(),
    taxCategoryId: text('tax_category_id').notNull(),
    taxYear: integer('tax_year').notNull(),
    // Allow split allocations
    allocatedAmount: doublePrecision('allocated_amount').notNull(),
    percentage: doublePrecision('percentage'),
    isDeductible: boolean('is_deductible').default(true),
    notes: text('notes'),
    createdAt: text('created_at').default(pgNowIso),
    updatedAt: text('updated_at').default(pgNowIso),
  },
  (table) => ({
    userIdIdx: index('idx_transaction_tax_user').on(table.userId),
    transactionIdIdx: index('idx_transaction_tax_transaction').on(table.transactionId),
    taxCategoryIdIdx: index('idx_transaction_tax_category').on(table.taxCategoryId),
    yearIdx: index('idx_transaction_tax_year').on(table.taxYear),
    userYearIdx: index('idx_transaction_tax_user_year').on(table.userId, table.taxYear),
  })
);

// ============================================================================
// SALES TAX TABLES
// ============================================================================

export const salesTaxSettings = pgTable(
  'sales_tax_settings',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    defaultRate: doublePrecision('default_rate').notNull().default(0), // 0-100 (e.g., 8.5 for 8.5%) - computed total for backward compat
    jurisdiction: text('jurisdiction'), // e.g., "California", "New York" - legacy field
    fiscalYearStart: text('fiscal_year_start'), // e.g., "01-01" for calendar year
    filingFrequency: text('filing_frequency', {
      enum: ['monthly', 'quarterly', 'annually'],
    }).default('quarterly'),
    enableTracking: boolean('enable_tracking').default(true),
    // Multi-level tax rates (0-100 percentages)
    stateRate: doublePrecision('state_rate').default(0), // e.g., 6.25 for 6.25%
    countyRate: doublePrecision('county_rate').default(0), // e.g., 0.5 for 0.5%
    cityRate: doublePrecision('city_rate').default(0), // e.g., 1.0 for 1.0%
    specialDistrictRate: doublePrecision('special_district_rate').default(0), // e.g., 0.25 for transit
    // Jurisdiction names for display
    stateName: text('state_name'), // e.g., "Texas"
    countyName: text('county_name'), // e.g., "Travis County"
    cityName: text('city_name'), // e.g., "Austin"
    specialDistrictName: text('special_district_name'), // e.g., "CAMPO Transit"
    createdAt: text('created_at').default(pgNowIso),
    updatedAt: text('updated_at').default(pgNowIso),
  },
  (table) => ({
    userIdIdx: index('idx_sales_tax_settings_user').on(table.userId),
    householdIdIdx: index('idx_sales_tax_settings_household').on(table.householdId),
    userHouseholdUnique: uniqueIndex('idx_sales_tax_settings_user_household_unique').on(
      table.userId,
      table.householdId
    ),
  })
);

export const salesTaxCategories = pgTable(
  'sales_tax_categories',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    name: text('name').notNull(),
    rate: doublePrecision('rate').notNull(), // Tax rate as percentage (8.5 for 8.5%)
    description: text('description'),
    isDefault: boolean('is_default').default(false),
    isActive: boolean('is_active').default(true),
    createdAt: text('created_at').default(pgNowIso),
    updatedAt: text('updated_at').default(pgNowIso),
  },
  (table) => ({
    userIdIdx: index('idx_sales_tax_categories_user').on(table.userId),
    householdIdIdx: index('idx_sales_tax_categories_household').on(table.householdId),
    userActiveIdx: index('idx_sales_tax_categories_user_active').on(table.userId, table.isActive),
    householdActiveIdx: index('idx_sales_tax_categories_household_active').on(
      table.householdId,
      table.isActive
    ),
  })
);

export const salesTaxTransactions = pgTable(
  'sales_tax_transactions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    accountId: text('account_id').notNull(), // Business account for sales tax tracking
    transactionId: text('transaction_id').notNull(),
    transactionDate: text('transaction_date').notNull(),
    taxableAmountCents: integer('taxable_amount_cents').notNull(),
    taxAmountCents: integer('tax_amount_cents').notNull(),
    appliedRateBps: integer('applied_rate_bps').notNull(),
    jurisdictionSnapshot: text('jurisdiction_snapshot'),
    taxYear: integer('tax_year').notNull(),
    quarter: integer('quarter').notNull(), // 1-4
    reportedStatus: text('reported_status', {
      enum: ['pending', 'reported', 'filed', 'paid'],
    }).default('pending'),
    createdAt: text('created_at').default(pgNowIso),
    updatedAt: text('updated_at').default(pgNowIso),
  },
  (table) => ({
    userIdIdx: index('idx_sales_tax_transactions_user').on(table.userId),
    householdIdIdx: index('idx_sales_tax_transactions_household').on(table.householdId),
    accountIdIdx: index('idx_sales_tax_transactions_account').on(table.accountId),
    transactionIdIdx: index('idx_sales_tax_transactions_transaction').on(table.transactionId),
    transactionDateIdx: index('idx_sales_tax_transactions_transaction_date').on(table.transactionDate),
    quarterIdx: index('idx_sales_tax_transactions_quarter').on(table.quarter),
    reportedStatusIdx: index('idx_sales_tax_transactions_status').on(table.reportedStatus),
    userQuarterIdx: index('idx_sales_tax_transactions_user_quarter').on(
      table.userId,
      table.taxYear,
      table.quarter
    ),
    householdQuarterIdx: index('idx_sales_tax_transactions_household_quarter').on(
      table.householdId,
      table.taxYear,
      table.quarter
    ),
    userAccountQuarterIdx: index('idx_sales_tax_transactions_user_account_quarter').on(
      table.userId,
      table.accountId,
      table.taxYear,
      table.quarter
    ),
  })
);

export const quarterlyFilingRecords = pgTable(
  'quarterly_filing_records',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    taxYear: integer('tax_year').notNull(),
    quarter: integer('quarter').notNull(), // 1-4
    dueDate: text('due_date').notNull(), // ISO date
    submittedDate: text('submitted_date'), // When actually filed
    status: text('status', {
      enum: ['not_due', 'pending', 'submitted', 'accepted', 'rejected'],
    }).default('pending'),
    totalSalesAmount: doublePrecision('total_sales_amount').default(0),
    totalTaxAmount: doublePrecision('total_tax_amount').default(0),
    amountPaid: doublePrecision('amount_paid').default(0),
    balanceDue: doublePrecision('balance_due').default(0),
    notes: text('notes'),
    createdAt: text('created_at').default(pgNowIso),
    updatedAt: text('updated_at').default(pgNowIso),
  },
  (table) => ({
    userIdIdx: index('idx_quarterly_filing_user').on(table.userId),
    householdIdIdx: index('idx_quarterly_filing_household').on(table.householdId),
    userYearIdx: index('idx_quarterly_filing_user_year').on(table.userId, table.taxYear),
    householdYearIdx: index('idx_quarterly_filing_household_year').on(
      table.householdId,
      table.taxYear
    ),
    statusIdx: index('idx_quarterly_filing_status').on(table.status),
    dueDateIdx: index('idx_quarterly_filing_due_date').on(table.dueDate),
    userHouseholdYearQuarterUnique: uniqueIndex(
      'idx_quarterly_filing_user_household_year_quarter_unique'
    ).on(table.userId, table.householdId, table.taxYear, table.quarter),
  })
);

// ============================================================================
// BETTER AUTH TABLES - Defined in auth-schema.ts (do not duplicate here)
// Re-export for convenience
// ============================================================================

export { user as betterAuthUser, session as betterAuthSession, account as betterAuthAccount, verification as betterAuthVerification } from '../../auth-schema.pg';

// ============================================================================
// ADMIN & SYSTEM TABLES
// ============================================================================

export const oauthSettings = pgTable(
  'oauth_settings',
  {
    id: text('id').primaryKey(),
    providerId: text('provider_id').notNull().unique(), // 'google', 'github'
    clientId: text('client_id').notNull(),
    clientSecret: text('client_secret').notNull(), // Encrypted
    enabled: boolean('enabled').default(true),
    createdAt: text('created_at').default(pgNowIso),
    updatedAt: text('updated_at').default(pgNowIso),
  },
  (table) => ({
    providerIdIdx: index('idx_oauth_settings_provider').on(table.providerId),
  })
);

// ============================================================================
// TRANSACTION AUDIT LOG
// ============================================================================

export const transactionAuditLog = pgTable(
  'transaction_audit_log',
  {
    id: text('id').primaryKey(),
    transactionId: text('transaction_id').notNull(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    userName: text('user_name'), // Denormalized for display if user is deleted
    actionType: text('action_type', {
      enum: ['created', 'updated', 'deleted'],
    }).notNull(),
    // Field-level changes stored as JSON: { field: { oldValue, newValue, oldDisplayValue?, newDisplayValue? } }[]
    changes: text('changes'),
    // Snapshot of transaction state (for deleted transactions or initial creation)
    snapshot: text('snapshot'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: text('created_at').default(pgNowIso),
  },
  (table) => ({
    transactionIdIdx: index('idx_transaction_audit_log_transaction').on(table.transactionId),
    userIdIdx: index('idx_transaction_audit_log_user').on(table.userId),
    householdIdIdx: index('idx_transaction_audit_log_household').on(table.householdId),
    createdAtIdx: index('idx_transaction_audit_log_created').on(table.createdAt),
    txCreatedIdx: index('idx_transaction_audit_log_tx_created').on(
      table.transactionId,
      table.createdAt
    ),
  })
);

export const transactionAuditLogRelations = relations(transactionAuditLog, ({ one }) => ({
  transaction: one(transactions, {
    fields: [transactionAuditLog.transactionId],
    references: [transactions.id],
  }),
}));

// ============================================================================
// INTEREST DEDUCTION TRACKING (Phase 11: Tax Integration)
// ============================================================================

export const interestDeductions = pgTable(
  'interest_deductions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    billId: text('bill_id').notNull(),
    billPaymentId: text('bill_payment_id').notNull(),
    taxYear: integer('tax_year').notNull(),
    deductionType: text('deduction_type', {
      enum: ['mortgage', 'student_loan', 'business', 'heloc_home'],
    }).notNull(),
    interestAmount: doublePrecision('interest_amount').notNull(), // Total interest in payment
    deductibleAmount: doublePrecision('deductible_amount').notNull(), // Amount after limits applied
    limitApplied: doublePrecision('limit_applied'), // If a limit was enforced
    billLimitApplied: boolean('bill_limit_applied').default(false), // Per-bill limit
    annualLimitApplied: boolean('annual_limit_applied').default(false), // IRS annual limit
    paymentDate: text('payment_date').notNull(),
    taxCategoryId: text('tax_category_id'), // Link to tax_categories for reporting
    createdAt: text('created_at').default(pgNowIso),
  },
  (table) => ({
    userIdIdx: index('idx_interest_deductions_user').on(table.userId),
    householdIdIdx: index('idx_interest_deductions_household').on(table.householdId),
    yearIdx: index('idx_interest_deductions_year').on(table.taxYear),
    typeIdx: index('idx_interest_deductions_type').on(table.deductionType),
    billIdIdx: index('idx_interest_deductions_bill').on(table.billId),
    billPaymentIdIdx: index('idx_interest_deductions_payment').on(table.billPaymentId),
    userYearTypeIdx: index('idx_interest_deductions_user_year_type').on(
      table.userId,
      table.taxYear,
      table.deductionType
    ),
  })
);

// ============================================================================
// CALENDAR SYNC TABLES
// ============================================================================

export const calendarConnections = pgTable(
  'calendar_connections',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    provider: text('provider', {
      enum: ['google', 'ticktick'],
    }).notNull(),
    calendarId: text('calendar_id'), // External calendar ID to sync to
    calendarName: text('calendar_name'), // Display name of the calendar
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token'),
    tokenExpiresAt: text('token_expires_at'),
    isActive: boolean('is_active').default(true),
    createdAt: text('created_at').default(pgNowIso),
    updatedAt: text('updated_at').default(pgNowIso),
  },
  (table) => ({
    userIdIdx: index('idx_calendar_connections_user').on(table.userId),
    householdIdIdx: index('idx_calendar_connections_household').on(table.householdId),
    userHouseholdIdx: index('idx_calendar_connections_user_household').on(table.userId, table.householdId),
    providerIdx: index('idx_calendar_connections_provider').on(table.provider),
  })
);

export const calendarSyncSettings = pgTable(
  'calendar_sync_settings',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    syncMode: text('sync_mode', {
      enum: ['direct', 'budget_period'],
    }).default('direct'),
    syncBills: boolean('sync_bills').default(true),
    syncSavingsMilestones: boolean('sync_savings_milestones').default(true),
    syncDebtMilestones: boolean('sync_debt_milestones').default(true),
    syncPayoffDates: boolean('sync_payoff_dates').default(true),
    syncGoalTargetDates: boolean('sync_goal_target_dates').default(true),
    reminderMinutes: integer('reminder_minutes').default(1440), // 1 day before (null = no reminder)
    lastFullSyncAt: text('last_full_sync_at'),
    createdAt: text('created_at').default(pgNowIso),
    updatedAt: text('updated_at').default(pgNowIso),
  },
  (table) => ({
    userIdIdx: index('idx_calendar_sync_settings_user').on(table.userId),
    householdIdIdx: index('idx_calendar_sync_settings_household').on(table.householdId),
    userHouseholdIdx: index('idx_calendar_sync_settings_user_household').on(table.userId, table.householdId),
  })
);

export const calendarEvents = pgTable(
  'calendar_events',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    connectionId: text('connection_id').notNull(),
    externalEventId: text('external_event_id').notNull(),
    sourceType: text('source_type', {
      enum: ['bill_instance', 'savings_milestone', 'debt_milestone', 'goal_target', 'payoff_date', 'budget_period_bills'],
    }).notNull(),
    sourceId: text('source_id').notNull(), // ID of the source entity or period key for budget_period_bills
    eventDate: text('event_date').notNull(), // Actual date on calendar (may differ from source in budget period mode)
    syncMode: text('sync_mode', {
      enum: ['direct', 'budget_period'],
    }).notNull(),
    eventTitle: text('event_title'), // Cached title for display
    lastSyncedAt: text('last_synced_at'),
    createdAt: text('created_at').default(pgNowIso),
  },
  (table) => ({
    userIdIdx: index('idx_calendar_events_user').on(table.userId),
    householdIdIdx: index('idx_calendar_events_household').on(table.householdId),
    connectionIdx: index('idx_calendar_events_connection').on(table.connectionId),
    sourceIdx: index('idx_calendar_events_source').on(table.sourceType, table.sourceId),
    externalIdx: index('idx_calendar_events_external').on(table.externalEventId),
    dateIdx: index('idx_calendar_events_date').on(table.eventDate),
  })
);

// Calendar Sync Relations
export const calendarConnectionsRelations = relations(calendarConnections, ({ many }) => ({
  events: many(calendarEvents),
}));

export const calendarEventsRelations = relations(calendarEvents, ({ one }) => ({
  connection: one(calendarConnections, {
    fields: [calendarEvents.connectionId],
    references: [calendarConnections.id],
  }),
}));
