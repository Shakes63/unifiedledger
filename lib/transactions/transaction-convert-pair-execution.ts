import { accounts, transactions } from '@/lib/db/schema';
import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import {
  executeExpenseConversionWrites,
  executeIncomeConversionWrites,
} from '@/lib/transactions/transaction-convert-write-execution';

export async function executeUnmatchedTransferConversion({
  id,
  userId,
  householdId,
  targetAccountId,
  transaction,
  sourceAccount,
  targetAccount,
  amountCents,
  isExpense,
  transferGroupId,
  pairedTransactionId,
}: {
  id: string;
  userId: string;
  householdId: string;
  targetAccountId: string;
  transaction: typeof transactions.$inferSelect;
  sourceAccount: typeof accounts.$inferSelect;
  targetAccount: typeof accounts.$inferSelect;
  amountCents: number;
  isExpense: boolean;
  transferGroupId: string;
  pairedTransactionId: string;
}): Promise<void> {
  const nowIso = new Date().toISOString();

  await runInDatabaseTransaction(async (tx) => {
    if (isExpense) {
      await executeExpenseConversionWrites({
        tx,
        id,
        userId,
        householdId,
        targetAccountId,
        transaction,
        sourceAccount,
        targetAccount,
        amountCents,
        transferGroupId,
        pairedTransactionId,
        nowIso,
      });
      return;
    }

    await executeIncomeConversionWrites({
      tx,
      id,
      userId,
      householdId,
      targetAccountId,
      transaction,
      sourceAccount,
      targetAccount,
      amountCents,
      transferGroupId,
      pairedTransactionId,
      nowIso,
    });
  });
}
