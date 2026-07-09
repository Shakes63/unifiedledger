import { and, eq } from 'drizzle-orm';

import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import { db } from '@/lib/db';
import { accounts, merchants } from '@/lib/db/schema';
import { resolveAccountEntityId } from '@/lib/household/entities';
import {
  computeBalanceDeltaCents,
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
    currentBalanceCents: number | null;
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
  type: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
  isPending: boolean;
  isSalesTaxable: boolean;
  postCreationMutations: TransactionMutations | null;
  effectiveIsTaxDeductible: boolean;
  effectiveTaxDeductionType: 'business' | 'personal' | 'none';
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
  effectiveIsTaxDeductible,
  effectiveTaxDeductionType,
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
      isTaxDeductible: effectiveIsTaxDeductible,
      taxDeductionType: effectiveTaxDeductionType,
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

    // Read the balance INSIDE the transaction (not from the pre-load) so a
    // concurrent create can't be lost (C-ATOM-2). transfer_out is a debit like
    // expense; the previous `type === 'expense'` test wrongly ADDED for a lone
    // transfer_out leg (H-TXN-3).
    const [freshAccount] = await tx
      .select({
        currentBalanceCents: accounts.currentBalanceCents,
        usageCount: accounts.usageCount,
      })
      .from(accounts)
      .where(
        and(
          eq(accounts.id, accountId),
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId)
        )
      )
      .limit(1);

    const currentBalanceCents = getAccountBalanceCents(freshAccount ?? account);
    // Liability-aware: on a credit account a charge (expense/transfer_out)
    // INCREASES what you owe; a payment/refund decreases it (C-MATH-1).
    const updatedBalanceCents =
      currentBalanceCents +
      computeBalanceDeltaCents({
        accountType: account.type,
        transactionType: type,
        amountCents,
      });

    await updateScopedAccountBalance(tx, {
      accountId,
      userId,
      householdId,
      balanceCents: updatedBalanceCents,
      lastUsedAt: nowIso,
      usageCount: ((freshAccount?.usageCount ?? account.usageCount) || 0) + 1,
    });
  });
}
