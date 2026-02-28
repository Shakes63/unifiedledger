import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import {
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
  fromAccount: { usageCount: number | null; currentBalanceCents: number | null };
  toAccount: { usageCount: number | null; currentBalanceCents: number | null };
  fromAccountId: string;
  toAccountId: string;
  totalDebitCents: number;
  amountCents: number;
  nowIso: string;
}): Promise<void> {
  const newFromBalanceCents =
    getAccountBalanceCents({ currentBalanceCents: fromAccount.currentBalanceCents }) -
    totalDebitCents;
  const newToBalanceCents =
    getAccountBalanceCents({ currentBalanceCents: toAccount.currentBalanceCents }) +
    amountCents;

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
