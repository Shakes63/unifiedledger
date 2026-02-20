import { and, eq, ne } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { db } from '@/lib/db';
import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import { accounts, transactions, transfers } from '@/lib/db/schema';
import {
  buildTransactionAmountFields,
  buildTransferMoneyFields,
  getAccountBalanceCents,
  getTransactionAmountCents,
  getTransferAmountCents,
  getTransferFeesCents,
  insertTransactionMovement,
  insertTransferMovement,
  updateScopedAccountBalance,
} from '@/lib/transactions/money-movement-service';

type DbClient = typeof db;

interface CreateCanonicalTransferPairParams {
  userId: string;
  householdId: string;
  fromAccountId: string;
  toAccountId: string;
  amountCents: number;
  feesCents?: number;
  date: string;
  description: string;
  notes?: string | null;
  isPending?: boolean;
  isBalanceTransfer?: boolean;
  savingsGoalId?: string | null;
  offlineId?: string | null;
  syncStatus?: 'pending' | 'syncing' | 'synced' | 'error' | 'offline';
  transferGroupId?: string;
  fromTransactionId?: string;
  toTransactionId?: string;
}

interface LinkExistingTransactionsAsTransferParams {
  userId: string;
  householdId: string;
  firstTransactionId: string;
  secondTransactionId: string;
  transferGroupId?: string;
}

interface UpdateCanonicalTransferPairParams {
  userId: string;
  householdId: string;
  transactionId: string;
  amountCents?: number;
  date?: string;
  description?: string;
  notes?: string | null;
  isPending?: boolean;
  sourceAccountId?: string;
  destinationAccountId?: string;
}

interface FindPairedTransferTransactionParams {
  tx: DbClient;
  transaction: typeof transactions.$inferSelect;
  userId: string;
  householdId: string;
}

function isTransferType(type: string | null | undefined): boolean {
  return type === 'transfer_out' || type === 'transfer_in';
}

async function getScopedAccountOrThrow(
  tx: DbClient,
  {
    accountId,
    userId,
    householdId,
    label,
  }: {
    accountId: string;
    userId: string;
    householdId: string;
    label: string;
  }
) {
  const account = await tx
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.id, accountId),
        eq(accounts.userId, userId),
        eq(accounts.householdId, householdId)
      )
    )
    .limit(1);

  if (account.length > 0) {
    return account[0];
  }

  const fallback = tx === db
    ? []
    : await db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.id, accountId),
            eq(accounts.userId, userId),
            eq(accounts.householdId, householdId)
          )
        )
        .limit(1);

  if (fallback.length === 0) {
    throw new Error(`${label} account not found`);
  }

  return fallback[0];
}

function resolveTransferRoles(
  txA: typeof transactions.$inferSelect,
  txB: typeof transactions.$inferSelect
): {
  transferOut: typeof transactions.$inferSelect;
  transferIn: typeof transactions.$inferSelect;
} {
  if (txA.type === 'expense' && txB.type === 'income') {
    return { transferOut: txA, transferIn: txB };
  }

  if (txA.type === 'income' && txB.type === 'expense') {
    return { transferOut: txB, transferIn: txA };
  }

  if (txA.type === 'transfer_out' && txB.type === 'transfer_in') {
    return { transferOut: txA, transferIn: txB };
  }

  if (txA.type === 'transfer_in' && txB.type === 'transfer_out') {
    return { transferOut: txB, transferIn: txA };
  }

  throw new Error('Transactions must be opposite flow types (expense/income or transfer_out/transfer_in)');
}

