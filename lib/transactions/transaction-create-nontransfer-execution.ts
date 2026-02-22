import { eq } from 'drizzle-orm';

import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import { db } from '@/lib/db';
import { merchants } from '@/lib/db/schema';
import { resolveAccountEntityId } from '@/lib/household/entities';
import {
  getAccountBalanceCents,
  insertTransactionMovement,
  updateScopedAccountBalance,
} from '@/lib/transactions/money-movement-service';
import type { TransactionMutations } from '@/lib/rules/types';

interface ExecuteNonTransferCreateParams {
  userId: string;
  householdId: string;
  transactionId: string;
  accountId: string;
  account: {
    type: string;
    entityId?: string | null;
    usageCount?: number | null;
    currentBalance?: number | null;
    currentBalanceCents?: number | null;
    enableTaxDeductions?: boolean | null;
    isBusinessAccount?: boolean | null;
  };
  appliedCategoryId: string | null;
  finalMerchantId: string | null;
  debtId?: string;
  savingsGoalId?: string;
  date: string;
  amountCents: number;
  finalDescription: string;
  notes?: string;
  type: string;
  isPending: boolean;
  isSalesTaxable: boolean;
  postCreationMutations: TransactionMutations | null;
  offlineId?: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error' | 'offline';
}

export async function executeNonTransferCreate({
  userId,
  householdId,
  transactionId,
  accountId,
  account,
  appliedCategoryId,
  finalMerchantId,
  debtId,
  savingsGoalId,
  date,
  amountCents,
  finalDescription,
  notes,
  type,
  isPending,
  isSalesTaxable,
  postCreationMutations,
  offlineId,
  syncStatus,
}: ExecuteNonTransferCreateParams): Promise<void> {
  let merchantIsSalesTaxExempt = false;
  if (type === 'income' && finalMerchantId) {
    const merchantExemptCheck = await db
      .select({ isSalesTaxExempt: merchants.isSalesTaxExempt })
      .from(merchants)
      .where(eq(merchants.id, finalMerchantId))
      .limit(1);
    merchantIsSalesTaxExempt = merchantExemptCheck[0]?.isSalesTaxExempt || false;
  }

  const accountIsCreditAccount = account.type === 'credit' || account.type === 'line_of_credit';
  const isRefund = type === 'income' && accountIsCreditAccount;

  await runInDatabaseTransaction(async (tx) => {
    const nowIso = new Date().toISOString();
    const transactionEntityId = await resolveAccountEntityId(
      householdId,
      userId,
      account.entityId
    );

    await insertTransactionMovement(tx, {
      id: transactionId,
      userId,
      householdId,
      entityId: transactionEntityId,
      accountId,
      categoryId: appliedCategoryId || null,
      merchantId: finalMerchantId || null,
      debtId: debtId || null,
      savingsGoalId: savingsGoalId || null,
      date,
      amountCents,
      description: finalDescription,
      notes: notes || null,
      type,
      transferId: null,
      transferSourceAccountId: null,
      transferDestinationAccountId: null,
      isPending,
      isRefund,
      isTaxDeductible: postCreationMutations?.isTaxDeductible || false,
      taxDeductionType: postCreationMutations?.isTaxDeductible
        ? (account.enableTaxDeductions ?? account.isBusinessAccount)
          ? 'business'
          : 'personal'
        : 'none',
      isSalesTaxable:
        (type === 'income' &&
          !merchantIsSalesTaxExempt &&
          (isSalesTaxable || postCreationMutations?.isSalesTaxable)) ||
        false,
      offlineId: offlineId || null,
      syncStatus,
      syncedAt: syncStatus === 'synced' ? nowIso : null,
      syncAttempts: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    const currentBalanceCents = getAccountBalanceCents(account);
    const updatedBalanceCents =
      type === 'expense' ? currentBalanceCents - amountCents : currentBalanceCents + amountCents;

    await updateScopedAccountBalance(tx, {
      accountId,
      userId,
      householdId,
      balanceCents: updatedBalanceCents,
      lastUsedAt: nowIso,
      usageCount: (account.usageCount || 0) + 1,
    });
  });
}
