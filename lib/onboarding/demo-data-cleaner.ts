import { db } from '@/lib/db';
import {
  accounts,
  budgetCategories,
  autopayRules,
  billOccurrenceAllocations,
  billOccurrences,
  billPaymentEvents,
  billTemplates,
  savingsGoals,
  savingsMilestones,
  debts,
  debtPayments,
  debtPayoffMilestones,
  transactions,
  transactionSplits,
  merchants,
} from '@/lib/db/schema';
import { eq, and, like, inArray } from 'drizzle-orm';

interface ClearDemoDataResult {
  transactions: number;
  bills: number;
  debts: number;
  savingsGoals: number;
  merchants: number;
  categories: number;
  accounts: number;
}

/**
 * Clear all demo data from a household
 * Demo data is identified by names prefixed with "Demo"
 * 
 * Delete order respects foreign key constraints:
 * 1. Transaction splits (references transactions)
 * 2. Transactions (references accounts, categories, merchants)
 * 3. Bill occurrence allocations (references bill occurrences)
 * 4. Bill payment events (references bill occurrences/templates)
 * 5. Bill occurrences (references bill templates)
 * 6. Autopay rules (references bill templates)
 * 7. Bill templates (references accounts, categories, merchants)
 * 8. Debt payments (references debts)
 * 9. Debt payoff milestones (references debts)
 * 10. Debts (references accounts, categories)
 * 11. Savings milestones (references goals)
 * 12. Savings goals (references accounts)
 * 13. Merchants (references categories)
 * 14. Budget categories
 * 15. Accounts
 */
export async function clearDemoData(
  householdId: string,
  _userId: string
): Promise<ClearDemoDataResult> {
  // 1. Get all demo account IDs
  const demoAccounts = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.householdId, householdId),
        like(accounts.name, 'Demo%')
      )
    );
  const demoAccountIds = demoAccounts.map((a) => a.id);

  // 2. Get all demo category IDs
  const demoCategories = await db
    .select({ id: budgetCategories.id })
    .from(budgetCategories)
    .where(
      and(
        eq(budgetCategories.householdId, householdId),
        like(budgetCategories.name, 'Demo%')
      )
    );
  const demoCategoryIds = demoCategories.map((c) => c.id);

  // 3. Get all demo merchant IDs
  const demoMerchants = await db
    .select({ id: merchants.id })
    .from(merchants)
    .where(
      and(
        eq(merchants.householdId, householdId),
        like(merchants.name, 'Demo%')
      )
    );
  const demoMerchantIds = demoMerchants.map((m) => m.id);

  // 4. Get all demo bill template IDs
  const demoBills = await db
    .select({ id: billTemplates.id })
    .from(billTemplates)
    .where(
      and(
        eq(billTemplates.householdId, householdId),
        like(billTemplates.name, 'Demo%')
      )
    );
  const demoBillIds = demoBills.map((b) => b.id);

  // 5. Get all demo goal IDs
  const demoGoals = await db
    .select({ id: savingsGoals.id })
    .from(savingsGoals)
    .where(
      and(
        eq(savingsGoals.householdId, householdId),
        like(savingsGoals.name, 'Demo%')
      )
    );
  const demoGoalIds = demoGoals.map((g) => g.id);

  // 6. Get all demo debt IDs
  const demoDebts = await db
    .select({ id: debts.id })
    .from(debts)
    .where(
      and(
        eq(debts.householdId, householdId),
        like(debts.name, 'Demo%')
      )
    );
  const demoDebtIds = demoDebts.map((d) => d.id);

  // 7. Get all transaction IDs that reference demo accounts
  const demoTransactions = demoAccountIds.length > 0
    ? await db
        .select({ id: transactions.id })
        .from(transactions)
        .where(
          and(
            eq(transactions.householdId, householdId),
            inArray(transactions.accountId, demoAccountIds)
          )
        )
    : [];
  const demoTransactionIds = demoTransactions.map((t) => t.id);

  // ============================================================================
  // DELETE IN ORDER (respecting foreign key constraints)
  // ============================================================================

  // 1. Delete transaction splits for demo transactions
  if (demoTransactionIds.length > 0) {
    await db
      .delete(transactionSplits)
      .where(
        and(
          eq(transactionSplits.householdId, householdId),
          inArray(transactionSplits.transactionId, demoTransactionIds)
        )
      );
  }

  // 2. Delete demo transactions
  if (demoTransactionIds.length > 0) {
    await db
      .delete(transactions)
      .where(
        and(
          eq(transactions.householdId, householdId),
          inArray(transactions.id, demoTransactionIds)
        )
      );
  }

  // 3. Delete bill occurrence allocations for demo bill occurrences
  if (demoBillIds.length > 0) {
    const demoOccurrences = await db
      .select({ id: billOccurrences.id })
      .from(billOccurrences)
      .where(
        and(
          eq(billOccurrences.householdId, householdId),
          inArray(billOccurrences.templateId, demoBillIds)
        )
      );

    const demoOccurrenceIds = demoOccurrences.map((o) => o.id);

    if (demoOccurrenceIds.length > 0) {
      await db
        .delete(billOccurrenceAllocations)
        .where(
          and(
            eq(billOccurrenceAllocations.householdId, householdId),
            inArray(billOccurrenceAllocations.occurrenceId, demoOccurrenceIds)
          )
        );
    }
  }

  // 4. Delete bill payment events for demo bills
  if (demoBillIds.length > 0) {
    await db
      .delete(billPaymentEvents)
      .where(
        and(
          eq(billPaymentEvents.householdId, householdId),
          inArray(billPaymentEvents.templateId, demoBillIds)
        )
      );
  }

  // 5. Delete bill occurrences for demo bills
  if (demoBillIds.length > 0) {
    await db
      .delete(billOccurrences)
      .where(
        and(
          eq(billOccurrences.householdId, householdId),
          inArray(billOccurrences.templateId, demoBillIds)
        )
      );
  }

  // 6. Delete autopay rules for demo bills
  if (demoBillIds.length > 0) {
    await db
      .delete(autopayRules)
      .where(
        and(
          eq(autopayRules.householdId, householdId),
          inArray(autopayRules.templateId, demoBillIds)
        )
      );
  }

  // 7. Delete demo bill templates
  if (demoBillIds.length > 0) {
    await db
      .delete(billTemplates)
      .where(
        and(
          eq(billTemplates.householdId, householdId),
          inArray(billTemplates.id, demoBillIds)
        )
      );
  }

  // 8. Delete debt payments for demo debts
  if (demoDebtIds.length > 0) {
    await db
      .delete(debtPayments)
      .where(
        and(
          eq(debtPayments.householdId, householdId),
          inArray(debtPayments.debtId, demoDebtIds)
        )
      );
  }

  // 9. Delete debt payoff milestones for demo debts
  if (demoDebtIds.length > 0) {
    await db
      .delete(debtPayoffMilestones)
      .where(
        and(
          eq(debtPayoffMilestones.householdId, householdId),
          inArray(debtPayoffMilestones.debtId, demoDebtIds)
        )
      );
  }

  // 10. Delete demo debts
  if (demoDebtIds.length > 0) {
    await db
      .delete(debts)
      .where(
        and(
          eq(debts.householdId, householdId),
          inArray(debts.id, demoDebtIds)
        )
      );
  }

  // 11. Delete savings milestones for demo goals
  if (demoGoalIds.length > 0) {
    await db
      .delete(savingsMilestones)
      .where(
        and(
          eq(savingsMilestones.householdId, householdId),
          inArray(savingsMilestones.goalId, demoGoalIds)
        )
      );
  }

  // 12. Delete demo savings goals
  if (demoGoalIds.length > 0) {
    await db
      .delete(savingsGoals)
      .where(
        and(
          eq(savingsGoals.householdId, householdId),
          inArray(savingsGoals.id, demoGoalIds)
        )
      );
  }

  // 13. Delete demo merchants
  if (demoMerchantIds.length > 0) {
    await db
      .delete(merchants)
      .where(
        and(
          eq(merchants.householdId, householdId),
          inArray(merchants.id, demoMerchantIds)
        )
      );
  }

  // 14. Delete demo categories
  if (demoCategoryIds.length > 0) {
    await db
      .delete(budgetCategories)
      .where(
        and(
          eq(budgetCategories.householdId, householdId),
          inArray(budgetCategories.id, demoCategoryIds)
        )
      );
  }

  // 15. Delete demo accounts
  if (demoAccountIds.length > 0) {
    await db
      .delete(accounts)
      .where(
        and(
          eq(accounts.householdId, householdId),
          inArray(accounts.id, demoAccountIds)
        )
      );
  }

  // Use pre-calculated counts since we queried them already
  const result: ClearDemoDataResult = {
    transactions: demoTransactionIds.length,
    bills: demoBillIds.length,
    debts: demoDebtIds.length,
    savingsGoals: demoGoalIds.length,
    merchants: demoMerchantIds.length,
    categories: demoCategoryIds.length,
    accounts: demoAccountIds.length,
  };

  console.log('[Demo Data Cleaner] Cleared demo data for household:', householdId, result);

  return result;
}

