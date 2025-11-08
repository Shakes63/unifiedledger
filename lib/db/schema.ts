import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  uniqueIndex,
  index,
} from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// CORE TABLES
// ============================================================================

export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    type: text('type', {
      enum: ['checking', 'savings', 'credit', 'investment', 'cash'],
    }).notNull(),
    bankName: text('bank_name'),
    accountNumberLast4: text('account_number_last4'),
    currentBalance: real('current_balance').default(0),
    availableBalance: real('available_balance'),
    creditLimit: real('credit_limit'),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    color: text('color').default('#3b82f6'),
    icon: text('icon').default('wallet'),
    sortOrder: integer('sort_order').default(0),
    usageCount: integer('usage_count').default(0),
    lastUsedAt: text('last_used_at'),
    createdAt: text('created_at').default(new Date().toISOString()),
    updatedAt: text('updated_at').default(new Date().toISOString()),
  },
  (table) => ({
    userIdIdx: index('idx_accounts_user').on(table.userId),
  })
);

export const budgetCategories = sqliteTable(
  'budget_categories',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    type: text('type', {
      enum: ['income', 'variable_expense', 'monthly_bill', 'savings', 'debt', 'non_monthly_bill'],
    }).notNull(),
    monthlyBudget: real('monthly_budget').default(0),
    dueDate: integer('due_date'),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    sortOrder: integer('sort_order').default(0),
    usageCount: integer('usage_count').default(0),
    lastUsedAt: text('last_used_at'),
    createdAt: text('created_at').default(new Date().toISOString()),
  },
  (table) => ({
    userIdIdx: index('idx_budget_categories_user').on(table.userId),
  })
);

export const merchants = sqliteTable(
  'merchants',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    normalizedName: text('normalized_name').notNull(),
    categoryId: text('category_id'),
    usageCount: integer('usage_count').default(1),
    lastUsedAt: text('last_used_at').default(new Date().toISOString()),
    totalSpent: real('total_spent').default(0),
    averageTransaction: real('average_transaction').default(0),
    createdAt: text('created_at').default(new Date().toISOString()),
    updatedAt: text('updated_at').default(new Date().toISOString()),
  },
  (table) => ({
    userIdNormalizedNameUnique: uniqueIndex('idx_merchants_user_normalized').on(
      table.userId,
      table.normalizedName
    ),
    userIdIdx: index('idx_merchants_user').on(table.userId),
  })
);

export const usageAnalytics = sqliteTable(
  'usage_analytics',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    itemType: text('item_type', {
      enum: ['account', 'category', 'merchant', 'transfer_pair', 'bill'],
    }).notNull(),
    itemId: text('item_id').notNull(),
    itemSecondaryId: text('item_secondary_id'),
    usageCount: integer('usage_count').default(1),
    lastUsedAt: text('last_used_at').default(new Date().toISOString()),
    contextData: text('context_data'),
    createdAt: text('created_at').default(new Date().toISOString()),
  },
  (table) => ({
    uniqueUsageAnalytics: uniqueIndex('idx_usage_analytics_unique').on(
      table.userId,
      table.itemType,
      table.itemId,
      table.itemSecondaryId
    ),
    userIdIdx: index('idx_usage_analytics_user').on(table.userId),
  })
);

export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    accountId: text('account_id').notNull(),
    categoryId: text('category_id'),
    billId: text('bill_id'),
    date: text('date').notNull(),
    amount: real('amount').notNull(),
    description: text('description').notNull(),
    notes: text('notes'),
    type: text('type', {
      enum: ['income', 'expense', 'transfer_in', 'transfer_out'],
    }).default('expense'),
    transferId: text('transfer_id'),
    isPending: integer('is_pending', { mode: 'boolean' }).default(false),
    isRecurring: integer('is_recurring', { mode: 'boolean' }).default(false),
    recurringRule: text('recurring_rule'),
    receiptUrl: text('receipt_url'),
    isSplit: integer('is_split', { mode: 'boolean' }).default(false),
    splitParentId: text('split_parent_id'),
    importHistoryId: text('import_history_id'),
    importRowNumber: integer('import_row_number'),
    createdAt: text('created_at').default(new Date().toISOString()),
    updatedAt: text('updated_at').default(new Date().toISOString()),
  },
  (table) => ({
    accountIdIdx: index('idx_transactions_account').on(table.accountId),
    userIdIdx: index('idx_transactions_user').on(table.userId),
    dateIdx: index('idx_transactions_date').on(table.date),
    categoryIdIdx: index('idx_transactions_category').on(table.categoryId),
    typeIdx: index('idx_transactions_type').on(table.type),
    amountIdx: index('idx_transactions_amount').on(table.amount),
    userDateIdx: index('idx_transactions_user_date').on(table.userId, table.date),
    userCategoryIdx: index('idx_transactions_user_category').on(table.userId, table.categoryId),
    importIdx: index('idx_transactions_import').on(table.importHistoryId),
  })
);