export async function createCanonicalTransferPair({
  userId,
  householdId,
  fromAccountId,
  toAccountId,
  amountCents,
  feesCents = 0,
  date,
  description,
  notes = null,
  isPending = false,
  isBalanceTransfer = false,
  savingsGoalId = null,
  offlineId = null,
  syncStatus = 'synced',
  transferGroupId: incomingTransferGroupId,
  fromTransactionId: incomingFromTransactionId,
  toTransactionId: incomingToTransactionId,
}: CreateCanonicalTransferPairParams): Promise<{
  transferGroupId: string;
  fromTransactionId: string;
  toTransactionId: string;
}> {
  if (fromAccountId === toAccountId) {
    throw new Error('Cannot transfer to the same account');
  }

  const transferGroupId = incomingTransferGroupId ?? nanoid();
  const fromTransactionId = incomingFromTransactionId ?? nanoid();
  const toTransactionId = incomingToTransactionId ?? nanoid();
  const nowIso = new Date().toISOString();
  const totalDebitCents = amountCents + feesCents;

  await runInDatabaseTransaction(async (tx) => {
    const [fromAccount, toAccount] = await Promise.all([
      getScopedAccountOrThrow(tx, {
        accountId: fromAccountId,
        userId,
        householdId,
        label: 'Source',
      }),
      getScopedAccountOrThrow(tx, {
        accountId: toAccountId,
        userId,
        householdId,
        label: 'Destination',
      }),
    ]);

    await insertTransactionMovement(tx, {
      id: fromTransactionId,
      userId,
      householdId,
      accountId: fromAccountId,
      categoryId: null,
      merchantId: null,
      date,
      amountCents: totalDebitCents,
      description,
      notes,
      type: 'transfer_out',
      transferId: transferGroupId,
      transferGroupId,
      pairedTransactionId: toTransactionId,
      transferSourceAccountId: fromAccountId,
      transferDestinationAccountId: toAccountId,
      isPending,
      isBalanceTransfer,
      offlineId,
      syncStatus,
      syncedAt: syncStatus === 'synced' ? nowIso : null,
      syncAttempts: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    await insertTransactionMovement(tx, {
      id: toTransactionId,
      userId,
      householdId,
      accountId: toAccountId,
      categoryId: null,
      merchantId: null,
      savingsGoalId,
      date,
      amountCents,
      description,
      notes,
      type: 'transfer_in',
      transferId: transferGroupId,
      transferGroupId,
      pairedTransactionId: fromTransactionId,
      transferSourceAccountId: fromAccountId,
      transferDestinationAccountId: toAccountId,
      isPending,
      isBalanceTransfer,
      offlineId: offlineId ? `${offlineId}_in` : null,
      syncStatus,
      syncedAt: syncStatus === 'synced' ? nowIso : null,
      syncAttempts: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    const newFromBalanceCents = getAccountBalanceCents(fromAccount) - totalDebitCents;
    const newToBalanceCents = getAccountBalanceCents(toAccount) + amountCents;

    await updateScopedAccountBalance(tx, {
      accountId: fromAccountId,
      userId,
      householdId,
      balanceCents: newFromBalanceCents,
      lastUsedAt: nowIso,
      usageCount: (fromAccount.usageCount || 0) + 1,
    });

    await updateScopedAccountBalance(tx, {
      accountId: toAccountId,
      userId,
      householdId,
      balanceCents: newToBalanceCents,
      lastUsedAt: nowIso,
      usageCount: (toAccount.usageCount || 0) + 1,
    });

    if ('delete' in tx && typeof tx.delete === 'function') {
      await tx
        .delete(transfers)
        .where(
          and(
            eq(transfers.id, transferGroupId),
            eq(transfers.userId, userId),
            eq(transfers.householdId, householdId)
          )
        );
    }

    await insertTransferMovement(tx, {
      id: transferGroupId,
      userId,
      householdId,
      fromAccountId,
      toAccountId,
      amountCents,
      feesCents,
      description,
      date,
      status: 'completed',
      fromTransactionId,
      toTransactionId,
      notes,
      createdAt: nowIso,
    });
  });

  return {
    transferGroupId,
    fromTransactionId,
    toTransactionId,
  };
}

export async function linkExistingTransactionsAsCanonicalTransfer({
  userId,
  householdId,
  firstTransactionId,
  secondTransactionId,
  transferGroupId: incomingTransferGroupId,
}: LinkExistingTransactionsAsTransferParams): Promise<{
  transferGroupId: string;
  transferOutId: string;
  transferInId: string;
}> {
  const transferGroupId = incomingTransferGroupId ?? nanoid();
  const nowIso = new Date().toISOString();
  let transferOutId = '';
  let transferInId = '';

  await runInDatabaseTransaction(async (tx) => {
    const [first, second] = await Promise.all([
      tx
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.id, firstTransactionId),
            eq(transactions.userId, userId),
            eq(transactions.householdId, householdId)
          )
        )
        .limit(1),
      tx
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.id, secondTransactionId),
            eq(transactions.userId, userId),
            eq(transactions.householdId, householdId)
          )
        )
        .limit(1),
    ]);

    if (first.length === 0 || second.length === 0) {
      throw new Error('One or both transactions not found');
    }

    if (first[0].transferGroupId || second[0].transferGroupId || first[0].pairedTransactionId || second[0].pairedTransactionId) {
      throw new Error('One or both transactions are already linked as a transfer');
    }

    const { transferOut, transferIn } = resolveTransferRoles(first[0], second[0]);
    transferOutId = transferOut.id;
    transferInId = transferIn.id;
    const transferAmountCents = getTransactionAmountCents(transferOut);

    await tx
      .update(transactions)
      .set({
        type: 'transfer_out',
        categoryId: null,
        merchantId: null,
        transferId: transferGroupId,
        transferGroupId,
        pairedTransactionId: transferIn.id,
        transferSourceAccountId: transferOut.accountId,
        transferDestinationAccountId: transferIn.accountId,
        updatedAt: nowIso,
      })
      .where(eq(transactions.id, transferOut.id));

    await tx
      .update(transactions)
      .set({
        type: 'transfer_in',
        categoryId: null,
        merchantId: null,
        transferId: transferGroupId,
        transferGroupId,
        pairedTransactionId: transferOut.id,
        transferSourceAccountId: transferOut.accountId,
        transferDestinationAccountId: transferIn.accountId,
        updatedAt: nowIso,
      })
      .where(eq(transactions.id, transferIn.id));

    if ('delete' in tx && typeof tx.delete === 'function') {
      await tx
        .delete(transfers)
        .where(
          and(
            eq(transfers.id, transferGroupId),
            eq(transfers.userId, userId),
            eq(transfers.householdId, householdId)
          )
        );
    }

    await insertTransferMovement(tx, {
      id: transferGroupId,
      userId,
      householdId,
      fromAccountId: transferOut.accountId,
      toAccountId: transferIn.accountId,
      amountCents: transferAmountCents,
      feesCents: 0,
      description: transferOut.description || transferIn.description || 'Transfer',
      date: transferOut.date,
      status: 'completed',
      fromTransactionId: transferOut.id,
      toTransactionId: transferIn.id,
      notes: transferOut.notes || transferIn.notes || null,
      createdAt: nowIso,
    });
  });

  return {
    transferGroupId,
    transferOutId,
    transferInId,
  };
}

