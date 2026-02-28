/**
 * Database Schema Exports
 * 
 * This file provides a unified schema interface that works with both SQLite and PostgreSQL.
 * At runtime, the correct schema is selected based on DATABASE_URL.
 * For TypeScript, we use SQLite types as the base (the default and most common case).
 * 
 * The actual database operations work correctly at runtime regardless of which
 * database is being used, because both schemas define the same table structures.
 */

import { getDatabaseDialectFromUrl } from "./dialect";
import * as sqlite from "./schema.sqlite";
import * as pg from "./schema.pg";

const dialect = getDatabaseDialectFromUrl(process.env.DATABASE_URL);
const isPostgres = dialect === "postgresql";

// Helper to select the correct schema at runtime while maintaining SQLite types for TypeScript
function selectSchema<T>(sqliteSchema: T, pgSchema: unknown): T {
  return (isPostgres ? pgSchema : sqliteSchema) as T;
}

// Export all tables with consistent SQLite types for TypeScript
// Runtime selects the correct schema based on DATABASE_URL
export const accountBalanceHistory = selectSchema(sqlite.accountBalanceHistory, pg.accountBalanceHistory);
export const accountBalanceHistoryRelations = selectSchema(sqlite.accountBalanceHistoryRelations, pg.accountBalanceHistoryRelations);
export const accountDeletionRequests = selectSchema(sqlite.accountDeletionRequests, pg.accountDeletionRequests);
export const accounts = selectSchema(sqlite.accounts, pg.accounts);
export const accountsRelations = selectSchema(sqlite.accountsRelations, pg.accountsRelations);
export const activityLog = selectSchema(sqlite.activityLog, pg.activityLog);
export const backupHistory = selectSchema(sqlite.backupHistory, pg.backupHistory);
export const backupSettings = selectSchema(sqlite.backupSettings, pg.backupSettings);
export const billInstanceAllocations = selectSchema(sqlite.billInstanceAllocations, pg.billInstanceAllocations);
export const billMatchEvents = selectSchema(sqlite.billMatchEvents, pg.billMatchEvents);
export const billMilestones = selectSchema(sqlite.billMilestones, pg.billMilestones);
export const billOccurrenceAllocations = selectSchema(sqlite.billOccurrenceAllocations, pg.billOccurrenceAllocations);
export const billOccurrences = selectSchema(sqlite.billOccurrences, pg.billOccurrences);
export const billPayments = selectSchema(sqlite.billPayments, pg.billPayments);
export const billPaymentEvents = selectSchema(sqlite.billPaymentEvents, pg.billPaymentEvents);
export const billTemplates = selectSchema(sqlite.billTemplates, pg.billTemplates);
export const autopayRules = selectSchema(sqlite.autopayRules, pg.autopayRules);
export const autopayRuns = selectSchema(sqlite.autopayRuns, pg.autopayRuns);
export const budgetCategories = selectSchema(sqlite.budgetCategories, pg.budgetCategories);
export const budgetCategoriesRelations = selectSchema(sqlite.budgetCategoriesRelations, pg.budgetCategoriesRelations);
export const budgetPeriods = selectSchema(sqlite.budgetPeriods, pg.budgetPeriods);
export const budgetRolloverHistory = selectSchema(sqlite.budgetRolloverHistory, pg.budgetRolloverHistory);
export const calendarConnections = selectSchema(sqlite.calendarConnections, pg.calendarConnections);
export const calendarConnectionsRelations = selectSchema(sqlite.calendarConnectionsRelations, pg.calendarConnectionsRelations);
export const calendarEvents = selectSchema(sqlite.calendarEvents, pg.calendarEvents);
export const calendarEventsRelations = selectSchema(sqlite.calendarEventsRelations, pg.calendarEventsRelations);
export const calendarSyncSettings = selectSchema(sqlite.calendarSyncSettings, pg.calendarSyncSettings);
export const categorizationRules = selectSchema(sqlite.categorizationRules, pg.categorizationRules);
export const categorizationRulesRelations = selectSchema(sqlite.categorizationRulesRelations, pg.categorizationRulesRelations);
export const categoryTaxMappings = selectSchema(sqlite.categoryTaxMappings, pg.categoryTaxMappings);
export const creditLimitHistory = selectSchema(sqlite.creditLimitHistory, pg.creditLimitHistory);
export const creditLimitHistoryRelations = selectSchema(sqlite.creditLimitHistoryRelations, pg.creditLimitHistoryRelations);
export const customFieldValues = selectSchema(sqlite.customFieldValues, pg.customFieldValues);
export const customFieldValuesRelations = selectSchema(sqlite.customFieldValuesRelations, pg.customFieldValuesRelations);
export const customFields = selectSchema(sqlite.customFields, pg.customFields);
export const customFieldsRelations = selectSchema(sqlite.customFieldsRelations, pg.customFieldsRelations);
export const dataExportRequests = selectSchema(sqlite.dataExportRequests, pg.dataExportRequests);
export const debtPayments = selectSchema(sqlite.debtPayments, pg.debtPayments);
export const debtPaymentsRelations = selectSchema(sqlite.debtPaymentsRelations, pg.debtPaymentsRelations);
export const debtPayoffMilestones = selectSchema(sqlite.debtPayoffMilestones, pg.debtPayoffMilestones);
export const debtPayoffMilestonesRelations = selectSchema(sqlite.debtPayoffMilestonesRelations, pg.debtPayoffMilestonesRelations);
export const debtSettings = selectSchema(sqlite.debtSettings, pg.debtSettings);
export const debts = selectSchema(sqlite.debts, pg.debts);
export const debtsRelations = selectSchema(sqlite.debtsRelations, pg.debtsRelations);
export const householdActivityLog = selectSchema(sqlite.householdActivityLog, pg.householdActivityLog);
export const householdInvitations = selectSchema(sqlite.householdInvitations, pg.householdInvitations);
export const householdMembers = selectSchema(sqlite.householdMembers, pg.householdMembers);
export const householdMembersRelations = selectSchema(sqlite.householdMembersRelations, pg.householdMembersRelations);
export const householdEntities = selectSchema(sqlite.householdEntities, pg.householdEntities);
export const householdEntitiesRelations = selectSchema(sqlite.householdEntitiesRelations, pg.householdEntitiesRelations);
export const householdEntityMembers = selectSchema(sqlite.householdEntityMembers, pg.householdEntityMembers);
export const householdEntityMembersRelations = selectSchema(sqlite.householdEntityMembersRelations, pg.householdEntityMembersRelations);
export const householdSettings = selectSchema(sqlite.householdSettings, pg.householdSettings);
export const households = selectSchema(sqlite.households, pg.households);
export const householdsRelations = selectSchema(sqlite.householdsRelations, pg.householdsRelations);
export const importHistory = selectSchema(sqlite.importHistory, pg.importHistory);
export const importHistoryRelations = selectSchema(sqlite.importHistoryRelations, pg.importHistoryRelations);
export const importStaging = selectSchema(sqlite.importStaging, pg.importStaging);
export const importStagingRelations = selectSchema(sqlite.importStagingRelations, pg.importStagingRelations);
export const importTemplates = selectSchema(sqlite.importTemplates, pg.importTemplates);
export const importTemplatesRelations = selectSchema(sqlite.importTemplatesRelations, pg.importTemplatesRelations);
export const interestDeductions = selectSchema(sqlite.interestDeductions, pg.interestDeductions);
export const merchants = selectSchema(sqlite.merchants, pg.merchants);
export const merchantsRelations = selectSchema(sqlite.merchantsRelations, pg.merchantsRelations);
export const nonMonthlyBills = selectSchema(sqlite.nonMonthlyBills, pg.nonMonthlyBills);
export const notificationPreferences = selectSchema(sqlite.notificationPreferences, pg.notificationPreferences);
export const notifications = selectSchema(sqlite.notifications, pg.notifications);
export const notificationsRelations = selectSchema(sqlite.notificationsRelations, pg.notificationsRelations);
export const oauthSettings = selectSchema(sqlite.oauthSettings, pg.oauthSettings);
export const pushSubscriptions = selectSchema(sqlite.pushSubscriptions, pg.pushSubscriptions);
export const quarterlyFilingRecords = selectSchema(sqlite.quarterlyFilingRecords, pg.quarterlyFilingRecords);
export const resourcePermissions = selectSchema(sqlite.resourcePermissions, pg.resourcePermissions);
export const ruleExecutionLog = selectSchema(sqlite.ruleExecutionLog, pg.ruleExecutionLog);
export const ruleExecutionLogRelations = selectSchema(sqlite.ruleExecutionLogRelations, pg.ruleExecutionLogRelations);
export const salesTaxCategories = selectSchema(sqlite.salesTaxCategories, pg.salesTaxCategories);
export const salesTaxSettings = selectSchema(sqlite.salesTaxSettings, pg.salesTaxSettings);
export const salesTaxTransactions = selectSchema(sqlite.salesTaxTransactions, pg.salesTaxTransactions);
export const savedSearchFilters = selectSchema(sqlite.savedSearchFilters, pg.savedSearchFilters);
export const savedSearchFiltersRelations = selectSchema(sqlite.savedSearchFiltersRelations, pg.savedSearchFiltersRelations);
export const savingsGoalContributions = selectSchema(sqlite.savingsGoalContributions, pg.savingsGoalContributions);
export const savingsGoalContributionsRelations = selectSchema(sqlite.savingsGoalContributionsRelations, pg.savingsGoalContributionsRelations);
export const savingsGoals = selectSchema(sqlite.savingsGoals, pg.savingsGoals);
export const savingsGoalsRelations = selectSchema(sqlite.savingsGoalsRelations, pg.savingsGoalsRelations);
export const savingsMilestones = selectSchema(sqlite.savingsMilestones, pg.savingsMilestones);
export const savingsMilestonesRelations = selectSchema(sqlite.savingsMilestonesRelations, pg.savingsMilestonesRelations);
export const searchHistory = selectSchema(sqlite.searchHistory, pg.searchHistory);
export const searchHistoryRelations = selectSchema(sqlite.searchHistoryRelations, pg.searchHistoryRelations);
export const tags = selectSchema(sqlite.tags, pg.tags);
export const tagsRelations = selectSchema(sqlite.tagsRelations, pg.tagsRelations);
export const taxCategories = selectSchema(sqlite.taxCategories, pg.taxCategories);
export const transactionAuditLog = selectSchema(sqlite.transactionAuditLog, pg.transactionAuditLog);
export const transactionAuditLogRelations = selectSchema(sqlite.transactionAuditLogRelations, pg.transactionAuditLogRelations);
export const transactionSplits = selectSchema(sqlite.transactionSplits, pg.transactionSplits);
export const transactionSplitsRelations = selectSchema(sqlite.transactionSplitsRelations, pg.transactionSplitsRelations);
export const transactionTags = selectSchema(sqlite.transactionTags, pg.transactionTags);
export const transactionTagsRelations = selectSchema(sqlite.transactionTagsRelations, pg.transactionTagsRelations);
export const transactionTaxClassifications = selectSchema(sqlite.transactionTaxClassifications, pg.transactionTaxClassifications);
export const transactionTemplates = selectSchema(sqlite.transactionTemplates, pg.transactionTemplates);
export const transactionTemplatesRelations = selectSchema(sqlite.transactionTemplatesRelations, pg.transactionTemplatesRelations);
export const transactions = selectSchema(sqlite.transactions, pg.transactions);
export const transactionsRelations = selectSchema(sqlite.transactionsRelations, pg.transactionsRelations);
export const transferSuggestions = selectSchema(sqlite.transferSuggestions, pg.transferSuggestions);
export const transfers = selectSchema(sqlite.transfers, pg.transfers);
export const transfersRelations = selectSchema(sqlite.transfersRelations, pg.transfersRelations);
export const usageAnalytics = selectSchema(sqlite.usageAnalytics, pg.usageAnalytics);
export const userHouseholdPreferences = selectSchema(sqlite.userHouseholdPreferences, pg.userHouseholdPreferences);
export const userSessions = selectSchema(sqlite.userSessions, pg.userSessions);
export const userSettings = selectSchema(sqlite.userSettings, pg.userSettings);
export const utilizationAlertState = selectSchema(sqlite.utilizationAlertState, pg.utilizationAlertState);

// Better Auth schema exports (used by a handful of admin/user endpoints)
export const betterAuthUser = selectSchema(sqlite.betterAuthUser, pg.betterAuthUser);
export const betterAuthSession = selectSchema(sqlite.betterAuthSession, pg.betterAuthSession);
export const betterAuthAccount = selectSchema(sqlite.betterAuthAccount, pg.betterAuthAccount);
export const betterAuthVerification = selectSchema(sqlite.betterAuthVerification, pg.betterAuthVerification);
