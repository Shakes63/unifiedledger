import Decimal from 'decimal.js';

import { amountToCents } from '@/lib/transactions/money-movement-service';
import { updateCanonicalTransferPairByTransactionId } from '@/lib/transactions/transfer-service';

interface RunTransferTransactionUpdateParams {
  userId: string;
  householdId: string;
  transactionId: string;
  transactionType: string;
  accountId?: string;
  transferId?: string;
  transferDestinationAccountId?: string;
  transferSourceAccountId?: string;
  amount?: unknown;
  date?: string;
  description?: string;
  notes?: string | null;
  isPending?: boolean;
}

export function isTransferTransactionType(type: string | null | undefined): boolean {
  return type === 'transfer_out' || type === 'transfer_in';
}

export async function runTransferTransactionUpdate({
  userId,
  householdId,
  transactionId,
  transactionType,
  accountId,
  transferId,
  transferDestinationAccountId,
  transferSourceAccountId,
  amount,
  date,
  description,
  notes,
  isPending,
}: RunTransferTransactionUpdateParams) {
  const destinationAccountInput = transferDestinationAccountId ?? transferId;
  const sourceAccountUpdate =
    transactionType === 'transfer_out' ? (accountId ?? transferSourceAccountId) : transferSourceAccountId;
  const destinationAccountUpdate =
    transactionType === 'transfer_in' ? (accountId ?? destinationAccountInput) : destinationAccountInput;
  const amountCentsUpdate =
    typeof amount === 'number' || typeof amount === 'string'
      ? amountToCents(new Decimal(amount))
      : undefined;

  await updateCanonicalTransferPairByTransactionId({
    userId,
    householdId,
    transactionId,
    amountCents: amountCentsUpdate,
    date,
    description,
    notes,
    isPending,
    sourceAccountId: sourceAccountUpdate,
    destinationAccountId: destinationAccountUpdate,
  });
}

export function mapTransferUpdateError(error: unknown): Response | null {
  const message = error instanceof Error ? error.message : 'Failed to update transfer transaction';

  if (message.includes('Cannot transfer to the same account')) {
    return Response.json({ error: message }, { status: 400 });
  }

  if (message.includes('not found')) {
    return Response.json({ error: message }, { status: 404 });
  }

  return null;
}