export async function updateCanonicalTransferPairByTransactionId({
  userId,
  householdId,
  transactionId,
  amountCents,
  date,
  description,
  notes,
  isPending,
  sourceAccountId,
  destinationAccountId,
}: UpdateCanonicalTransferPairParams): Promise<{
  transferGroupId: string;
  transferOutId: string;
  transferInId: string;
  sourceAccountId: string;
  destinationAccountId: string;
}> {
  let resultTransferGroupId = '';
  let resultTransferOutId = '';
  let resultTransferInId = '';
  let resultSourceAccountId = '';
  let resultDestinationAccountId = '';

  await runInDatabaseTransaction(async (tx) => {
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

    const transferGroupId = currentTx.transferGroupId
      || paired.transferGroupId
      || currentTx.transferId
      || paired.transferId
      || nanoid();

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

    const currentTransferAmountCents = transferRecord.length > 0
      ? getTransferAmountCents(transferRecord[0])
      : getTransactionAmountCents(transferIn);

    const currentFeesCents = transferRecord.length > 0
      ? getTransferFeesCents(transferRecord[0])
      : Math.max(0, getTransactionAmountCents(transferOut) - getTransactionAmountCents(transferIn));

    const nextTransferAmountCents = amountCents ?? currentTransferAmountCents;
    const nextFeesCents = currentFeesCents;
    const currentTransferOutAmountCents = currentTransferAmountCents + currentFeesCents;
    const nextTransferOutAmountCents = nextTransferAmountCents + nextFeesCents;

    const currentSourceAccountId = transferOut.transferSourceAccountId
      || transferOut.accountId
      || transferIn.transferSourceAccountId
      || transferOut.accountId;
    const currentDestinationAccountId = transferOut.transferDestinationAccountId
      || transferIn.accountId
      || transferIn.transferDestinationAccountId
      || transferIn.accountId;

    const nextSourceAccountId = sourceAccountId ?? currentSourceAccountId;
    const nextDestinationAccountId = destinationAccountId ?? currentDestinationAccountId;

    if (nextSourceAccountId === nextDestinationAccountId) {
      throw new Error('Cannot transfer to the same account');
    }

    const affectedAccountIds = Array.from(
      new Set([
        currentSourceAccountId,
        currentDestinationAccountId,
        nextSourceAccountId,
        nextDestinationAccountId,
      ])
    );

    const accountRows = await Promise.all(
      affectedAccountIds.map(async (accountId) => {
        const account = await getScopedAccountOrThrow(tx, {
          accountId,
          userId,
          householdId,
          label: 'Transfer',
        });
        return [accountId, account] as const;
      })
    );

    const accountsById = new Map(accountRows);
    const balanceDeltaByAccountId = new Map<string, number>();
    const addDelta = (accountId: string, delta: number) => {
      const currentDelta = balanceDeltaByAccountId.get(accountId) ?? 0;
      balanceDeltaByAccountId.set(accountId, currentDelta + delta);
    };

    // Reverse existing pair effects.
    addDelta(currentSourceAccountId, currentTransferOutAmountCents);
    addDelta(currentDestinationAccountId, -currentTransferAmountCents);

    // Apply new pair effects.
    addDelta(nextSourceAccountId, -nextTransferOutAmountCents);
    addDelta(nextDestinationAccountId, nextTransferAmountCents);

    for (const [accountId, delta] of balanceDeltaByAccountId.entries()) {
      if (delta === 0) continue;
      const account = accountsById.get(accountId);
      if (!account) {
        throw new Error('Transfer account not found');
      }
      await updateScopedAccountBalance(tx, {
        accountId,
        userId,
        householdId,
        balanceCents: getAccountBalanceCents(account) + delta,
      });
    }

    const nowIso = new Date().toISOString();
    const nextDate = date ?? transferOut.date;
    const nextDescription = description ?? transferOut.description ?? transferIn.description ?? 'Transfer';
    const nextNotes = notes !== undefined ? notes : (transferOut.notes ?? transferIn.notes ?? null);
    const nextIsPending = isPending !== undefined ? isPending : (transferOut.isPending || transferIn.isPending || false);

    await tx
      .update(transactions)
      .set({
        accountId: nextSourceAccountId,
        categoryId: null,
        merchantId: null,
        transferId: transferGroupId,
        transferGroupId,
        pairedTransactionId: transferIn.id,
        transferSourceAccountId: nextSourceAccountId,
        transferDestinationAccountId: nextDestinationAccountId,
        date: nextDate,
        ...buildTransactionAmountFields(nextTransferOutAmountCents),
        description: nextDescription,
        notes: nextNotes,
        isPending: nextIsPending,
        type: 'transfer_out',
        updatedAt: nowIso,
      })
      .where(
        and(
          eq(transactions.id, transferOut.id),
          eq(transactions.userId, userId),
          eq(transactions.householdId, householdId)
        )
      );

    await tx
      .update(transactions)
      .set({
        accountId: nextDestinationAccountId,
        categoryId: null,
        merchantId: null,
        transferId: transferGroupId,
        transferGroupId,
        pairedTransactionId: transferOut.id,
        transferSourceAccountId: nextSourceAccountId,
        transferDestinationAccountId: nextDestinationAccountId,
        date: nextDate,
        ...buildTransactionAmountFields(nextTransferAmountCents),
        description: nextDescription,
        notes: nextNotes,
        isPending: nextIsPending,
        type: 'transfer_in',
        updatedAt: nowIso,
      })
      .where(
        and(
          eq(transactions.id, transferIn.id),
          eq(transactions.userId, userId),
          eq(transactions.householdId, householdId)
        )
      );

    if (transferRecord.length > 0) {
      await tx
        .update(transfers)
        .set({
          fromAccountId: nextSourceAccountId,
          toAccountId: nextDestinationAccountId,
          ...buildTransferMoneyFields(nextTransferAmountCents, nextFeesCents),
          description: nextDescription,
          date: nextDate,
          notes: nextNotes,
          status: nextIsPending ? 'pending' : 'completed',
          fromTransactionId: transferOut.id,
          toTransactionId: transferIn.id,
        })
        .where(
          and(
            eq(transfers.id, transferGroupId),
            eq(transfers.userId, userId),
            eq(transfers.householdId, householdId)
          )
        );
    } else {
      await insertTransferMovement(tx, {
        id: transferGroupId,
        userId,
        householdId,
        fromAccountId: nextSourceAccountId,
        toAccountId: nextDestinationAccountId,
        amountCents: nextTransferAmountCents,
        feesCents: nextFeesCents,
        description: nextDescription,
        date: nextDate,
        status: nextIsPending ? 'pending' : 'completed',
        fromTransactionId: transferOut.id,
        toTransactionId: transferIn.id,
        notes: nextNotes,
        createdAt: nowIso,
      });
    }

    resultTransferGroupId = transferGroupId;
    resultTransferOutId = transferOut.id;
    resultTransferInId = transferIn.id;
    resultSourceAccountId = nextSourceAccountId;
    resultDestinationAccountId = nextDestinationAccountId;
  });

  return {
    transferGroupId: resultTransferGroupId,
    transferOutId: resultTransferOutId,
    transferInId: resultTransferInId,
    sourceAccountId: resultSourceAccountId,
    destinationAccountId: resultDestinationAccountId,
  };
}

