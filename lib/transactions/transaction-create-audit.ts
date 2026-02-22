import { eq } from 'drizzle-orm';

import { createTransactionSnapshot, logTransactionAudit } from '@/lib/transactions/audit-logger';
import { db } from '@/lib/db';
import { accounts, betterAuthUser, budgetCategories, merchants } from '@/lib/db/schema';

interface LogTransactionCreateAuditParams {
  transactionId: string;
  userId: string;
  householdId: string;
  accountId: string;
  appliedCategoryId: string | null;
  finalMerchantId: string | null;
  date: string;
  amount: number;
  description: string;
  notes?: string;
  type: string;
  isPending: boolean;
  linkedBillId: string | null;
  linkedDebtId: string | null;
  debtId?: string | null;
  isTaxDeductible: boolean;
  isSalesTaxable: boolean;
}

export async function logTransactionCreateAudit({
  transactionId,
  userId,
  householdId,
  accountId,
  appliedCategoryId,
  finalMerchantId,
  date,
  amount,
  description,
  notes,
  type,
  isPending,
  linkedBillId,
  linkedDebtId,
  debtId,
  isTaxDeductible,
  isSalesTaxable,
}: LogTransactionCreateAuditParams): Promise<void> {
  try {
    const [userRecord, accountName, categoryName, merchantName] = await Promise.all([
      db.select({ name: betterAuthUser.name }).from(betterAuthUser).where(eq(betterAuthUser.id, userId)).limit(1),
      db.select({ name: accounts.name }).from(accounts).where(eq(accounts.id, accountId)).limit(1),
      appliedCategoryId
        ? db.select({ name: budgetCategories.name }).from(budgetCategories).where(eq(budgetCategories.id, appliedCategoryId)).limit(1)
        : Promise.resolve([]),
      finalMerchantId
        ? db.select({ name: merchants.name }).from(merchants).where(eq(merchants.id, finalMerchantId)).limit(1)
        : Promise.resolve([]),
    ]);

    const nowIso = new Date().toISOString();
    const snapshot = createTransactionSnapshot(
      {
        id: transactionId,
        accountId,
        categoryId: appliedCategoryId,
        merchantId: finalMerchantId,
        date,
        amount,
        description,
        notes: notes || null,
        type: type === 'transfer' ? 'transfer_out' : type,
        isPending,
        isTaxDeductible,
        isSalesTaxable,
        billId: linkedBillId,
        debtId: linkedDebtId || debtId,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        accountName: accountName[0]?.name,
        categoryName: categoryName[0]?.name,
        merchantName: merchantName[0]?.name,
      }
    );

    await logTransactionAudit({
      transactionId,
      userId,
      householdId,
      userName: userRecord[0]?.name || 'Unknown User',
      actionType: 'created',
      snapshot,
    });
  } catch (error) {
    console.error('Failed to log transaction creation audit:', error);
  }
}