export const transactionSplits = sqliteTable(
  'transaction_splits',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    transactionId: text('transaction_id').notNull(),
    categoryId: text('category_id').notNull(),
    amount: real('amount').notNull(),
    description: text('description'),
    percentage: real('percentage'),
    isPercentage: integer('is_percentage', { mode: 'boolean' }).default(false),
    sortOrder: integer('sort_order').default(0),
    notes: text('notes'),
    createdAt: text('created_at').default(new Date().toISOString()),
    updatedAt: text('updated_at').default(new Date().toISOString()),
  },
  (table) => ({
    transactionIdIdx: index('idx_transaction_splits').on(table.transactionId),
    userIdIdx: index('idx_transaction_splits_user').on(table.userId),
    categoryIdIdx: index('idx_transaction_splits_category').on(table.categoryId),
    userTransactionIdx: index('idx_transaction_splits_user_tx').on(table.userId, table.transactionId),
  })
);

export const bills = sqliteTable(
  'bills',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    categoryId: text('category_id'),
    expectedAmount: real('expected_amount').notNull(),
    dueDate: integer('due_date').notNull(),
    isVariableAmount: integer('is_variable_amount', { mode: 'boolean' }).default(false),
    amountTolerance: real('amount_tolerance').default(5.0),
    payeePatterns: text('payee_patterns'),
    accountId: text('account_id'),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    autoMarkPaid: integer('auto_mark_paid', { mode: 'boolean' }).default(true),
    notes: text('notes'),
    createdAt: text('created_at').default(new Date().toISOString()),
  },
  (table) => ({
    userIdIdx: index('idx_bills_user').on(table.userId),
  })
);

export const billInstances = sqliteTable(
  'bill_instances',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    billId: text('bill_id').notNull(),
    dueDate: text('due_date').notNull(),
    expectedAmount: real('expected_amount').notNull(),
    actualAmount: real('actual_amount'),
    paidDate: text('paid_date'),
    transactionId: text('transaction_id'),
    status: text('status', {
      enum: ['pending', 'paid', 'overdue', 'skipped'],
    }).default('pending'),
    daysLate: integer('days_late').default(0),
    lateFee: real('late_fee').default(0),
    isManualOverride: integer('is_manual_override', { mode: 'boolean' }).default(false),
    notes: text('notes'),
    createdAt: text('created_at').default(new Date().toISOString()),
    updatedAt: text('updated_at').default(new Date().toISOString()),
  },
  (table) => ({
    billIdDueDateUnique: uniqueIndex('idx_bill_instances_unique').on(table.billId, table.dueDate),
    userIdIdx: index('idx_bill_instances_user').on(table.userId),
  })
);

export const transfers = sqliteTable(
  'transfers',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    fromAccountId: text('from_account_id').notNull(),
    toAccountId: text('to_account_id').notNull(),
    amount: real('amount').notNull(),
    description: text('description'),
    date: text('date').notNull(),
    status: text('status', {
      enum: ['pending', 'completed', 'failed'],
    }).default('completed'),
    fromTransactionId: text('from_transaction_id'),
    toTransactionId: text('to_transaction_id'),
    fees: real('fees').default(0),
    notes: text('notes'),
    createdAt: text('created_at').default(new Date().toISOString()),
  },
  (table) => ({
    userIdIdx: index('idx_transfers_user').on(table.userId),
  })
);

