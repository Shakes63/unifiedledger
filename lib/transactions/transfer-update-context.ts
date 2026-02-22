import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { db } from '@/lib/db';
import { transactions, transfers } from '@/lib/db/schema';
import { findPairedTransferTransaction, isTransferType } from '@/lib/transactions/transfer-pair-helpers';
import {
  getTransactionAmountCents,
  getTransferAmountCents,
  getTransferFeesCents,
} from '@/lib/transactions/money-movement-service';

type DbClient = typeof db;

export async function loadTransferUpdateContext(
  tx: DbClient,
  {
    userId,
    householdId,
    transactionId,
  }: {
    userId: string;
    householdId: string;
    transactionId: string;
  }
) {
  const current = await tx
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.id, transactionId),
        eq(transactions.userId, userId),
        eq(transactions.householdId, householdId)
      )
    )
    .limit(1);

  if (current.length === 0) {
    throw new Error('Transfer transaction not found');
  }

  const currentTx = current[0];
  if (!isTransferType(currentTx.type)) {
    throw new Error('Transaction is not a transfer');
  }

  const paired = await findPairedTransferTransaction({
    tx,
    transaction: currentTx,
    userId,
    householdId,
  });

  if (!paired || !isTransferType(paired.type)) {
    throw new Error('Paired transfer transaction not found');
  }

  const transferOut = currentTx.type === 'transfer_out' ? currentTx : paired;
  const transferIn = currentTx.type === 'transfer_in' ? currentTx : paired;

  if (transferOut.type !== 'transfer_out' || transferIn.type !== 'transfer_in') {
    throw new Error('Invalid transfer pairing');
  }

  const transferGroupId =
    currentTx.transferGroupId ||
    paired.transferGroupId ||
    currentTx.transferId ||
    paired.transferId ||
    nanoid();

  const transferRecord = await tx
    .select()
    .from(transfers)
    .where(
      and(
        eq(transfers.id, transferGroupId),
        eq(transfers.userId, userId),
        eq(transfers.householdId, householdId)
      )
    )
    .limit(1);

  const currentTransferAmountCents =
    transferRecord.length > 0
      ? getTransferAmountCents(transferRecord[0])
      : getTransactionAmountCents(transferIn);

  const currentFeesCents =
    transferRecord.length > 0
      ? getTransferFeesCents(transferRecord[0])
      : Math.max(0, getTransactionAmountCents(transferOut) - getTransactionAmountCents(transferIn));

  const currentSourceAccountId =
    transferOut.transferSourceAccountId ||
    transferOut.accountId ||
    transferIn.transferSourceAccountId ||
    transferOut.accountId;
  const currentDestinationAccountId =
    transferOut.transferDestinationAccountId ||
    transferIn.accountId ||
    transferIn.transferDestinationAccountId ||
    transferIn.accountId;

  return {
    transferOut,
    transferIn,
    transferGroupId,
    transferRecord,
    currentTransferAmountCents,
    currentFeesCents,
    currentSourceAccountId,
    currentDestinationAccountId,
  };
}