export async function findPairedTransferTransaction({
  tx,
  transaction,
  userId,
  householdId,
}: FindPairedTransferTransactionParams): Promise<typeof transactions.$inferSelect | null> {
  if (transaction.pairedTransactionId) {
    const paired = await tx
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.id, transaction.pairedTransactionId),
          eq(transactions.userId, userId),
          eq(transactions.householdId, householdId)
        )
      )
      .limit(1);
    if (paired.length > 0) return paired[0];
  }

  if (transaction.transferGroupId) {
    const paired = await tx
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.transferGroupId, transaction.transferGroupId),
          eq(transactions.userId, userId),
          eq(transactions.householdId, householdId),
          ne(transactions.id, transaction.id)
        )
      )
      .limit(1);
    if (paired.length > 0) return paired[0];
  }

  // Legacy fallback for old transferId semantics
  if (transaction.type === 'transfer_out') {
    const paired = await tx
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.householdId, householdId),
          eq(transactions.type, 'transfer_in'),
          eq(transactions.transferId, transaction.id)
        )
      )
      .limit(1);
    if (paired.length > 0) return paired[0];
  }

  if (transaction.type === 'transfer_in' && transaction.transferId) {
    const paired = await tx
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.id, transaction.transferId),
          eq(transactions.userId, userId),
          eq(transactions.householdId, householdId)
        )
      )
      .limit(1);
    if (paired.length > 0) return paired[0];
  }

  return null;
}

