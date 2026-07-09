import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { accounts } from '@/lib/db/schema';
import {
  applyAccountBalanceDeltas,
  computeBalanceDeltaCents,
} from '@/lib/transactions/money-movement-service';

type DbClient = typeof db;

async function getScopedAccountOrThrow(
  tx: DbClient,
  {
    accountId,
    userId,
    householdId,
    label,
  }: {
    accountId: string;
    userId: string;
    householdId: string;
    label: string;
  }
) {
  const selectableClient =
    typeof (tx as unknown as { select?: unknown }).select === 'function' ? tx : db;

  const account = await selectableClient
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.id, accountId),
        eq(accounts.userId, userId),
        eq(accounts.householdId, householdId)
      )
    )
    .limit(1);

  if (account.length > 0) {
    return account[0];
  }
  throw new Error(`${label} account not found`);
}

export async function revertTransferPairBalances({
  tx,
  userId,
  householdId,
  sourceAccountId,
  destinationAccountId,
  transferAmountCents,
  totalDebitCents,
}: {
  tx: DbClient;
  userId: string;
  householdId: string;
  sourceAccountId: string | null;
  destinationAccountId: string | null;
  transferAmountCents: number;
  totalDebitCents: number;
}): Promise<void> {
  if (!sourceAccountId || !destinationAccountId) {
    return;
  }

  const [sourceAccount, destinationAccount] = await Promise.all([
    getScopedAccountOrThrow(tx, {
      accountId: sourceAccountId,
      userId,
      householdId,
      label: 'Source',
    }),
    getScopedAccountOrThrow(tx, {
      accountId: destinationAccountId,
      userId,
      householdId,
      label: 'Destination',
    }),
  ]);

  // Reverse each leg's original (liability-aware) effect: the source was debited
  // (transfer_out of amount+fees), the destination credited (transfer_in of
  // amount). Coalescing per account also fixes the same-account clobber where
  // two absolute writes from a shared stale read dropped one leg (H-XFER-2).
  const sourceReversal = -computeBalanceDeltaCents({
    accountType: sourceAccount.type,
    transactionType: 'transfer_out',
    amountCents: totalDebitCents,
  });
  const destinationReversal = -computeBalanceDeltaCents({
    accountType: destinationAccount.type,
    transactionType: 'transfer_in',
    amountCents: transferAmountCents,
  });

  await applyAccountBalanceDeltas(
    tx,
    [
      { accountId: sourceAccountId, deltaCents: sourceReversal },
      { accountId: destinationAccountId, deltaCents: destinationReversal },
    ],
    { userId, householdId }
  );
}
