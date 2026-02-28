import { db } from '@/lib/db';
import {
  backupSettings,
  backupHistory,
  transactions,
  accounts,
  budgetCategories,
  autopayRules,
  billOccurrences,
  billPaymentEvents,
  billTemplates,
  savingsGoals,
  debts,
  categorizationRules,
  merchants,
  tags,
  customFields,
  transactionTemplates,
  budgetPeriods,
  transactionSplits,
  savingsMilestones,
  debtPayments,
  userSettings,
  transactionTags,
  customFieldValues,
} from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { saveBackupFile, generateBackupFilename } from './backup-utils';

export interface CreateBackupResult {
  success: boolean;
  backupId?: string;
  error?: string;
}

/**
 * Create a backup for a user's household
 * @param userId - User ID to create backup for
 * @param householdId - Household ID to backup (required)
 * @param format - Backup format ('json' or 'csv'), defaults to user's preference
 * @returns Backup creation result with backupId or error
 */
export async function createUserBackup(
  userId: string,
  householdId: string,
  format?: 'json' | 'csv'
): Promise<CreateBackupResult> {
  try {
    // Get backup settings for this household, create if doesn't exist
    let settings = await db
      .select()
      .from(backupSettings)
      .where(
        and(
          eq(backupSettings.userId, userId),
          eq(backupSettings.householdId, householdId)
        )
      );

    // Create default backup settings if they don't exist
    if (!settings || settings.length === 0) {
      const settingsId = uuidv4();
      await db.insert(backupSettings).values({
        id: settingsId,
        userId,
        householdId,
        enabled: false,
        frequency: 'weekly',
        format: 'json',
        retentionCount: 10,
        emailBackups: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      settings = await db
        .select()
        .from(backupSettings)
        .where(
          and(
            eq(backupSettings.userId, userId),
            eq(backupSettings.householdId, householdId)
          )
        );
    }

    const backupFormat = format || (settings[0]?.format as 'json' | 'csv') || 'json';

    // Create backup history record (pending status)
    const filename = generateBackupFilename(backupFormat);
    const backupRecordId = uuidv4();

    await db.insert(backupHistory).values({
      id: backupRecordId,
      userId,
      householdId,
      backupSettingsId: settings[0].id,
      filename,
      fileSize: 0, // Will be updated after file is saved
      format: backupFormat,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    try {
      // Fetch all user data in parallel (same as export endpoint)
      const [
        userTransactions,
        userAccounts,
        userCategories,
        userBillTemplates,
        userGoals,
        userDebts,
        userRules,
        userMerchants,
        userTags,
        userCustomFields,
        userTemplates,
        userBudgetPeriods,
        userTransactionSplits,
        userGoalMilestones,
        userDebtPayments,
        userSettingsData,
        userTransactionTags,
        userCustomFieldValues,
      ] = await Promise.all([
        // Household-scoped data (filter by householdId)
        db.select().from(transactions).where(
          and(eq(transactions.userId, userId), eq(transactions.householdId, householdId))
        ),
        db.select().from(accounts).where(
          and(eq(accounts.userId, userId), eq(accounts.householdId, householdId))
        ),
        db.select().from(budgetCategories).where(
          and(eq(budgetCategories.userId, userId), eq(budgetCategories.householdId, householdId))
        ),
        db.select().from(billTemplates).where(
          and(eq(billTemplates.createdByUserId, userId), eq(billTemplates.householdId, householdId))
        ),
        db.select().from(savingsGoals).where(
          and(eq(savingsGoals.userId, userId), eq(savingsGoals.householdId, householdId))
        ),
        db.select().from(debts).where(
          and(eq(debts.userId, userId), eq(debts.householdId, householdId))
        ),
        db.select().from(categorizationRules).where(
          and(eq(categorizationRules.userId, userId), eq(categorizationRules.householdId, householdId))
        ),
        db.select().from(merchants).where(
          and(eq(merchants.userId, userId), eq(merchants.householdId, householdId))
        ),
        // User-level data (tags, customFields, templates, budgetPeriods are user-scoped)
        db.select().from(tags).where(eq(tags.userId, userId)),
        db.select().from(customFields).where(eq(customFields.userId, userId)),
        db.select().from(transactionTemplates).where(eq(transactionTemplates.userId, userId)),
        db.select().from(budgetPeriods).where(eq(budgetPeriods.userId, userId)),
        // Household-scoped related data
        db.select().from(transactionSplits).where(
          and(eq(transactionSplits.userId, userId), eq(transactionSplits.householdId, householdId))
        ),
        db.select().from(savingsMilestones).where(
          and(eq(savingsMilestones.userId, userId), eq(savingsMilestones.householdId, householdId))
        ),
        db.select().from(debtPayments).where(
          and(eq(debtPayments.userId, userId), eq(debtPayments.householdId, householdId))
        ),
        // User-level settings
        db.select().from(userSettings).where(eq(userSettings.userId, userId)),
        // Transaction-related data (filtered via transactionIds from household transactions)
        // Note: transactionTags and customFieldValues are linked to transactions,
        // so we'll filter them after fetching transactions
        db.select().from(transactionTags).where(eq(transactionTags.userId, userId)),
        db.select().from(customFieldValues).where(eq(customFieldValues.userId, userId)),
      ]);

      const templateIds = userBillTemplates.map((template) => template.id);
      const [userBillOccurrences, userBillPaymentEvents, userAutopayRules] =
        templateIds.length > 0
          ? await Promise.all([
              db
                .select()
                .from(billOccurrences)
                .where(
                  and(
                    inArray(billOccurrences.templateId, templateIds),
                    eq(billOccurrences.householdId, householdId)
                  )
                ),
              db
                .select()
                .from(billPaymentEvents)
                .where(
                  and(
                    inArray(billPaymentEvents.templateId, templateIds),
                    eq(billPaymentEvents.householdId, householdId)
                  )
                ),
              db
                .select()
                .from(autopayRules)
                .where(
                  and(
                    inArray(autopayRules.templateId, templateIds),
                    eq(autopayRules.householdId, householdId)
                  )
                ),
            ])
          : [[], [], []];

      // Filter transactionTags and customFieldValues by household transactions
      const householdTransactionIds = userTransactions.map(t => t.id);
      const filteredTransactionTags = householdTransactionIds.length > 0
        ? userTransactionTags.filter(tt => householdTransactionIds.includes(tt.transactionId))
        : [];
      const filteredCustomFieldValues = householdTransactionIds.length > 0
        ? userCustomFieldValues.filter(cfv => householdTransactionIds.includes(cfv.transactionId))
        : [];

      const exportData = {
        exportDate: new Date().toISOString(),
        version: '1.0',
        user: {
          id: userId,
        },
        data: {
          transactions: userTransactions,
          transactionSplits: userTransactionSplits,
          transactionTags: filteredTransactionTags,
          accounts: userAccounts,
          categories: userCategories,
          billTemplates: userBillTemplates,
          billOccurrences: userBillOccurrences,
          billPaymentEvents: userBillPaymentEvents,
          autopayRules: userAutopayRules,
          goals: userGoals,
          goalMilestones: userGoalMilestones,
          debts: userDebts,
          debtPayments: userDebtPayments,
          rules: userRules,
          merchants: userMerchants,
          tags: userTags,
          customFields: userCustomFields,
          customFieldValues: filteredCustomFieldValues,
          templates: userTemplates,
          budgetPeriods: userBudgetPeriods,
          settings: userSettingsData,
        },
        statistics: {
          totalTransactions: userTransactions.length,
          totalAccounts: userAccounts.length,
          totalCategories: userCategories.length,
          totalBills: userBillTemplates.length,
          totalGoals: userGoals.length,
          totalDebts: userDebts.length,
          totalMerchants: userMerchants.length,
          totalTags: userTags.length,
          totalRules: userRules.length,
          totalTemplates: userTemplates.length,
        },
      };

      // Convert to string (JSON format for now)
      const fileContent = JSON.stringify(exportData, null, 2);

      // Save backup file (household-specific path)
      const { fileSize } = await saveBackupFile(userId, householdId, filename, fileContent);

      // Update backup history record
      await db
        .update(backupHistory)
        .set({
          fileSize,
          status: 'completed',
        })
        .where(eq(backupHistory.id, backupRecordId));

      // Update backup settings lastBackupAt
      if (settings[0]) {
        await db
          .update(backupSettings)
          .set({
            lastBackupAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(
            and(
              eq(backupSettings.userId, userId),
              eq(backupSettings.householdId, householdId)
            )
          );
      }

      return {
        success: true,
        backupId: backupRecordId,
      };
    } catch (error) {
      // Update backup history record with error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await db
        .update(backupHistory)
        .set({
          status: 'failed',
          errorMessage,
        })
        .where(eq(backupHistory.id, backupRecordId));

      return {
        success: false,
        error: errorMessage,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[createUserBackup] Failed for user ${userId}, household ${householdId}:`, errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

