import { eq } from 'drizzle-orm';

import { detectChanges, type DisplayNames, logTransactionAudit } from '@/lib/transactions/audit-logger';
import { db } from '@/lib/db';
import { accounts, betterAuthUser, budgetCategories, merchants, transactions } from '@/lib/db/schema';

interface LogTransactionUpdateAuditParams {
  transactionId: string;
  userId: string;
  householdId: string;
  transaction: typeof transactions.$inferSelect;
  newAccountId: string;
  newCategoryId: string | null;
  newMerchantId: string | null;
  newDate: string;
  newAmount: number;
  newDescription: string;
  newNotes: string | null;
  newIsPending: boolean;
  newIsSalesTaxable: boolean;
}

export async function logTransactionUpdateAudit({
  transactionId,
  userId,
  householdId,
  transaction,
  newAccountId,
  newCategoryId,
  newMerchantId,
  newDate,
  newAmount,
  newDescription,
  newNotes,
  newIsPending,
  newIsSalesTaxable,
}: LogTransactionUpdateAuditParams): Promise<void> {
  try {
    const newTransactionState = {
      accountId: newAccountId,
      categoryId: newCategoryId,
      merchantId: newMerchantId,
      transferId: transaction.transferId,
      transferGroupId: transaction.transferGroupId,
      transferSourceAccountId: transaction.transferSourceAccountId,
      transferDestinationAccountId: transaction.transferDestinationAccountId,
      date: newDate,
      amount: newAmount,
      description: newDescription,
      notes: newNotes,
      isPending: newIsPending,
      type: transaction.type,
      isTaxDeductible: transaction.isTaxDeductible,
      isSalesTaxable: newIsSalesTaxable,
      billId: transaction.billId,
      debtId: transaction.debtId,
    };

    const displayNames: DisplayNames = {};

    if (newAccountId !== transaction.accountId) {
      const [oldAcc, newAcc] = await Promise.all([
        db.select({ name: accounts.name }).from(accounts).where(eq(accounts.id, transaction.accountId)).limit(1),
        db.select({ name: accounts.name }).from(accounts).where(eq(accounts.id, newAccountId)).limit(1),
      ]);
      displayNames.accountId = {
        old: oldAcc[0]?.name || 'Unknown Account',
        new: newAcc[0]?.name || 'Unknown Account',
      };
    }

    if (newCategoryId !== transaction.categoryId) {
      const [oldCat, newCat] = await Promise.all([
        transaction.categoryId
          ? db
              .select({ name: budgetCategories.name })
              .from(budgetCategories)
              .where(eq(budgetCategories.id, transaction.categoryId))
              .limit(1)
          : Promise.resolve([]),
        newCategoryId
          ? db
              .select({ name: budgetCategories.name })
              .from(budgetCategories)
              .where(eq(budgetCategories.id, newCategoryId))
              .limit(1)
          : Promise.resolve([]),
      ]);
      displayNames.categoryId = {
        old: oldCat[0]?.name || 'None',
        new: newCat[0]?.name || 'None',
      };
    }

    if (newMerchantId !== transaction.merchantId) {
      const [oldMerch, newMerch] = await Promise.all([
        transaction.merchantId
          ? db.select({ name: merchants.name }).from(merchants).where(eq(merchants.id, transaction.merchantId)).limit(1)
          : Promise.resolve([]),
        newMerchantId
          ? db.select({ name: merchants.name }).from(merchants).where(eq(merchants.id, newMerchantId)).limit(1)
          : Promise.resolve([]),
      ]);
      displayNames.merchantId = {
        old: oldMerch[0]?.name || 'None',
        new: newMerch[0]?.name || 'None',
      };
    }

    const changes = detectChanges(transaction, newTransactionState, displayNames);

    if (changes.length === 0) {
      return;
    }

    const [userRecord] = await db
      .select({ name: betterAuthUser.name })
      .from(betterAuthUser)
      .where(eq(betterAuthUser.id, userId))
      .limit(1);

    await logTransactionAudit({
      transactionId,
      userId,
      householdId,
      userName: userRecord?.name || 'Unknown User',
      actionType: 'updated',
      changes,
    });
  } catch (error) {
    console.error('Failed to log transaction audit:', error);
  }
}
