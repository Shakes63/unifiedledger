import { and, eq } from 'drizzle-orm';

import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import { accounts, salesTaxTransactions, transactionSplits, transactions } from '@/lib/db/schema';
import { buildAccountBalanceFields, getAccountBalanceCents } from '@/lib/transactions/money-movement-service';

interface DeleteNonTransferTransactionParams {
  transactionId: string;
  userId: string;
  householdId: string;
  transaction: typeof transactions.$inferSelect;
  transactionAmountCents: number;
}

export async function deleteNonTransferTransaction({
  transactionId,
  userId,
  householdId,
  transaction,
  transactionAmountCents,
}: DeleteNonTransferTransactionParams): Promise<void> {
  await runInDatabaseTransaction(async (tx) => {
    if (transaction.isSplit) {
      await tx
        .delete(transactionSplits)
        .where(
          and(
            eq(transactionSplits.userId, userId),
            eq(transactionSplits.householdId, householdId),
            eq(transactionSplits.transactionId, transactionId)
          )
        );
    }

    const account = await tx
      .select()
      .from(accounts)
      .where(eq(accounts.id, transaction.accountId))
      .limit(1);

    if (account.length > 0) {
      let newBalanceCents = getAccountBalanceCents(account[0]);
      if (transaction.type === 'expense') {
        newBalanceCents += transactionAmountCents;
      } else {
        newBalanceCents -= transactionAmountCents;
      }

      await tx
        .update(accounts)
        .set(buildAccountBalanceFields(newBalanceCents))
        .where(eq(accounts.id, transaction.accountId));
    }

    await tx
      .delete(salesTaxTransactions)
      .where(eq(salesTaxTransactions.transactionId, transactionId));

    await tx
      .delete(transactions)
      .where(
        and(
          eq(transactions.id, transactionId),
          eq(transactions.userId, userId),
          eq(transactions.householdId, householdId)
        )
      );
  });
}
