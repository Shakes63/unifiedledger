import { getTransactionAmountCents } from '@/lib/transactions/money-movement-service';
import { linkExistingTransactionsAsCanonicalTransfer } from '@/lib/transactions/transfer-service';
import { loadScopedTransaction } from '@/lib/transactions/transaction-convert-scoped-load';
import { validateMatchingTransactionForConversion } from '@/lib/transactions/transaction-convert-validation';
import { buildConvertSuccessResponse } from '@/lib/transactions/transaction-convert-route-helpers';
import { transactions } from '@/lib/db/schema';

export async function executeMatchedTransactionConversion({
  id,
  matchingTransactionId,
  userId,
  householdId,
  targetAccountId,
  transaction,
}: {
  id: string;
  matchingTransactionId: string;
  userId: string;
  householdId: string;
  targetAccountId: string;
  transaction: typeof transactions.$inferSelect;
}): Promise<Response> {
  const matched = await loadScopedTransaction({
    id: matchingTransactionId,
    userId,
    householdId,
  });
  if (!matched) {
    return Response.json({ error: 'Matching transaction not found in household' }, { status: 404 });
  }

  const matchingValidationError = validateMatchingTransactionForConversion({
    matched,
    targetAccountId,
    amountCents: getTransactionAmountCents(transaction),
    isExpense: transaction.type === 'expense',
  });
  if (matchingValidationError) {
    return matchingValidationError;
  }

  const result = await linkExistingTransactionsAsCanonicalTransfer({
    userId,
    householdId,
    firstTransactionId: id,
    secondTransactionId: matchingTransactionId,
  });

  return buildConvertSuccessResponse({
    id,
    pairedTransactionId: matchingTransactionId,
    transferGroupId: result.transferGroupId,
    matched: true,
  });
}
