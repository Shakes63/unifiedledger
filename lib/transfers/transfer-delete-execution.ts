import { and, eq } from 'drizzle-orm';

import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import { accounts, transactions, transfers } from '@/lib/db/schema';
import {
  getAccountBalanceCents,
  getTransferAmountCents,
  getTransferFeesCents,
  updateScopedAccountBalance,
} from '@/lib/transactions/money-movement-service';

export async function deleteLegacyTransferAndRevertBalances({
  transferId,
  userId,
  householdId,
  transferData,
}: {
  transferId: string;
  userId: string;
  householdId: string;
  transferData: typeof transfers.$inferSelect;
}): Promise<void> {
  await runInDatabaseTransaction(async (tx) => {
    await tx
      .delete(transfers)
      .where(
        and(
          eq(transfers.id, transferId),
          eq(transfers.userId, userId),
          eq(transfers.householdId, householdId)
        )
      );

    if (transferData.fromTransactionId) {
      await tx
        .delete(transactions)
        .where(
          and(
            eq(transactions.id, transferData.fromTransactionId),
            eq(transactions.userId, userId),
            eq(transactions.householdId, householdId)
          )
        );
    }

    if (transferData.toTransactionId) {
      await tx
        .delete(transactions)
        .where(
          and(
            eq(transactions.id, transferData.toTransactionId),
            eq(transactions.userId, userId),
            eq(transactions.householdId, householdId)
          )
        );
    }

    const [fromAccount, toAccount] = await Promise.all([
      tx
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.id, transferData.fromAccountId),
            eq(accounts.userId, userId),
            eq(accounts.householdId, householdId)
          )
        )
        .limit(1),
      tx
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.id, transferData.toAccountId),
            eq(accounts.userId, userId),
            eq(accounts.householdId, householdId)
          )
        )
        .limit(1),
    ]);

    if (fromAccount.length > 0) {
      const transferAmountCents = getTransferAmountCents(transferData);
      const transferFeesCents = getTransferFeesCents(transferData);
      const totalDebitCents = transferAmountCents + transferFeesCents;
      const newFromBalanceCents = getAccountBalanceCents(fromAccount[0]) + totalDebitCents;

      await updateScopedAccountBalance(tx, {
        accountId: transferData.fromAccountId,
        userId,
        householdId,
        balanceCents: newFromBalanceCents,
      });
    }

    if (toAccount.length > 0) {
      const transferAmountCents = getTransferAmountCents(transferData);
      const newToBalanceCents = getAccountBalanceCents(toAccount[0]) - transferAmountCents;

      await updateScopedAccountBalance(tx, {
        accountId: transferData.toAccountId,
        userId,
        householdId,
        balanceCents: newToBalanceCents,
      });
    }
  });
}