// ============================================================================
// SAVINGS & DEBT TABLES
// ============================================================================

export const savingsGoals = sqliteTable(
  'savings_goals',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    targetAmount: real('target_amount').notNull(),
    startingAmount: real('starting_amount').default(0),
    currentAmount: real('current_amount').default(0),
    startDate: text('start_date').notNull(),
    targetDate: text('target_date'),
    monthlyContribution: real('monthly_contribution').default(0),
    accountId: text('account_id'),
    isCompleted: integer('is_completed', { mode: 'boolean' }).default(false),
    createdAt: text('created_at').default(new Date().toISOString()),
  },
  (table) => ({
    userIdIdx: index('idx_savings_goals_user').on(table.userId),
  })
);

export const debts = sqliteTable(
  'debts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    currentBalance: real('current_balance').notNull(),
    minimumPayment: real('minimum_payment').notNull(),
    interestRate: real('interest_rate'),
    dueDate: integer('due_date'),
    additionalPayment: real('additional_payment').default(0),
    accountId: text('account_id'),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    priorityOrder: integer('priority_order').default(0),
    createdAt: text('created_at').default(new Date().toISOString()),
  },
  (table) => ({
    userIdIdx: index('idx_debts_user').on(table.userId),
  })
);

export const debtPayoffSettings = sqliteTable(
  'debt_payoff_settings',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().unique(),
    strategy: text('strategy', {
      enum: ['snowball', 'avalanche', 'custom'],
    }).default('snowball'),
    totalExtraPayment: real('total_extra_payment').default(0),
    autoAllocateExtra: integer('auto_allocate_extra', { mode: 'boolean' }).default(true),
    showComparison: integer('show_comparison', { mode: 'boolean' }).default(true),
    payoffStartDate: text('payoff_start_date'),
    startingTotalDebt: real('starting_total_debt').default(0),
    createdAt: text('created_at').default(new Date().toISOString()),
    updatedAt: text('updated_at').default(new Date().toISOString()),
  }
);

export const debtPayoffMilestones = sqliteTable(
  'debt_payoff_milestones',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    milestoneType: text('milestone_type', {
      enum: ['25_percent', '50_percent', '75_percent', 'first_debt_paid', 'halfway', 'final_debt'],
    }).notNull(),
    achievedDate: text('achieved_date').notNull(),
    totalPaidOff: real('total_paid_off').notNull(),
    remainingDebt: real('remaining_debt').notNull(),
    monthsSinceStart: integer('months_since_start'),
    createdAt: text('created_at').default(new Date().toISOString()),
  },
  (table) => ({
    userIdDateIdx: index('idx_milestones_user').on(table.userId, table.achievedDate),
  })
);

export const nonMonthlyBills = sqliteTable(
  'non_monthly_bills',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    januaryDue: integer('january_due'),
    januaryAmount: real('january_amount').default(0),
    februaryDue: integer('february_due'),
    februaryAmount: real('february_amount').default(0),
    marchDue: integer('march_due'),
    marchAmount: real('march_amount').default(0),
    aprilDue: integer('april_due'),
    aprilAmount: real('april_amount').default(0),
    mayDue: integer('may_due'),
    mayAmount: real('may_amount').default(0),
    juneDue: integer('june_due'),
    juneAmount: real('june_amount').default(0),
    julyDue: integer('july_due'),
    julyAmount: real('july_amount').default(0),
    augustDue: integer('august_due'),
    augustAmount: real('august_amount').default(0),
    septemberDue: integer('september_due'),
    septemberAmount: real('september_amount').default(0),
    octoberDue: integer('october_due'),
    octoberAmount: real('october_amount').default(0),
    novemberDue: integer('november_due'),
    novemberAmount: real('november_amount').default(0),
    decemberDue: integer('december_due'),
    decemberAmount: real('december_amount').default(0),
    createdAt: text('created_at').default(new Date().toISOString()),
  },
  (table) => ({
    userIdIdx: index('idx_non_monthly_bills_user').on(table.userId),
  })
);

