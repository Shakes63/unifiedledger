import { applyTargetBalanceDelta, updateConvertedTransactionRecord } from '@/lib/transactions/transaction-convert-write-helpers';
import {
  insertCanonicalTransferRecord,
  insertPairedTransferTransaction,
} from '@/lib/transactions/transaction-convert-transfer-writes';
import type { MoneyTx } from '@/lib/transactions/transaction-convert-write-types';

export async function executeConversionBranchWrites({
  tx,
  id,
  userId,
  householdId,
  amountCents,
  transferGroupId,
  pairedTransactionId,
  nowIso,
  originalTransactionDate,
  originalTransactionNotes,
  originalTransactionDescription,
  convertedType,
  convertedDescription,
  convertedSourceAccountId,
  convertedDestinationAccountId,
  pairedType,
  pairedDescription,
  pairedAccountId,
  pairedId,
  pairedLinkTransactionId,
  pairedSourceAccountId,
  pairedDestinationAccountId,
  balanceDeltaCents,
  canonicalFromAccountId,
  canonicalToAccountId,
  canonicalFromTransactionId,
  canonicalToTransactionId,
  isPending,
}: {
  tx: MoneyTx;
  id: string;
  userId: string;
  householdId: string;
  amountCents: number;
  transferGroupId: string;
  pairedTransactionId: string;
  nowIso: string;
  originalTransactionDate: string;
  originalTransactionNotes: string | null;
  originalTransactionDescription: string;
  convertedType: 'transfer_out' | 'transfer_in';
  convertedDescription: string;
  convertedSourceAccountId: string;
  convertedDestinationAccountId: string;
  pairedType: 'transfer_in' | 'transfer_out';
  pairedDescription: string;
  pairedAccountId: string;
  pairedId: string;
  pairedLinkTransactionId: string;
  pairedSourceAccountId: string;
  pairedDestinationAccountId: string;
  balanceDeltaCents: number;
  canonicalFromAccountId: string;
  canonicalToAccountId: string;
  canonicalFromTransactionId: string;
  canonicalToTransactionId: string;
  isPending: boolean;
}): Promise<void> {
  await updateConvertedTransactionRecord({
    tx,
    id,
    transferType: convertedType,
    transferGroupId,
    pairedTransactionId,
    transferSourceAccountId: convertedSourceAccountId,
    transferDestinationAccountId: convertedDestinationAccountId,
    description: convertedDescription,
    nowIso,
  });

  await insertPairedTransferTransaction({
    tx,
    id: pairedId,
    userId,
    householdId,
    accountId: pairedAccountId,
    date: originalTransactionDate,
    amountCents,
    description: pairedDescription,
    notes: originalTransactionNotes,
    transferType: pairedType,
    transferGroupId,
    pairedTransactionId: pairedLinkTransactionId,
    transferSourceAccountId: pairedSourceAccountId,
    transferDestinationAccountId: pairedDestinationAccountId,
    isPending,
    nowIso,
  });

  await applyTargetBalanceDelta({
    tx,
    targetAccountId: pairedAccountId,
    userId,
    householdId,
    amountDeltaCents: balanceDeltaCents,
  });

  await insertCanonicalTransferRecord({
    tx,
    transferGroupId,
    userId,
    householdId,
    fromAccountId: canonicalFromAccountId,
    toAccountId: canonicalToAccountId,
    amountCents,
    date: originalTransactionDate,
    description: originalTransactionDescription,
    fromTransactionId: canonicalFromTransactionId,
    toTransactionId: canonicalToTransactionId,
    notes: originalTransactionNotes,
    nowIso,
  });
}
