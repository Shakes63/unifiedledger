import { transactions } from '@/lib/db/schema';
import { getTransactionAmountCents } from '@/lib/transactions/money-movement-service';

function isTransferType(type: string): boolean {
  return type === 'transfer_out' || type === 'transfer_in';
}

export function validateMatchingTransactionForConversion({
  matched,
  targetAccountId,
  amountCents,
  isExpense,
}: {
  matched: typeof transactions.$inferSelect;
  targetAccountId: string;
  amountCents: number;
  isExpense: boolean;
}): Response | null {
  if (isTransferType(matched.type)) {
    return Response.json(
      { error: 'Matching transaction is already a transfer' },
      { status: 400 }
    );
  }

  if (matched.accountId !== targetAccountId) {
    return Response.json(
      { error: 'Matching transaction must be on the target account' },
      { status: 400 }
    );
  }

  if (getTransactionAmountCents(matched) !== amountCents) {
    return Response.json(
      { error: 'Transaction amounts do not match' },
      { status: 400 }
    );
  }

  const isMatchedExpense = matched.type === 'expense';
  if (isExpense === isMatchedExpense) {
    return Response.json(
      { error: 'Transactions must be opposite types (expense/income)' },
      { status: 400 }
    );
  }

  return null;
}
