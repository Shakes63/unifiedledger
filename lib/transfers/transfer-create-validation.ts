import { amountToCents } from '@/lib/transactions/money-movement-service';
import { validateCanonicalTransferInput } from '@/lib/transactions/transfer-contract';
import {
  loadAndValidateTransferAccounts,
  parseTransferMoneyValues,
  TransferCreateValidationError,
} from '@/lib/transfers/transfer-create-validation-helpers';

interface ValidateTransferCreateInputParams {
  userId: string;
  householdId: string;
  request: Request;
  body: Record<string, unknown>;
  fromAccountId: string;
  toAccountId: string;
  amount: unknown;
  date: string;
  description?: string;
  fees?: unknown;
  notes?: string;
}

export async function validateTransferCreateInput({
  userId,
  householdId,
  request,
  body,
  fromAccountId,
  toAccountId,
  amount,
  date,
  description,
  fees = 0,
  notes,
}: ValidateTransferCreateInputParams) {
  if (!fromAccountId || !toAccountId || amount === undefined || amount === null || !date) {
    throw new TransferCreateValidationError('Missing required fields', 400);
  }

  if (fromAccountId === toAccountId) {
    throw new TransferCreateValidationError('Cannot transfer to the same account', 400);
  }

  const { transferAmount, transferFees } = parseTransferMoneyValues({ amount, fees });
  const { fromAccount, toAccount } = await loadAndValidateTransferAccounts({
    userId,
    householdId,
    fromAccountId,
    toAccountId,
    request,
    body,
  });

  try {
    const transferPayload = validateCanonicalTransferInput({
      userId,
      householdId,
      fromAccountId,
      toAccountId,
      amountCents: amountToCents(transferAmount),
      feesCents: amountToCents(transferFees),
      date,
      description: description || `Transfer ${fromAccount.name} -> ${toAccount.name}`,
      notes: notes || null,
    });

    return {
      transferPayload,
      fromAccountId,
      toAccountId,
    };
  } catch (error) {
    throw new TransferCreateValidationError(
      error instanceof Error ? error.message : 'Invalid transfer payload',
      400
    );
  }
}

export function mapTransferCreateValidationError(error: unknown): Response | null {
  if (error instanceof TransferCreateValidationError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return null;
}