export const budgetPeriods = sqliteTable(
  'budget_periods',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    month: integer('month').notNull(),
    year: integer('year').notNull(),
    totalIncome: real('total_income').default(0),
    totalVariableExpenses: real('total_variable_expenses').default(0),
    totalMonthlyBills: real('total_monthly_bills').default(0),
    totalSavings: real('total_savings').default(0),
    totalDebtPayments: real('total_debt_payments').default(0),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    createdAt: text('created_at').default(new Date().toISOString()),
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

export const households = sqliteTable(
  'households',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: text('created_at').default(new Date().toISOString()),
    updatedAt: text('updated_at').default(new Date().toISOString()),
  }
);

export const householdMembers = sqliteTable(
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
    joinedAt: text('joined_at').default(new Date().toISOString()),
    invitedBy: text('invited_by'),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
  },
  (table) => ({
    householdUserUnique: uniqueIndex('idx_household_members_unique').on(
      table.householdId,
      table.userId
    ),
  })
);

export const householdInvitations = sqliteTable(
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
    createdAt: text('created_at').default(new Date().toISOString()),
  },
  (table) => ({
    householdIdIdx: index('idx_household_invitations').on(table.householdId),
  })
);

export const activityLog = sqliteTable(
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
    createdAt: text('created_at').default(new Date().toISOString()),
  },
  (table) => ({
    householdActivityIdx: index('idx_household_activity').on(table.householdId, table.createdAt),
  })
);

export const resourcePermissions = sqliteTable(
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
    createdAt: text('created_at').default(new Date().toISOString()),
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

export const notifications = sqliteTable(
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
        'low_balance',
        'savings_milestone',
        'debt_milestone',
        'spending_summary',
        'reminder',
        'system',
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
    isRead: integer('is_read', { mode: 'boolean' }).default(false),
    isDismissed: integer('is_dismissed', { mode: 'boolean' }).default(false),
    isActionable: integer('is_actionable', { mode: 'boolean' }).default(true),
    actionLabel: text('action_label'),
    scheduledFor: text('scheduled_for'),
    sentAt: text('sent_at'),
    readAt: text('read_at'),
    dismissedAt: text('dismissed_at'),
    expiresAt: text('expires_at'),
    metadata: text('metadata'),
    createdAt: text('created_at').default(new Date().toISOString()),
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

export const notificationPreferences = sqliteTable(
  'notification_preferences',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().unique(),
    householdId: text('household_id'),
    billReminderEnabled: integer('bill_reminder_enabled', { mode: 'boolean' }).default(true),
    billReminderDaysBefore: integer('bill_reminder_days_before').default(3),
    billReminderOnDueDate: integer('bill_reminder_on_due_date', { mode: 'boolean' }).default(true),
    billOverdueReminder: integer('bill_overdue_reminder', { mode: 'boolean' }).default(true),
    budgetWarningEnabled: integer('budget_warning_enabled', { mode: 'boolean' }).default(true),
    budgetWarningThreshold: integer('budget_warning_threshold').default(80),
    budgetExceededAlert: integer('budget_exceeded_alert', { mode: 'boolean' }).default(true),
    lowBalanceAlertEnabled: integer('low_balance_alert_enabled', { mode: 'boolean' }).default(true),
    lowBalanceThreshold: real('low_balance_threshold').default(100.0),
    savingsMilestoneEnabled: integer('savings_milestone_enabled', { mode: 'boolean' }).default(true),
    debtMilestoneEnabled: integer('debt_milestone_enabled', { mode: 'boolean' }).default(true),
    weeklySummaryEnabled: integer('weekly_summary_enabled', { mode: 'boolean' }).default(true),
    weeklySummaryDay: text('weekly_summary_day').default('sunday'),
    monthlySummaryEnabled: integer('monthly_summary_enabled', { mode: 'boolean' }).default(true),
    monthlySummaryDay: integer('monthly_summary_day').default(1),
    pushNotificationsEnabled: integer('push_notifications_enabled', { mode: 'boolean' }).default(true),
    emailNotificationsEnabled: integer('email_notifications_enabled', { mode: 'boolean' }).default(false),
    emailAddress: text('email_address'),
    quietHoursStart: text('quiet_hours_start'),
    quietHoursEnd: text('quiet_hours_end'),
    createdAt: text('created_at').default(new Date().toISOString()),
    updatedAt: text('updated_at').default(new Date().toISOString()),
  }
);

export const pushSubscriptions = sqliteTable(
  'push_subscriptions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    endpoint: text('endpoint').notNull().unique(),
    p256dhKey: text('p256dh_key').notNull(),
    authKey: text('auth_key').notNull(),
    userAgent: text('user_agent'),
    deviceName: text('device_name'),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    lastUsedAt: text('last_used_at').default(new Date().toISOString()),
    createdAt: text('created_at').default(new Date().toISOString()),
  },
  (table) => ({
    userIdIdx: index('idx_push_subscriptions_user').on(table.userId),
  })
);

