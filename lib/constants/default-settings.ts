/**
 * Default user settings values
 * Used when creating new user settings or resetting to defaults
 */

export const DEFAULT_USER_SETTINGS = {
  // Profile
  displayName: null,
  avatarUrl: null,
  bio: null,

  // Localization
  timezone: 'America/New_York',
  currency: 'USD',
  currencySymbol: '$',
  dateFormat: 'MM/DD/YYYY' as const,
  numberFormat: 'en-US' as const,
  firstDayOfWeek: 'sunday' as const,
  timeFormat: '12h' as const,

  // Household
  defaultHouseholdId: null,

  // Privacy
  profileVisibility: 'household' as const,
  showActivity: true,
  allowAnalytics: true,

  // Accessibility
  reduceMotion: false,
  highContrast: false,
  textSize: 'medium' as const,

  // Financial Preferences
  fiscalYearStart: 1, // January
  defaultAccountId: null,
  defaultBudgetMethod: 'monthly',
  budgetPeriod: 'monthly',
  showCents: true,
  negativeNumberFormat: '-$100',
  defaultTransactionType: 'expense',
  autoCategorization: true,

  // Privacy & Security
  sessionTimeout: 30, // minutes
  dataRetentionYears: 7,

  // Advanced
  developerMode: false,
  enableAnimations: true,
  experimentalFeatures: false,
} as const;

/**
 * Default notification preferences
 * Used when creating new notification preferences or resetting to defaults
 */
export const DEFAULT_NOTIFICATION_PREFERENCES = {
  billRemindersEnabled: true,
  billReminderDays: 3,
  billReminderChannels: ['push'] as const,

  budgetWarningsEnabled: true,
  budgetWarningThreshold: 80,
  budgetWarningChannels: ['push'] as const,

  budgetExceededEnabled: true,
  budgetExceededChannels: ['push', 'email'] as const,

  budgetReviewEnabled: true,
  budgetReviewChannels: ['email'] as const,

  lowBalanceEnabled: true,
  lowBalanceThreshold: 100,
  lowBalanceChannels: ['push'] as const,

  savingsMilestonesEnabled: true,
  savingsMilestonesChannels: ['push'] as const,

  debtMilestonesEnabled: true,
  debtMilestonesChannels: ['push'] as const,

  weeklySummaryEnabled: false,
  weeklySummaryDay: 'monday' as const,
  weeklySummaryChannels: ['email'] as const,

  monthlySummaryEnabled: true,
  monthlySummaryDay: 1,
  monthlySummaryChannels: ['email'] as const,
} as const;

/**
 * Tables to PRESERVE (never delete or reset)
 * These contain critical financial data and authentication info
 */
export const PRESERVE_TABLES = [
  // Financial Data
  'transactions',
  'transactionSplits',
  'accounts',
  'budgetCategories',
  'merchants',
  'billTemplates',
  'billOccurrences',
  'billPaymentEvents',
  'autopayRules',
  'billOccurrenceAllocations',
  'savingsGoals',
  'savingsMilestones',
  'debts',
  'debtPayments',
  'debtPayoffMilestones',
  'debtSettings',
  'tags',
  'transactionTags',
  'customFields',
  'customFieldValues',
  'taxCategories',
  'categoryTaxMappings',
  'transactionTaxClassifications',
  'salesTaxSettings',
  'salesTaxCategories',
  'salesTaxTransactions',
  'quarterlyFilingRecords',
  'budgetPeriods',
  'nonMonthlyBills',
  'usageAnalytics',
  'transfers',
  'transferSuggestions',
  'transactionTemplates',

  // User-Created Rules and Configurations
  'categorizationRules',

  // Household Data
  'households',
  'householdMembers',
  'householdEntities',
  'householdEntityMembers',
  'householdInvitations',
  'householdActivityLog',
  'resourcePermissions',

  // Notifications (preserve existing notifications)
  'notifications',

  // Better Auth Tables (CRITICAL - DO NOT TOUCH)
  'user',
  'session',
  'account',
  'verification',

  // Sessions and Subscriptions
  'user_sessions',
  'pushSubscriptions',

  // Import History (preserve for audit trail)
  'importHistory',
] as const;

/**
 * Tables to RESET to defaults
 * These will be updated with default values
 */
export const RESET_TABLES = [
  'user_settings',
  'notification_preferences',
] as const;

/**
 * Tables to CLEAR completely
 * These contain temporary or cached data
 */
export const CLEAR_TABLES = [
  'savedSearchFilters',
  'searchHistory',
  'importStaging',
  'ruleExecutionLog', // Keep recent, clear old
  'dataExportRequests',
  'accountDeletionRequests',
  'importTemplates', // Optional - could preserve
] as const;

/**
 * Number of days to keep in ruleExecutionLog when clearing
 */
export const RULE_LOG_RETENTION_DAYS = 30;

/**
 * Maximum number of reset attempts per user per day
 */
export const MAX_RESET_ATTEMPTS_PER_DAY = 3;
