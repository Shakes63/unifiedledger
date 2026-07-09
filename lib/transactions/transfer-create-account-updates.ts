import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import {
  computeBalanceDeltaCents,
  getAccountBalanceCents,
  updateScopedAccountBalance,
} from '@/lib/transactions/money-movement-service';

type TransferTx = Parameters<Parameters<typeof runInDatabaseTransaction>[0]>[0];

export async function applyCreatedTransferAccountUpdates({
  tx,
  userId,
  householdId,
  fromAccount,
  toAccount,
  fromAccountId,
  toAccountId,
  totalDebitCents,
  amountCents,
  nowIso,
}: {
  tx: TransferTx;
  userId: string;
  householdId: string;
  fromAccount: { usageCount: number | null; currentBalanceCents: number | null; type?: string | null };
  toAccount: { usageCount: number | null; currentBalanceCents: number | null; type?: string | null };
  fromAccountId: string;
  toAccountId: string;
  totalDebitCents: number;
  amountCents: number;
  nowIso: string;
}): Promise<void> {
  // Liability-aware legs (C-MATH-1): the source is debited (transfer_out) and the
  // destination credited (transfer_in). Paying a credit card is a transfer_in to
  // a liability, which reduces what you owe; a cash advance is a transfer_out
  // from a liability, which increases it.
  const newFromBalanceCents =
    getAccountBalanceCents({ currentBalanceCents: fromAccount.currentBalanceCents }) +
    computeBalanceDeltaCents({
      accountType: fromAccount.type,
      transactionType: 'transfer_out',
      amountCents: totalDebitCents,
    });
  const newToBalanceCents =
    getAccountBalanceCents({ currentBalanceCents: toAccount.currentBalanceCents }) +
    computeBalanceDeltaCents({
      accountType: toAccount.type,
      transactionType: 'transfer_in',
      amountCents,
    });

  await updateScopedAccountBalance(tx, {
    accountId: fromAccountId,
    userId,
    householdId,
    balanceCents: newFromBalanceCents,
    lastUsedAt: nowIso,
    usageCount: (fromAccount.usageCount || 0) + 1,
  });

  await updateScopedAccountBalance(tx, {
    accountId: toAccountId,
    userId,
    householdId,
    balanceCents: newToBalanceCents,
    lastUsedAt: nowIso,
    usageCount: (toAccount.usageCount || 0) + 1,
  });
}
