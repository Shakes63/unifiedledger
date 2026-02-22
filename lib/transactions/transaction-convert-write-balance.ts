import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { accounts } from '@/lib/db/schema';
import {
  getAccountBalanceCents,
  updateScopedAccountBalance,
} from '@/lib/transactions/money-movement-service';

type MoneyTx = typeof db;

export async function adjustTargetAccountBalance({
  tx,
  targetAccountId,
  userId,
  householdId,
  amountDeltaCents,
}: {
  tx: MoneyTx;
  targetAccountId: string;
  userId: string;
  householdId: string;
  amountDeltaCents: number;
}) {
  const refreshedTarget = await tx
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.id, targetAccountId),
        eq(accounts.userId, userId),
        eq(accounts.householdId, householdId)
      )
    )
    .limit(1);

  if (refreshedTarget.length === 0) {
    return;
  }

  await updateScopedAccountBalance(tx, {
    accountId: targetAccountId,
    userId,
    householdId,
    balanceCents: getAccountBalanceCents(refreshedTarget[0]) + amountDeltaCents,
  });
}
