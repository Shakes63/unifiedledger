import { and, eq } from 'drizzle-orm';

import { createTransactionSnapshot, logTransactionAudit } from '@/lib/transactions/audit-logger';
import { db } from '@/lib/db';
import {
  accounts,
  betterAuthUser,
  billTemplates,
  budgetCategories,
  debts,
  merchants,
  transactions,
} from '@/lib/db/schema';

interface LogTransactionDeletionAuditParams {
  transactionId: string;
  userId: string;
  householdId: string;
  transaction: typeof transactions.$inferSelect;
}

export async function logTransactionDeletionAudit({
  transactionId,
  userId,
  householdId,
  transaction,
}: LogTransactionDeletionAuditParams): Promise<void> {
  try {
    const [accountData, categoryData, merchantData, billData, debtData, userRecord] = await Promise.all([
      db
        .select({ name: accounts.name })
        .from(accounts)
        .where(
          and(
            eq(accounts.id, transaction.accountId),
            eq(accounts.userId, userId),
            eq(accounts.householdId, householdId)
          )
        )
        .limit(1),
      transaction.categoryId
        ? db
            .select({ name: budgetCategories.name })
            .from(budgetCategories)
            .where(
              and(
                eq(budgetCategories.id, transaction.categoryId),
                eq(budgetCategories.userId, userId),
                eq(budgetCategories.householdId, householdId)
              )
            )
            .limit(1)
        : Promise.resolve([]),
      transaction.merchantId
        ? db
            .select({ name: merchants.name })
            .from(merchants)
            .where(
              and(
                eq(merchants.id, transaction.merchantId),
                eq(merchants.userId, userId),
                eq(merchants.householdId, householdId)
              )
            )
            .limit(1)
        : Promise.resolve([]),
      transaction.billId
        ? db
            .select({ name: billTemplates.name })
            .from(billTemplates)
            .where(
              and(
                eq(billTemplates.id, transaction.billId),
                eq(billTemplates.createdByUserId, userId),
                eq(billTemplates.householdId, householdId)
              )
            )
            .limit(1)
        : Promise.resolve([]),
      transaction.debtId
        ? db
            .select({ name: debts.name })
            .from(debts)
            .where(
              and(
                eq(debts.id, transaction.debtId),
                eq(debts.userId, userId),
                eq(debts.householdId, householdId)
              )
            )
            .limit(1)
        : Promise.resolve([]),
      db.select({ name: betterAuthUser.name }).from(betterAuthUser).where(eq(betterAuthUser.id, userId)).limit(1),
    ]);

    const snapshot = createTransactionSnapshot(transaction, {
      accountName: accountData[0]?.name,
      categoryName: categoryData[0]?.name,
      merchantName: merchantData[0]?.name,
      billName: billData[0]?.name,
      debtName: debtData[0]?.name,
    });

    await logTransactionAudit({
      transactionId,
      userId,
      householdId,
      userName: userRecord[0]?.name || 'Unknown User',
      actionType: 'deleted',
      snapshot,
    });
  } catch (error) {
    console.error('Failed to log transaction deletion audit:', error);
  }
}