// ============================================================================
// USER SETTINGS & PREFERENCES TABLES
// ============================================================================

export const userSettings = sqliteTable(
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
    showActivity: integer('show_activity', { mode: 'boolean' }).default(true),
    allowAnalytics: integer('allow_analytics', { mode: 'boolean' }).default(true),
    reduceMotion: integer('reduce_motion', { mode: 'boolean' }).default(false),
    highContrast: integer('high_contrast', { mode: 'boolean' }).default(false),
    textSize: text('text_size', {
      enum: ['small', 'medium', 'large', 'x-large'],
    }).default('medium'),
    createdAt: text('created_at').default(new Date().toISOString()),
    updatedAt: text('updated_at').default(new Date().toISOString()),
  }
);

export const userSessions = sqliteTable(
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
    isCurrent: integer('is_current', { mode: 'boolean' }).default(false),
    lastActiveAt: text('last_active_at').default(new Date().toISOString()),
    createdAt: text('created_at').default(new Date().toISOString()),
    expiresAt: text('expires_at'),
  },
  (table) => ({
    userSessionsIdx: index('idx_user_sessions_user').on(table.userId, table.lastActiveAt),
  })
);

export const dataExportRequests = sqliteTable(
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
    requestedAt: text('requested_at').default(new Date().toISOString()),
    completedAt: text('completed_at'),
  }
);

export const accountDeletionRequests = sqliteTable(
  'account_deletion_requests',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    reason: text('reason'),
    scheduledDeletionDate: text('scheduled_deletion_date').notNull(),
    status: text('status', {
      enum: ['pending', 'cancelled', 'completed'],
    }).default('pending'),
    requestedAt: text('requested_at').default(new Date().toISOString()),
    cancelledAt: text('cancelled_at'),
    completedAt: text('completed_at'),
  }
);

// ============================================================================
// TRANSACTION TEMPLATES
// ============================================================================

export const transactionTemplates = sqliteTable(
  'transaction_templates',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    accountId: text('account_id').notNull(),
    categoryId: text('category_id'),
    amount: real('amount').notNull(),
    type: text('type', {
      enum: ['income', 'expense', 'transfer_in', 'transfer_out'],
    }).notNull(),
    notes: text('notes'),
    usageCount: integer('usage_count').default(0),
    lastUsedAt: text('last_used_at'),
    createdAt: text('created_at').default(new Date().toISOString()),
    updatedAt: text('updated_at').default(new Date().toISOString()),
  },
  (table) => ({
    userIdIdx: index('idx_transaction_templates_user').on(table.userId),
  })
);

// ============================================================================
// CATEGORIZATION RULES
// ============================================================================

export const categorizationRules = sqliteTable(
  'categorization_rules',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    categoryId: text('category_id').notNull(),
    description: text('description'),
    priority: integer('priority').default(100), // Lower number = higher priority
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    conditions: text('conditions').notNull(), // JSON array of condition groups
    matchCount: integer('match_count').default(0),
    lastMatchedAt: text('last_matched_at'),
    testResults: text('test_results'), // JSON with test run results
    createdAt: text('created_at').default(new Date().toISOString()),
    updatedAt: text('updated_at').default(new Date().toISOString()),
  },
  (table) => ({
    userIdIdx: index('idx_categorization_rules_user').on(table.userId),
    priorityIdx: index('idx_categorization_rules_priority').on(table.priority),
  })
);

