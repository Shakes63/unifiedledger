import { getTransactionAmountCents } from '@/lib/transactions/money-movement-service';
import { deleteCanonicalTransferPairByTransactionId } from '@/lib/transactions/transfer-service';
import { logTransactionDeletionAudit } from '@/lib/transactions/transaction-delete-audit';
import { deleteNonTransferTransaction } from '@/lib/transactions/transaction-delete-execution';
import { transactions } from '@/lib/db/schema';

export async function executeTransactionDeleteOrchestration({
  transactionId,
  userId,
  householdId,
  transaction,
}: {
  transactionId: string;
  userId: string;
  householdId: string;
  transaction: typeof transactions.$inferSelect;
}): Promise<Response> {
  const transactionAmountCents = getTransactionAmountCents(transaction);

  await logTransactionDeletionAudit({
    transactionId,
    userId,
    householdId,
    transaction,
  });

  if (transaction.type === 'transfer_out' || transaction.type === 'transfer_in') {
    await deleteCanonicalTransferPairByTransactionId({
      userId,
      householdId,
      transactionId,
    });
    return Response.json({ message: 'Transaction deleted successfully' }, { status: 200 });
  }

  await deleteNonTransferTransaction({
    transactionId,
    userId,
    householdId,
    transaction,
    transactionAmountCents,
  });

  return Response.json({ message: 'Transaction deleted successfully' }, { status: 200 });
}