/**
 * Get a summary of existing demo data in a household
 */
export async function getDemoDataSummary(householdId: string): Promise<{
  accounts: number;
  categories: number;
  merchants: number;
  transactions: number;
  bills: number;
  goals: number;
  debts: number;
}> {
  // Get demo accounts
  const accountsList = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.householdId, householdId),
        like(accounts.name, 'Demo%')
      )
    );
  const demoAccountIds = accountsList.map((a) => a.id);

  // Get demo categories
  const categoriesList = await db
    .select({ id: budgetCategories.id })
    .from(budgetCategories)
    .where(
      and(
        eq(budgetCategories.householdId, householdId),
        like(budgetCategories.name, 'Demo%')
      )
    );

  // Get demo merchants
  const merchantsList = await db
    .select({ id: merchants.id })
    .from(merchants)
    .where(
      and(
        eq(merchants.householdId, householdId),
        like(merchants.name, 'Demo%')
      )
    );

  // Get demo transactions (transactions linked to demo accounts)
  let transactionsList: { id: string }[] = [];
  if (demoAccountIds.length > 0) {
    transactionsList = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          eq(transactions.householdId, householdId),
          inArray(transactions.accountId, demoAccountIds)
        )
      );
  }

  // Get demo bill templates
  const billsList = await db
    .select({ id: billTemplates.id })
    .from(billTemplates)
    .where(
      and(
        eq(billTemplates.householdId, householdId),
        like(billTemplates.name, 'Demo%')
      )
    );

  // Get demo goals
  const goalsList = await db
    .select({ id: savingsGoals.id })
    .from(savingsGoals)
    .where(
      and(
        eq(savingsGoals.householdId, householdId),
        like(savingsGoals.name, 'Demo%')
      )
    );

  // Get demo debts
  const debtsList = await db
    .select({ id: debts.id })
    .from(debts)
    .where(
      and(
        eq(debts.householdId, householdId),
        like(debts.name, 'Demo%')
      )
    );

  return {
    accounts: accountsList.length,
    categories: categoriesList.length,
    merchants: merchantsList.length,
    transactions: transactionsList.length,
    bills: billsList.length,
    goals: goalsList.length,
    debts: debtsList.length,
  };
}