export const ruleExecutionLog = sqliteTable(
  'rule_execution_log',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    ruleId: text('rule_id').notNull(),
    transactionId: text('transaction_id').notNull(),
    appliedCategoryId: text('applied_category_id').notNull(),
    matched: integer('matched', { mode: 'boolean' }).notNull(),
    executedAt: text('executed_at').default(new Date().toISOString()),
  },
  (table) => ({
    userIdIdx: index('idx_rule_execution_user').on(table.userId),
    ruleIdIdx: index('idx_rule_execution_rule').on(table.ruleId),
    transactionIdIdx: index('idx_rule_execution_transaction').on(table.transactionId),
  })
);

// ============================================================================
// ADVANCED SEARCH
// ============================================================================

export const savedSearchFilters = sqliteTable(
  'saved_search_filters',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    filters: text('filters').notNull(), // JSON: { query, categoryIds, accountIds, types, amountMin, amountMax, dateStart, dateEnd, isPending, isSplit, hasNotes, sortBy, sortOrder }
    isDefault: integer('is_default', { mode: 'boolean' }).default(false),
    usageCount: integer('usage_count').default(0),
    lastUsedAt: text('last_used_at'),
    createdAt: text('created_at').default(new Date().toISOString()),
    updatedAt: text('updated_at').default(new Date().toISOString()),
  },
  (table) => ({
    userIdIdx: index('idx_saved_search_filters_user').on(table.userId),
    userDefaultIdx: index('idx_saved_search_filters_user_default').on(table.userId, table.isDefault),
  })
);

export const searchHistory = sqliteTable(
  'search_history',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    filters: text('filters').notNull(), // JSON: same structure as savedSearchFilters
    resultCount: integer('result_count').notNull(),
    executionTimeMs: integer('execution_time_ms'),
    savedSearchId: text('saved_search_id'), // FK to savedSearchFilters if from saved search
    executedAt: text('executed_at').default(new Date().toISOString()),
  },
  (table) => ({
    userIdIdx: index('idx_search_history_user').on(table.userId),
    userExecutedAtIdx: index('idx_search_history_user_executed').on(table.userId, table.executedAt),
  })
);

// ============================================================================
// CSV IMPORT TABLES
// ============================================================================

export const importTemplates = sqliteTable(
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
    hasHeaderRow: integer('has_header_row', { mode: 'boolean' }).default(true),
    skipRows: integer('skip_rows').default(0),
    defaultAccountId: text('default_account_id'),
    isFavorite: integer('is_favorite', { mode: 'boolean' }).default(false),
    usageCount: integer('usage_count').default(0),
    lastUsedAt: text('last_used_at'),
    createdAt: text('created_at').default(new Date().toISOString()),
    updatedAt: text('updated_at').default(new Date().toISOString()),
  },
  (table) => ({
    userIdIdx: index('idx_import_templates_user').on(table.userId),
    userHouseholdIdx: index('idx_import_templates_user_household').on(table.userId, table.householdId),
  })
);

export const importHistory = sqliteTable(
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
    startedAt: text('started_at').default(new Date().toISOString()),
    completedAt: text('completed_at'),
    rolledBackAt: text('rolled_back_at'),
  },
  (table) => ({
    userIdIdx: index('idx_import_history_user').on(table.userId),
    userCreatedAtIdx: index('idx_import_history_user_created').on(table.userId, table.startedAt),
  })
);

export const importStaging = sqliteTable(
  'import_staging',
  {
    id: text('id').primaryKey(),
    importHistoryId: text('import_history_id').notNull(),
    rowNumber: integer('row_number').notNull(),
    rawData: text('raw_data').notNull(), // JSON of original CSV row
    mappedData: text('mapped_data').notNull(), // JSON of mapped transaction data
    duplicateOf: text('duplicate_of'), // ID of existing transaction if duplicate detected
    duplicateScore: real('duplicate_score'), // Similarity score (0-100)
    status: text('status', {
      enum: ['pending', 'review', 'approved', 'skipped', 'imported'],
    }).notNull(),
    validationErrors: text('validation_errors'), // JSON array of validation errors
    createdAt: text('created_at').default(new Date().toISOString()),
  },
  (table) => ({
    importHistoryIdIdx: index('idx_import_staging_history').on(table.importHistoryId),
  })
);