export async function deleteCanonicalTransferPairByTransactionId({
  userId,
  householdId,
  transactionId,
}: {
  userId: string;
  householdId: string;
  transactionId: string;
}): Promise<void> {
  await runInDatabaseTransaction(async (tx) => {
    const transactionResult = await tx
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

    if (transactionResult.length === 0) {
      throw new Error('Transfer transaction not found');
    }

    const txRecord = transactionResult[0];
    if (!isTransferType(txRecord.type)) {
      throw new Error('Transaction is not a transfer');
    }

    const paired = await findPairedTransferTransaction({
      tx,
      transaction: txRecord,
      userId,
      householdId,
    });

    const transferOut = txRecord.type === 'transfer_out'
      ? txRecord
      : paired && paired.type === 'transfer_out'
        ? paired
        : null;
    const transferIn = txRecord.type === 'transfer_in'
      ? txRecord
      : paired && paired.type === 'transfer_in'
        ? paired
        : null;

    const transferGroupId = txRecord.transferGroupId
      || paired?.transferGroupId
      || (txRecord.transferId && txRecord.transferId !== txRecord.accountId ? txRecord.transferId : null);

    const transferRecord = transferGroupId
      ? await tx
          .select()
          .from(transfers)
          .where(
            and(
              eq(transfers.id, transferGroupId),
              eq(transfers.userId, userId),
              eq(transfers.householdId, householdId)
            )
          )
          .limit(1)
      : [];

    const transferAmountCents = transferRecord.length > 0
      ? getTransferAmountCents(transferRecord[0])
      : transferIn
        ? getTransactionAmountCents(transferIn)
        : transferOut
          ? getTransactionAmountCents(transferOut)
          : 0;

    const totalDebitCents = transferRecord.length > 0
      ? transferAmountCents + getTransferFeesCents(transferRecord[0])
      : transferOut
        ? getTransactionAmountCents(transferOut)
        : transferAmountCents;

    const sourceAccountId = transferOut?.transferSourceAccountId
      || transferOut?.accountId
      || transferIn?.transferSourceAccountId
      || null;
    const destinationAccountId = transferOut?.transferDestinationAccountId
      || transferIn?.accountId
      || transferIn?.transferDestinationAccountId
      || null;

    if (sourceAccountId && destinationAccountId) {
      const [sourceAccount, destinationAccount] = await Promise.all([
        getScopedAccountOrThrow(tx, {
          accountId: sourceAccountId,
          userId,
          householdId,
          label: 'Source',
        }),
        getScopedAccountOrThrow(tx, {
          accountId: destinationAccountId,
          userId,
          householdId,
          label: 'Destination',
        }),
      ]);

      await updateScopedAccountBalance(tx, {
        accountId: sourceAccountId,
        userId,
        householdId,
        balanceCents: getAccountBalanceCents(sourceAccount) + totalDebitCents,
      });

      await updateScopedAccountBalance(tx, {
        accountId: destinationAccountId,
        userId,
        householdId,
        balanceCents: getAccountBalanceCents(destinationAccount) - transferAmountCents,
      });
    }

    if (paired) {
      await tx
        .delete(transactions)
        .where(
          and(
            eq(transactions.id, paired.id),
            eq(transactions.userId, userId),
            eq(transactions.householdId, householdId)
          )
        );
    }

    await tx
      .delete(transactions)
      .where(
        and(
          eq(transactions.id, txRecord.id),
          eq(transactions.userId, userId),
          eq(transactions.householdId, householdId)
        )
      );

    if (transferGroupId) {
      await tx
        .delete(transfers)
        .where(
          and(
            eq(transfers.id, transferGroupId),
            eq(transfers.userId, userId),
            eq(transfers.householdId, householdId)
          )
        );
    }
  });
}
