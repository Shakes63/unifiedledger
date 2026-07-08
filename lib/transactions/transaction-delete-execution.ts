import { and, eq } from 'drizzle-orm';

import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import { accounts, salesTaxTransactions, transactionSplits, transactions } from '@/lib/db/schema';
import {
  applyAccountBalanceDelta,
  computeBalanceDeltaCents,
  type MovementTransactionType,
} from '@/lib/transactions/money-movement-service';

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
      .select({ id: accounts.id, type: accounts.type })
      .from(accounts)
      .where(eq(accounts.id, transaction.accountId))
      .limit(1);

    if (account.length > 0) {
      // Reverse the transaction's original balance effect (negate the delta it
      // applied). Liability-aware and transfer_out-aware (C-MATH-1, H-TXN-3).
      const reversalDelta = -computeBalanceDeltaCents({
        accountType: account[0].type,
        transactionType: transaction.type as MovementTransactionType,
        amountCents: transactionAmountCents,
      });
      await applyAccountBalanceDelta(tx, {
        accountId: transaction.accountId,
        deltaCents: reversalDelta,
      });
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