// ============================================================================
// TAGS & CUSTOM FIELDS
// ============================================================================

export const tags = sqliteTable(
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
    createdAt: text('created_at').default(new Date().toISOString()),
    updatedAt: text('updated_at').default(new Date().toISOString()),
  },
  (table) => ({
    userIdIdx: index('idx_tags_user').on(table.userId),
    userNameUnique: uniqueIndex('idx_tags_user_name').on(table.userId, table.name),
  })
);

export const transactionTags = sqliteTable(
  'transaction_tags',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    transactionId: text('transaction_id').notNull(),
    tagId: text('tag_id').notNull(),
    createdAt: text('created_at').default(new Date().toISOString()),
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

export const customFields = sqliteTable(
  'custom_fields',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    type: text('type', {
      enum: ['text', 'number', 'date', 'select', 'multiselect', 'checkbox', 'url', 'email'],
    }).notNull(),
    description: text('description'),
    isRequired: integer('is_required', { mode: 'boolean' }).default(false),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    sortOrder: integer('sort_order').default(0),
    options: text('options'), // JSON array for select/multiselect fields
    defaultValue: text('default_value'),
    placeholder: text('placeholder'),
    validationPattern: text('validation_pattern'), // Regex pattern for validation
    usageCount: integer('usage_count').default(0),
    createdAt: text('created_at').default(new Date().toISOString()),
    updatedAt: text('updated_at').default(new Date().toISOString()),
  },
  (table) => ({
    userIdIdx: index('idx_custom_fields_user').on(table.userId),
    userNameUnique: uniqueIndex('idx_custom_fields_user_name').on(table.userId, table.name),
  })
);

export const customFieldValues = sqliteTable(
  'custom_field_values',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    customFieldId: text('custom_field_id').notNull(),
    transactionId: text('transaction_id').notNull(),
    value: text('value'), // JSON for complex types (multiselect, arrays, etc.)
    createdAt: text('created_at').default(new Date().toISOString()),
    updatedAt: text('updated_at').default(new Date().toISOString()),
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
  bills: many(bills),
  billInstances: many(billInstances),
  savingsGoals: many(savingsGoals),
  debts: many(debts),
  transfers: many(transfers),
}));

