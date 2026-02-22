import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { accounts } from '@/lib/db/schema';
import {
  getAccountBalanceCents,
  updateScopedAccountBalance,
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

  await updateScopedAccountBalance(tx, {
    accountId: sourceAccountId,
    userId,
    householdId,
    balanceCents: getAccountBalanceCents(sourceAccount) + totalDebitCents,
  });

  await updateScopedAccountBalance(tx, {
    accountId: destinationAccountId,
    userId,
    householdId,
    balanceCents: getAccountBalanceCents(destinationAccount) - transferAmountCents,
  });
}
