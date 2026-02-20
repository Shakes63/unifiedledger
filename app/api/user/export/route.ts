import { NextResponse } from 'next/server';
import { requireEmailVerification } from '@/lib/auth/verification-guard';
import { db } from '@/lib/db';
import { getTodayLocalDateString } from '@/lib/utils/local-date';
import {
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

export async function GET() {
  try {
    // Require email verification for data export (sensitive operation)
    const authResult = await requireEmailVerification();
    const userId = authResult.userId;

    // Fetch all user data in parallel
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
        id: authResult.userId,
        email: authResult.email,
        name: authResult.name,
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

    // Return as downloadable JSON
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="unifiedledger-export-${getTodayLocalDateString()}.json"`,
      },
    });
  } catch (error) {
    console.error('Error exporting data:', error);
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    );
  }
}