export const budgetCategoriesRelations = relations(budgetCategories, ({ many }) => ({
  transactions: many(transactions),
  transactionSplits: many(transactionSplits),
  merchants: many(merchants),
  bills: many(bills),
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
  bill: one(bills, {
    fields: [transactions.billId],
    references: [bills.id],
  }),
  transfer: one(transfers, {
    fields: [transactions.transferId],
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

export const billsRelations = relations(bills, ({ one, many }) => ({
  account: one(accounts, {
    fields: [bills.accountId],
    references: [accounts.id],
  }),
  category: one(budgetCategories, {
    fields: [bills.categoryId],
    references: [budgetCategories.id],
  }),
  instances: many(billInstances),
}));

export const billInstancesRelations = relations(billInstances, ({ one }) => ({
  bill: one(bills, {
    fields: [billInstances.billId],
    references: [bills.id],
  }),
  transaction: one(transactions, {
    fields: [billInstances.transactionId],
    references: [transactions.id],
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

export const savingsGoalsRelations = relations(savingsGoals, ({ one }) => ({
  account: one(accounts, {
    fields: [savingsGoals.accountId],
    references: [accounts.id],
  }),
}));

export const debtsRelations = relations(debts, ({ one }) => ({
  account: one(accounts, {
    fields: [debts.accountId],
    references: [accounts.id],
  }),
}));

export const householdMembersRelations = relations(householdMembers, ({ one }) => ({
  household: one(households, {
    fields: [householdMembers.householdId],
    references: [households.id],
  }),
}));

export const householdsRelations = relations(households, ({ many }) => ({
  members: many(householdMembers),
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

export const savingsGoals = sqliteTable(
  'savings_goals',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    targetAmount: real('target_amount').notNull(),
    currentAmount: real('current_amount').default(0),
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
    monthlyContribution: real('monthly_contribution'),
    notes: text('notes'),
    createdAt: text('created_at').default(new Date().toISOString()),
    updatedAt: text('updated_at').default(new Date().toISOString()),
  },
  (table) => ({
    userIdIdx: index('idx_savings_goals_user').on(table.userId),
    statusIdx: index('idx_savings_goals_status').on(table.status),
  })
);

export const savingsMilestones = sqliteTable(
  'savings_milestones',
  {
    id: text('id').primaryKey(),
    goalId: text('goal_id').notNull(),
    userId: text('user_id').notNull(),
    percentage: integer('percentage').notNull(), // 25, 50, 75, 100
    milestoneAmount: real('milestone_amount').notNull(),
    achievedAt: text('achieved_at'),
    notificationSentAt: text('notification_sent_at'),
    notes: text('notes'),
    createdAt: text('created_at').default(new Date().toISOString()),
  },
  (table) => ({
    userIdIdx: index('idx_savings_milestones_user').on(table.userId),
    goalIdIdx: index('idx_savings_milestones_goal').on(table.goalId),
  })
);

export const savingsGoalsRelations = relations(savingsGoals, ({ many }) => ({
  milestones: many(savingsMilestones),
}));

export const savingsMilestonesRelations = relations(savingsMilestones, ({ one }) => ({
  goal: one(savingsGoals, {
    fields: [savingsMilestones.goalId],
    references: [savingsGoals.id],
  }),
}));

// ============================================================================
// DEBT MANAGEMENT SYSTEM
// ============================================================================

export const debts = sqliteTable(
  'debts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    creditorName: text('creditor_name').notNull(),
    originalAmount: real('original_amount').notNull(),
    remainingBalance: real('remaining_balance').notNull(),
    minimumPayment: real('minimum_payment'),
    interestRate: real('interest_rate').default(0),
    interestType: text('interest_type', {
      enum: ['fixed', 'variable', 'none'],
    }).default('none'),
    accountId: text('account_id'),
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
    notes: text('notes'),
    createdAt: text('created_at').default(new Date().toISOString()),
    updatedAt: text('updated_at').default(new Date().toISOString()),
  },
  (table) => ({
    userIdIdx: index('idx_debts_user').on(table.userId),
    statusIdx: index('idx_debts_status').on(table.status),
  })
);

export const debtPayments = sqliteTable(
  'debt_payments',
  {
    id: text('id').primaryKey(),
    debtId: text('debt_id').notNull(),
    userId: text('user_id').notNull(),
    amount: real('amount').notNull(),
    paymentDate: text('payment_date').notNull(),
    transactionId: text('transaction_id'),
    notes: text('notes'),
    createdAt: text('created_at').default(new Date().toISOString()),
  },
  (table) => ({
    userIdIdx: index('idx_debt_payments_user').on(table.userId),
    debtIdIdx: index('idx_debt_payments_debt').on(table.debtId),
  })
);

export const debtPayoffMilestones = sqliteTable(
  'debt_payoff_milestones',
  {
    id: text('id').primaryKey(),
    debtId: text('debt_id').notNull(),
    userId: text('user_id').notNull(),
    percentage: integer('percentage').notNull(), // 25, 50, 75, 100
    milestoneBalance: real('milestone_balance').notNull(), // Balance at which milestone is hit
    achievedAt: text('achieved_at'),
    notificationSentAt: text('notification_sent_at'),
    notes: text('notes'),
    createdAt: text('created_at').default(new Date().toISOString()),
  },
  (table) => ({
    userIdIdx: index('idx_debt_payoff_milestones_user').on(table.userId),
    debtIdIdx: index('idx_debt_payoff_milestones_debt').on(table.debtId),
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

export const householdActivityLog = sqliteTable(
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
    createdAt: text('created_at').default(new Date().toISOString()),
  },
  (table) => ({
    userIdIdx: index('idx_activity_log_user').on(table.userId),
    householdIdIdx: index('idx_activity_log_household').on(table.householdId),
    typeIdx: index('idx_activity_log_type').on(table.activityType),
    createdAtIdx: index('idx_activity_log_created_at').on(table.createdAt),
  })
);
