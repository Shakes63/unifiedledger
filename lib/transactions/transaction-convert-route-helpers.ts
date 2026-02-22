import { transactions } from '@/lib/db/schema';

export function validateSourceTransactionForConversion({
  transaction,
  targetAccountId,
}: {
  transaction: typeof transactions.$inferSelect;
  targetAccountId: string;
}): Response | null {
  if (transaction.type === 'transfer_out' || transaction.type === 'transfer_in') {
    return Response.json({ error: 'Transaction is already a transfer' }, { status: 400 });
  }

  if (transaction.accountId === targetAccountId) {
    return Response.json({ error: 'Cannot transfer to the same account' }, { status: 400 });
  }

  return null;
}

export function buildConvertSuccessResponse({
  id,
  pairedTransactionId,
  transferGroupId,
  matched,
}: {
  id: string;
  pairedTransactionId: string;
  transferGroupId: string;
  matched: boolean;
}): Response {
  return Response.json(
    {
      id,
      pairedTransactionId,
      transferGroupId,
      matched,
      message: 'Transaction converted to transfer successfully',
    },
    { status: 200 }
  );
}
