import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import {
  backupSettings,
  backupHistory,
  transactions,
  accounts,
  budgetCategories,
  bills,
  savingsGoals,
  debts,
  categorizationRules,
  merchants,
  tags,
  customFields,
  transactionTemplates,
  budgetPeriods,
  transactionSplits,
  billInstances,
  savingsMilestones,
  debtPayments,
  userSettings,
  transactionTags,
  customFieldValues,
} from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { saveBackupFile, generateBackupFilename } from '@/lib/backups/backup-utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/user/backups/create
 * Manually create a backup (for testing/admin use)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth();

    // Get backup settings to determine format, create if doesn't exist
    let settings = await db
      .select()
      .from(backupSettings)
      .where(eq(backupSettings.userId, userId))
      .limit(1);

    // Create default backup settings if they don't exist
    if (!settings || settings.length === 0) {
      const settingsId = uuidv4();
      await db.insert(backupSettings).values({
        id: settingsId,
        userId,
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
        .where(eq(backupSettings.userId, userId))
        .limit(1);
    }

    const format = settings[0]?.format || 'json';

    // Create backup history record (pending status)
    const backupId = uuidv4();
    const filename = generateBackupFilename(format);
    const backupRecordId = uuidv4();

    await db.insert(backupHistory).values({
      id: backupRecordId,
      userId,
      backupSettingsId: settings[0].id,
      filename,
      fileSize: 0, // Will be updated after file is saved
      format: format as 'json' | 'csv',
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    try {
      // Fetch all user data in parallel (same as export endpoint)
      const [
        userTransactions,
        userAccounts,
        userCategories,
        userBills,
        userGoals,
        userDebts,
        userRules,
        userMerchants,
        userTags,
        userCustomFields,
        userTemplates,
        userBudgetPeriods,
        userTransactionSplits,
        userBillInstances,
        userGoalMilestones,
        userDebtPayments,
        userSettingsData,
        userTransactionTags,
        userCustomFieldValues,
      ] = await Promise.all([
        db.select().from(transactions).where(eq(transactions.userId, userId)),
        db.select().from(accounts).where(eq(accounts.userId, userId)),
        db.select().from(budgetCategories).where(eq(budgetCategories.userId, userId)),
        db.select().from(bills).where(eq(bills.userId, userId)),
        db.select().from(savingsGoals).where(eq(savingsGoals.userId, userId)),
        db.select().from(debts).where(eq(debts.userId, userId)),
        db.select().from(categorizationRules).where(eq(categorizationRules.userId, userId)),
        db.select().from(merchants).where(eq(merchants.userId, userId)),
        db.select().from(tags).where(eq(tags.userId, userId)),
        db.select().from(customFields).where(eq(customFields.userId, userId)),
        db.select().from(transactionTemplates).where(eq(transactionTemplates.userId, userId)),
        db.select().from(budgetPeriods).where(eq(budgetPeriods.userId, userId)),
        db.select().from(transactionSplits).where(eq(transactionSplits.userId, userId)),
        db.select().from(billInstances).where(eq(billInstances.userId, userId)),
        db.select().from(savingsMilestones).where(eq(savingsMilestones.userId, userId)),
        db.select().from(debtPayments).where(eq(debtPayments.userId, userId)),
        db.select().from(userSettings).where(eq(userSettings.userId, userId)),
        db.select().from(transactionTags).where(eq(transactionTags.userId, userId)),
        db.select().from(customFieldValues).where(eq(customFieldValues.userId, userId)),
      ]);

      const exportData = {
        exportDate: new Date().toISOString(),
        version: '1.0',
        user: {
          id: userId,
        },
        data: {
          transactions: userTransactions,
          transactionSplits: userTransactionSplits,
          transactionTags: userTransactionTags,
          accounts: userAccounts,
          categories: userCategories,
          bills: userBills,
          billInstances: userBillInstances,
          goals: userGoals,
          goalMilestones: userGoalMilestones,
          debts: userDebts,
          debtPayments: userDebtPayments,
          rules: userRules,
          merchants: userMerchants,
          tags: userTags,
          customFields: userCustomFields,
          customFieldValues: userCustomFieldValues,
          templates: userTemplates,
          budgetPeriods: userBudgetPeriods,
          settings: userSettingsData,
        },
        statistics: {
          totalTransactions: userTransactions.length,
          totalAccounts: userAccounts.length,
          totalCategories: userCategories.length,
          totalBills: userBills.length,
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

      // Save backup file
      const { fileSize } = await saveBackupFile(userId, filename, fileContent);

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
          .where(eq(backupSettings.userId, userId));
      }

      // Fetch updated backup record
      const updatedBackup = await db
        .select()
        .from(backupHistory)
        .where(eq(backupHistory.id, backupRecordId))
        .limit(1);

      return NextResponse.json({
        success: true,
        backup: updatedBackup[0],
      });
    } catch (error) {
      // Update backup history record with error
      await db
        .update(backupHistory)
        .set({
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        })
        .where(eq(backupHistory.id, backupRecordId));

      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to create backup:', error);
    return NextResponse.json({ error: 'Failed to create backup' }, { status: 500 });
  }
}

