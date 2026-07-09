/**
 * The canonical transfer engine. All transfer-pair money movement funnels
 * through the four exported functions — create, link-existing, update, delete
 * — each of which runs inside one DB transaction and conserves the pair's
 * balances (RC-2 coalesced deltas, C-MATH-1 liability-aware signs, H-XFER-1
 * link invariants).
 *
 * Consolidated from 24 single-use shim files during the post-audit cleanup;
 * behavior is unchanged. transfer-contract stays separate (imported by
 * lib/transfers validation), as do the transaction-transfer-* modules used by
 * the transaction-create flow.
 */
import { and, eq, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { transactions, accounts, transfers } from '@/lib/db/schema';
import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import {
  computeBalanceDeltaCents,
  getAccountBalanceCents,
  updateScopedAccountBalance,
  insertTransactionMovement,
  insertTransferMovement,
  buildTransferMoneyFields,
  buildTransactionAmountFields,
  getTransactionAmountCents,
  getTransferAmountCents,
  getTransferFeesCents,
  applyAccountBalanceDeltas,
} from '@/lib/transactions/money-movement-service';
import { resolveAccountEntityId } from '@/lib/household/entities';
import { nanoid } from 'nanoid';
import { validateCanonicalTransferInput } from '@/lib/transactions/transfer-contract';
import { reverseTransactionSideEffects } from '@/lib/transactions/transaction-side-effect-reversal';

// ---------------------------------------------------------------------------
// from transfer-service-types.ts
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// from transfer-pair-helpers.ts
// ---------------------------------------------------------------------------
type DbClient = typeof db;

interface FindPairedTransferTransactionParams {
  tx: DbClient;
  transaction: typeof transactions.$inferSelect;
  userId: string;
  householdId: string;
}

function isTransferType(type: string | null | undefined): boolean {
  return type === 'transfer_out' || type === 'transfer_in';
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

async function findPairedTransferTransaction({
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

  return null;
}

// ---------------------------------------------------------------------------
// from transfer-update-account-access.ts
// ---------------------------------------------------------------------------

async function getScopedTransferAccountOrThrow(
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
  const selectableClient =
    typeof (tx as unknown as { select?: unknown }).select === 'function' ? tx : db;

  const account = await selectableClient
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
  throw new Error(`${label} account not found`);
}

async function loadScopedTransferAccountsById(
  tx: DbClient,
  {
    accountIds,
    userId,
    householdId,
  }: {
    accountIds: string[];
    userId: string;
    householdId: string;
  }
) {
  const rows = await Promise.all(
    accountIds.map(async (accountId) => {
      const account = await getScopedTransferAccountOrThrow(tx, {
        accountId,
        userId,
        householdId,
        label: 'Transfer',
      });
      return [accountId, account] as const;
    })
  );

  return new Map(rows);
}

// ---------------------------------------------------------------------------
// from transfer-create-account-updates.ts
// ---------------------------------------------------------------------------
type TransferTx = Parameters<Parameters<typeof runInDatabaseTransaction>[0]>[0];

async function applyCreatedTransferAccountUpdates({
  tx,
  userId,
  householdId,
  fromAccount,
  toAccount,
  fromAccountId,
  toAccountId,
  totalDebitCents,
  amountCents,
  nowIso,
}: {
  tx: TransferTx;
  userId: string;
  householdId: string;
  fromAccount: { usageCount: number | null; currentBalanceCents: number | null; type?: string | null };
  toAccount: { usageCount: number | null; currentBalanceCents: number | null; type?: string | null };
  fromAccountId: string;
  toAccountId: string;
  totalDebitCents: number;
  amountCents: number;
  nowIso: string;
}): Promise<void> {
  // Liability-aware legs (C-MATH-1): the source is debited (transfer_out) and the
  // destination credited (transfer_in). Paying a credit card is a transfer_in to
  // a liability, which reduces what you owe; a cash advance is a transfer_out
  // from a liability, which increases it.
  const newFromBalanceCents =
    getAccountBalanceCents({ currentBalanceCents: fromAccount.currentBalanceCents }) +
    computeBalanceDeltaCents({
      accountType: fromAccount.type,
      transactionType: 'transfer_out',
      amountCents: totalDebitCents,
    });
  const newToBalanceCents =
    getAccountBalanceCents({ currentBalanceCents: toAccount.currentBalanceCents }) +
    computeBalanceDeltaCents({
      accountType: toAccount.type,
      transactionType: 'transfer_in',
      amountCents,
    });

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
}

// ---------------------------------------------------------------------------
// from transfer-create-transaction-writes.ts
// ---------------------------------------------------------------------------

async function insertCreatedTransferTransactions({
  tx,
  userId,
  householdId,
  fromAccountId,
  toAccountId,
  amountCents,
  totalDebitCents,
  date,
  description,
  notes,
  isPending,
  isBalanceTransfer,
  savingsGoalId,
  offlineId,
  syncStatus,
  transferGroupId,
  fromTransactionId,
  toTransactionId,
  fromEntityId,
  toEntityId,
  nowIso,
}: {
  tx: TransferTx;
  userId: string;
  householdId: string;
  fromAccountId: string;
  toAccountId: string;
  amountCents: number;
  totalDebitCents: number;
  date: string;
  description: string;
  notes: string | null;
  isPending: boolean;
  isBalanceTransfer: boolean;
  savingsGoalId: string | null;
  offlineId: string | null;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error' | 'offline';
  transferGroupId: string;
  fromTransactionId: string;
  toTransactionId: string;
  fromEntityId: string;
  toEntityId: string;
  nowIso: string;
}): Promise<void> {
  await insertTransactionMovement(tx, {
    id: fromTransactionId,
    userId,
    householdId,
    entityId: fromEntityId,
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
    entityId: toEntityId,
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
}

// ---------------------------------------------------------------------------
// from transfer-create-persistence.ts
// ---------------------------------------------------------------------------
async function persistCreatedTransferPair({
  tx,
  userId,
  householdId,
  fromAccount,
  toAccount,
  fromAccountId,
  toAccountId,
  amountCents,
  feesCents,
  totalDebitCents,
  date,
  description,
  notes,
  isPending,
  isBalanceTransfer,
  savingsGoalId,
  offlineId,
  syncStatus,
  transferGroupId,
  fromTransactionId,
  toTransactionId,
  fromEntityId,
  toEntityId,
  nowIso,
}: {
  tx: Parameters<Parameters<typeof runInDatabaseTransaction>[0]>[0];
  userId: string;
  householdId: string;
  fromAccount: { usageCount: number | null; currentBalanceCents: number | null };
  toAccount: { usageCount: number | null; currentBalanceCents: number | null };
  fromAccountId: string;
  toAccountId: string;
  amountCents: number;
  feesCents: number;
  totalDebitCents: number;
  date: string;
  description: string;
  notes: string | null;
  isPending: boolean;
  isBalanceTransfer: boolean;
  savingsGoalId: string | null;
  offlineId: string | null;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error' | 'offline';
  transferGroupId: string;
  fromTransactionId: string;
  toTransactionId: string;
  fromEntityId: string;
  toEntityId: string;
  nowIso: string;
}): Promise<void> {
  await insertCreatedTransferTransactions({
    tx,
    userId,
    householdId,
    fromAccountId,
    toAccountId,
    amountCents,
    totalDebitCents,
    date,
    description,
    notes,
    isPending,
    isBalanceTransfer,
    savingsGoalId,
    offlineId,
    syncStatus,
    transferGroupId,
    fromTransactionId,
    toTransactionId,
    fromEntityId,
    toEntityId,
    nowIso,
  });

  await applyCreatedTransferAccountUpdates({
    tx,
    userId,
    householdId,
    fromAccount,
    toAccount,
    fromAccountId,
    toAccountId,
    totalDebitCents,
    amountCents,
    nowIso,
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
}

// ---------------------------------------------------------------------------
// from transfer-create-execution.ts
// ---------------------------------------------------------------------------
async function executeCreateCanonicalTransferPair({
  userId,
  householdId,
  fromAccountId,
  toAccountId,
  amountCents,
  feesCents,
  date,
  description,
  notes,
  isPending,
  isBalanceTransfer,
  savingsGoalId,
  offlineId,
  syncStatus,
  transferGroupId,
  fromTransactionId,
  toTransactionId,
}: {
  userId: string;
  householdId: string;
  fromAccountId: string;
  toAccountId: string;
  amountCents: number;
  feesCents: number;
  date: string;
  description: string;
  notes: string | null;
  isPending: boolean;
  isBalanceTransfer: boolean;
  savingsGoalId: string | null;
  offlineId: string | null;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error' | 'offline';
  transferGroupId: string;
  fromTransactionId: string;
  toTransactionId: string;
}): Promise<void> {
  const nowIso = new Date().toISOString();
  const totalDebitCents = amountCents + feesCents;

  await runInDatabaseTransaction(async (tx) => {
    const [fromAccount, toAccount] = await Promise.all([
      getScopedTransferAccountOrThrow(tx, {
        accountId: fromAccountId,
        userId,
        householdId,
        label: 'Source',
      }),
      getScopedTransferAccountOrThrow(tx, {
        accountId: toAccountId,
        userId,
        householdId,
        label: 'Destination',
      }),
    ]);
    const [fromEntityId, toEntityId] = await Promise.all([
      resolveAccountEntityId(householdId, userId, fromAccount.entityId),
      resolveAccountEntityId(householdId, userId, toAccount.entityId),
    ]);

    await persistCreatedTransferPair({
      tx,
      userId,
      householdId,
      fromAccount,
      toAccount,
      fromAccountId,
      toAccountId,
      amountCents,
      feesCents,
      totalDebitCents,
      date,
      description,
      notes,
      isPending,
      isBalanceTransfer,
      savingsGoalId,
      offlineId,
      syncStatus,
      transferGroupId,
      fromTransactionId,
      toTransactionId,
      fromEntityId,
      toEntityId,
      nowIso,
    });
  });
}

// ---------------------------------------------------------------------------
// from transfer-create-orchestrator.ts
// ---------------------------------------------------------------------------
async function executeTransferCreateOrchestration({
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
  const validated = validateCanonicalTransferInput({
    userId,
    householdId,
    fromAccountId,
    toAccountId,
    amountCents,
    feesCents,
    date,
    description,
    notes,
    isPending,
    isBalanceTransfer,
    savingsGoalId,
    offlineId,
    syncStatus,
    transferGroupId: incomingTransferGroupId,
    fromTransactionId: incomingFromTransactionId,
    toTransactionId: incomingToTransactionId,
  });

  const transferGroupId = incomingTransferGroupId ?? nanoid();
  const fromTransactionId = incomingFromTransactionId ?? nanoid();
  const toTransactionId = incomingToTransactionId ?? nanoid();

  await executeCreateCanonicalTransferPair({
    userId,
    householdId,
    fromAccountId: validated.fromAccountId,
    toAccountId: validated.toAccountId,
    amountCents: validated.amountCents,
    feesCents: validated.feesCents ?? 0,
    date: validated.date,
    description: validated.description,
    notes: validated.notes ?? null,
    isPending: validated.isPending ?? false,
    isBalanceTransfer: validated.isBalanceTransfer ?? false,
    savingsGoalId: validated.savingsGoalId ?? null,
    offlineId: validated.offlineId ?? null,
    syncStatus: validated.syncStatus ?? 'synced',
    transferGroupId,
    fromTransactionId,
    toTransactionId,
  });

  return {
    transferGroupId,
    fromTransactionId,
    toTransactionId,
  };
}

// ---------------------------------------------------------------------------
// from transfer-update-execution-types.ts
// ---------------------------------------------------------------------------
type TransferUpdateDbClient = typeof db;

interface ExecuteTransferPairUpdateParams {
  userId: string;
  householdId: string;
  transferOut: typeof transactions.$inferSelect;
  transferIn: typeof transactions.$inferSelect;
  transferGroupId: string;
  transferRecord: Array<typeof transfers.$inferSelect>;
  currentTransferAmountCents: number;
  currentFeesCents: number;
  amountCents?: number;
  date?: string;
  description?: string;
  notes?: string | null;
  isPending?: boolean;
  sourceAccountId?: string;
  destinationAccountId?: string;
}

// ---------------------------------------------------------------------------
// from transfer-update-execution-helpers.ts
// ---------------------------------------------------------------------------
function collectAffectedTransferAccountIds({
  currentSourceAccountId,
  currentDestinationAccountId,
  nextSourceAccountId,
  nextDestinationAccountId,
}: {
  currentSourceAccountId: string;
  currentDestinationAccountId: string;
  nextSourceAccountId: string;
  nextDestinationAccountId: string;
}): string[] {
  return Array.from(
    new Set([
      currentSourceAccountId,
      currentDestinationAccountId,
      nextSourceAccountId,
      nextDestinationAccountId,
    ])
  );
}

function buildTransferUpdateResult({
  transferGroupId,
  transferOut,
  transferIn,
  nextSourceAccountId,
  nextDestinationAccountId,
}: {
  transferGroupId: string;
  transferOut: typeof transactions.$inferSelect;
  transferIn: typeof transactions.$inferSelect;
  nextSourceAccountId: string;
  nextDestinationAccountId: string;
}) {
  return {
    transferGroupId,
    transferOutId: transferOut.id,
    transferInId: transferIn.id,
    sourceAccountId: nextSourceAccountId,
    destinationAccountId: nextDestinationAccountId,
  };
}

// ---------------------------------------------------------------------------
// from transfer-update-movement-write.ts
// ---------------------------------------------------------------------------
type TxClient = { update: typeof import('@/lib/db').db.update };

async function writeUpdatedTransferMovement({
  tx,
  transferGroupId,
  userId,
  householdId,
  nextSourceAccountId,
  nextDestinationAccountId,
  nextTransferAmountCents,
  nextFeesCents,
  nextDescription,
  nextDate,
  nextNotes,
  nextIsPending,
  transferOut,
  transferIn,
}: {
  tx: TxClient;
  transferGroupId: string;
  userId: string;
  householdId: string;
  nextSourceAccountId: string;
  nextDestinationAccountId: string;
  nextTransferAmountCents: number;
  nextFeesCents: number;
  nextDescription: string;
  nextDate: string;
  nextNotes: string | null;
  nextIsPending: boolean;
  transferOut: typeof transactions.$inferSelect;
  transferIn: typeof transactions.$inferSelect;
}) {
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
}

// ---------------------------------------------------------------------------
// from transfer-update-transaction-writes.ts
// ---------------------------------------------------------------------------

async function writeUpdatedTransferOutTransaction({
  tx,
  userId,
  householdId,
  transferOut,
  transferIn,
  transferGroupId,
  nextSourceAccountId,
  nextDestinationAccountId,
  nextDate,
  nextTransferOutAmountCents,
  nextDescription,
  nextNotes,
  nextIsPending,
  nowIso,
}: {
  tx: TxClient;
  userId: string;
  householdId: string;
  transferOut: typeof transactions.$inferSelect;
  transferIn: typeof transactions.$inferSelect;
  transferGroupId: string;
  nextSourceAccountId: string;
  nextDestinationAccountId: string;
  nextDate: string;
  nextTransferOutAmountCents: number;
  nextDescription: string;
  nextNotes: string | null;
  nextIsPending: boolean;
  nowIso: string;
}) {
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
}

async function writeUpdatedTransferInTransaction({
  tx,
  userId,
  householdId,
  transferIn,
  transferOut,
  transferGroupId,
  nextSourceAccountId,
  nextDestinationAccountId,
  nextDate,
  nextTransferAmountCents,
  nextDescription,
  nextNotes,
  nextIsPending,
  nowIso,
}: {
  tx: TxClient;
  userId: string;
  householdId: string;
  transferIn: typeof transactions.$inferSelect;
  transferOut: typeof transactions.$inferSelect;
  transferGroupId: string;
  nextSourceAccountId: string;
  nextDestinationAccountId: string;
  nextDate: string;
  nextTransferAmountCents: number;
  nextDescription: string;
  nextNotes: string | null;
  nextIsPending: boolean;
  nowIso: string;
}) {
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
}

// ---------------------------------------------------------------------------
// from transfer-update-persistence.ts
// ---------------------------------------------------------------------------
async function persistTransferPairUpdate({
  tx,
  userId,
  householdId,
  transferOut,
  transferIn,
  transferGroupId,
  transferRecord,
  nextSourceAccountId,
  nextDestinationAccountId,
  nextTransferAmountCents,
  nextTransferOutAmountCents,
  nextFeesCents,
  nextDate,
  nextDescription,
  nextNotes,
  nextIsPending,
  nowIso,
}: {
  tx: Parameters<Parameters<typeof runInDatabaseTransaction>[0]>[0];
  userId: string;
  householdId: string;
  transferOut: typeof transactions.$inferSelect;
  transferIn: typeof transactions.$inferSelect;
  transferGroupId: string;
  transferRecord: Array<typeof transfers.$inferSelect>;
  nextSourceAccountId: string;
  nextDestinationAccountId: string;
  nextTransferAmountCents: number;
  nextTransferOutAmountCents: number;
  nextFeesCents: number;
  nextDate: string;
  nextDescription: string;
  nextNotes: string | null;
  nextIsPending: boolean;
  nowIso: string;
}): Promise<void> {
  await writeUpdatedTransferOutTransaction({
    tx,
    userId,
    householdId,
    transferOut,
    transferIn,
    transferGroupId,
    nextSourceAccountId,
    nextDestinationAccountId,
    nextDate,
    nextTransferOutAmountCents,
    nextDescription,
    nextNotes,
    nextIsPending,
    nowIso,
  });

  await writeUpdatedTransferInTransaction({
    tx,
    userId,
    householdId,
    transferIn,
    transferOut,
    transferGroupId,
    nextSourceAccountId,
    nextDestinationAccountId,
    nextDate,
    nextTransferAmountCents,
    nextDescription,
    nextNotes,
    nextIsPending,
    nowIso,
  });

  if (transferRecord.length > 0) {
    await writeUpdatedTransferMovement({
      tx,
      transferGroupId,
      userId,
      householdId,
      nextSourceAccountId,
      nextDestinationAccountId,
      nextTransferAmountCents,
      nextFeesCents,
      nextDescription,
      nextDate,
      nextNotes,
      nextIsPending,
      transferOut,
      transferIn,
    });
    return;
  }

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

// ---------------------------------------------------------------------------
// from transfer-update-balance-application.ts
// ---------------------------------------------------------------------------

async function applyTransferBalanceDeltas({
  tx,
  accountsById,
  balanceDeltaByAccountId,
  userId,
  householdId,
}: {
  tx: DbClient;
  accountsById: Map<string, typeof accounts.$inferSelect>;
  balanceDeltaByAccountId: Map<string, number>;
  userId: string;
  householdId: string;
}): Promise<void> {
  for (const [accountId, delta] of balanceDeltaByAccountId.entries()) {
    if (delta === 0) {
      continue;
    }

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
}

function buildNextTransferFields({
  transferOut,
  transferIn,
  date,
  description,
  notes,
  isPending,
}: {
  transferOut: { date: string; description: string | null; notes: string | null; isPending: boolean | null };
  transferIn: { description: string | null; notes: string | null; isPending: boolean | null };
  date?: string;
  description?: string;
  notes?: string | null;
  isPending?: boolean;
}) {
  return {
    nextDate: date ?? transferOut.date,
    nextDescription: description ?? transferOut.description ?? transferIn.description ?? 'Transfer',
    nextNotes: notes !== undefined ? notes : transferOut.notes ?? transferIn.notes ?? null,
    nextIsPending:
      isPending !== undefined ? isPending : transferOut.isPending || transferIn.isPending || false,
  };
}

// ---------------------------------------------------------------------------
// from transfer-update-context-build.ts
// ---------------------------------------------------------------------------
function buildTransferUpdateContext({
  transferOut,
  transferIn,
  sourceAccountId,
  destinationAccountId,
  amountCents,
  currentTransferAmountCents,
  currentFeesCents,
}: {
  transferOut: typeof transactions.$inferSelect;
  transferIn: typeof transactions.$inferSelect;
  sourceAccountId?: string;
  destinationAccountId?: string;
  amountCents?: number;
  currentTransferAmountCents: number;
  currentFeesCents: number;
}) {
  const nextTransferAmountCents = amountCents ?? currentTransferAmountCents;
  const nextFeesCents = currentFeesCents;
  const currentTransferOutAmountCents = currentTransferAmountCents + currentFeesCents;
  const nextTransferOutAmountCents = nextTransferAmountCents + nextFeesCents;

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

  const nextSourceAccountId = sourceAccountId ?? currentSourceAccountId;
  const nextDestinationAccountId = destinationAccountId ?? currentDestinationAccountId;

  return {
    nextTransferAmountCents,
    nextFeesCents,
    currentTransferOutAmountCents,
    nextTransferOutAmountCents,
    currentSourceAccountId,
    currentDestinationAccountId,
    nextSourceAccountId,
    nextDestinationAccountId,
  };
}

function buildAccountBalanceDeltaById({
  currentSourceAccountId,
  currentDestinationAccountId,
  nextSourceAccountId,
  nextDestinationAccountId,
  currentTransferOutAmountCents,
  currentTransferAmountCents,
  nextTransferOutAmountCents,
  nextTransferAmountCents,
  typeByAccountId,
}: {
  currentSourceAccountId: string;
  currentDestinationAccountId: string;
  nextSourceAccountId: string;
  nextDestinationAccountId: string;
  currentTransferOutAmountCents: number;
  currentTransferAmountCents: number;
  nextTransferOutAmountCents: number;
  nextTransferAmountCents: number;
  /** Account id -> account type, so deltas are liability-aware (C-MATH-1). */
  typeByAccountId?: Map<string, string | null | undefined>;
}): Map<string, number> {
  const deltaByAccountId = new Map<string, number>();
  const addDelta = (accountId: string, delta: number) => {
    const currentDelta = deltaByAccountId.get(accountId) ?? 0;
    deltaByAccountId.set(accountId, currentDelta + delta);
  };
  const accountType = (accountId: string) => typeByAccountId?.get(accountId);

  // Reverse the OLD legs, then apply the NEW legs — each liability-aware. For an
  // asset account these reduce to +out / -in (reverse) and -out / +in (apply),
  // matching the previous behavior; for a credit account the signs flip so a
  // credit-card payment transfer reverses/applies correctly.
  addDelta(
    currentSourceAccountId,
    -computeBalanceDeltaCents({
      accountType: accountType(currentSourceAccountId),
      transactionType: 'transfer_out',
      amountCents: currentTransferOutAmountCents,
    })
  );
  addDelta(
    currentDestinationAccountId,
    -computeBalanceDeltaCents({
      accountType: accountType(currentDestinationAccountId),
      transactionType: 'transfer_in',
      amountCents: currentTransferAmountCents,
    })
  );
  addDelta(
    nextSourceAccountId,
    computeBalanceDeltaCents({
      accountType: accountType(nextSourceAccountId),
      transactionType: 'transfer_out',
      amountCents: nextTransferOutAmountCents,
    })
  );
  addDelta(
    nextDestinationAccountId,
    computeBalanceDeltaCents({
      accountType: accountType(nextDestinationAccountId),
      transactionType: 'transfer_in',
      amountCents: nextTransferAmountCents,
    })
  );

  return deltaByAccountId;
}

// ---------------------------------------------------------------------------
// from transfer-update-context.ts
// ---------------------------------------------------------------------------

async function loadTransferUpdateContext(
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

// ---------------------------------------------------------------------------
// from transfer-update-execution.ts
// ---------------------------------------------------------------------------
async function executeTransferPairUpdate(
  tx: TransferUpdateDbClient,
  {
    userId,
    householdId,
    transferOut,
    transferIn,
    transferGroupId,
    transferRecord,
    currentTransferAmountCents,
    currentFeesCents,
    amountCents,
    date,
    description,
    notes,
    isPending,
    sourceAccountId,
    destinationAccountId,
  }: ExecuteTransferPairUpdateParams
) {
  const {
    nextTransferAmountCents,
    nextFeesCents,
    currentTransferOutAmountCents,
    nextTransferOutAmountCents,
    currentSourceAccountId,
    currentDestinationAccountId,
    nextSourceAccountId,
    nextDestinationAccountId,
  } = buildTransferUpdateContext({
    transferOut,
    transferIn,
    sourceAccountId,
    destinationAccountId,
    amountCents,
    currentTransferAmountCents,
    currentFeesCents,
  });

  if (nextSourceAccountId === nextDestinationAccountId) {
    throw new Error('Cannot transfer to the same account');
  }

  const affectedAccountIds = collectAffectedTransferAccountIds({
    currentSourceAccountId,
    currentDestinationAccountId,
    nextSourceAccountId,
    nextDestinationAccountId,
  });

  const accountsById = await loadScopedTransferAccountsById(tx, {
    accountIds: affectedAccountIds,
    userId,
    householdId,
  });
  const typeByAccountId = new Map(
    Array.from(accountsById.entries()).map(([id, account]) => [id, account.type])
  );
  const balanceDeltaByAccountId = buildAccountBalanceDeltaById({
    currentSourceAccountId,
    currentDestinationAccountId,
    nextSourceAccountId,
    nextDestinationAccountId,
    currentTransferOutAmountCents,
    currentTransferAmountCents,
    nextTransferOutAmountCents,
    nextTransferAmountCents,
    typeByAccountId,
  });

  await applyTransferBalanceDeltas({
    tx,
    accountsById,
    balanceDeltaByAccountId,
    userId,
    householdId,
  });

  const nowIso = new Date().toISOString();
  const { nextDate, nextDescription, nextNotes, nextIsPending } = buildNextTransferFields({
    transferOut,
    transferIn,
    date,
    description,
    notes,
    isPending,
  });

  await persistTransferPairUpdate({
    tx,
    userId,
    householdId,
    transferOut,
    transferIn,
    transferGroupId,
    transferRecord,
    nextSourceAccountId,
    nextDestinationAccountId,
    nextTransferAmountCents,
    nextTransferOutAmountCents,
    nextFeesCents,
    nextDate,
    nextDescription,
    nextNotes,
    nextIsPending,
    nowIso,
  });

  return buildTransferUpdateResult({
    transferGroupId,
    transferOut,
    transferIn,
    nextSourceAccountId,
    nextDestinationAccountId,
  });
}

// ---------------------------------------------------------------------------
// from transfer-update-orchestrator.ts
// ---------------------------------------------------------------------------
async function executeTransferUpdateOrchestration({
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
    const {
      transferOut,
      transferIn,
      transferGroupId,
      transferRecord,
      currentTransferAmountCents,
      currentFeesCents,
      currentSourceAccountId,
      currentDestinationAccountId,
    } = await loadTransferUpdateContext(tx, {
      userId,
      householdId,
      transactionId,
    });

    const updated = await executeTransferPairUpdate(tx, {
      userId,
      householdId,
      transferOut,
      transferIn,
      transferGroupId,
      transferRecord,
      currentTransferAmountCents,
      currentFeesCents,
      amountCents,
      date,
      description,
      notes,
      isPending,
      sourceAccountId: sourceAccountId ?? currentSourceAccountId,
      destinationAccountId: destinationAccountId ?? currentDestinationAccountId,
    });

    resultTransferGroupId = updated.transferGroupId;
    resultTransferOutId = updated.transferOutId;
    resultTransferInId = updated.transferInId;
    resultSourceAccountId = updated.sourceAccountId;
    resultDestinationAccountId = updated.destinationAccountId;
  });

  return {
    transferGroupId: resultTransferGroupId,
    transferOutId: resultTransferOutId,
    transferInId: resultTransferInId,
    sourceAccountId: resultSourceAccountId,
    destinationAccountId: resultDestinationAccountId,
  };
}

// ---------------------------------------------------------------------------
// from transfer-delete-context.ts
// ---------------------------------------------------------------------------

async function loadTransferDeleteContext({
  tx,
  userId,
  householdId,
  transactionId,
}: {
  tx: DbClient;
  userId: string;
  householdId: string;
  transactionId: string;
}): Promise<{
  txRecord: typeof transactions.$inferSelect;
  paired: typeof transactions.$inferSelect | null;
}> {
  const txRecordRows = await tx
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
  if (txRecordRows.length === 0) {
    throw new Error('Transfer transaction not found');
  }

  const txRecord = txRecordRows[0];

  let paired: typeof transactions.$inferSelect | null = null;
  if (txRecord.pairedTransactionId) {
    paired =
      (
        await tx
          .select()
          .from(transactions)
          .where(
            and(
              eq(transactions.id, txRecord.pairedTransactionId),
              eq(transactions.userId, userId),
              eq(transactions.householdId, householdId)
            )
          )
          .limit(1)
      )[0] ?? null;
  }

  if (!paired) {
    const oppositeType = txRecord.type === 'transfer_out' ? 'transfer_in' : 'transfer_out';

    paired =
      (
        await tx
          .select()
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, userId),
              eq(transactions.householdId, householdId),
              eq(transactions.type, oppositeType),
              eq(transactions.transferId, txRecord.id)
            )
          )
          .limit(1)
      )[0] ?? null;
  }

  if (!paired && txRecord.transferGroupId) {
    paired =
      (
        await tx
          .select()
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, userId),
              eq(transactions.householdId, householdId),
              txRecord.type === 'transfer_out'
                ? eq(transactions.type, 'transfer_in')
                : eq(transactions.type, 'transfer_out'),
              eq(transactions.transferGroupId, txRecord.transferGroupId)
            )
          )
          .limit(1)
      )[0] ?? null;
  }

  if (!paired && txRecord.transferId) {
    paired =
      (
        await tx
          .select()
          .from(transactions)
          .where(
            and(
              eq(transactions.id, txRecord.transferId),
              eq(transactions.userId, userId),
              eq(transactions.householdId, householdId),
              txRecord.type === 'transfer_out'
                ? eq(transactions.type, 'transfer_in')
                : eq(transactions.type, 'transfer_out')
            )
          )
          .limit(1)
      )[0] ?? null;
  }

  return { txRecord, paired };
}

function resolveTransferDeleteContext({
  txRecord,
  paired,
  transferRows,
}: {
  txRecord: typeof transactions.$inferSelect;
  paired: typeof transactions.$inferSelect | null;
  transferRows: Array<typeof transfers.$inferSelect>;
}): {
  transferOut: typeof transactions.$inferSelect | null;
  transferIn: typeof transactions.$inferSelect | null;
  transferGroupId: string | null;
  transferAmountCents: number;
  totalDebitCents: number;
  sourceAccountId: string | null;
  destinationAccountId: string | null;
} {
  const transferOut =
    txRecord.type === 'transfer_out'
      ? txRecord
      : paired && paired.type === 'transfer_out'
        ? paired
        : null;
  const transferIn =
    txRecord.type === 'transfer_in'
      ? txRecord
      : paired && paired.type === 'transfer_in'
        ? paired
        : null;

  const transferGroupId =
    txRecord.transferGroupId ||
    paired?.transferGroupId ||
    (txRecord.transferId && txRecord.transferId !== txRecord.accountId ? txRecord.transferId : null);

  const transferRecord = transferRows[0];

  const transferAmountCents = transferRecord
    ? getTransferAmountCents(transferRecord)
    : transferIn
      ? getTransactionAmountCents(transferIn)
      : transferOut
        ? getTransactionAmountCents(transferOut)
        : 0;

  const totalDebitCents = transferRecord
    ? transferAmountCents + getTransferFeesCents(transferRecord)
    : transferOut
      ? getTransactionAmountCents(transferOut)
      : transferAmountCents;

  const sourceAccountId =
    transferOut?.transferSourceAccountId ||
    transferOut?.accountId ||
    transferIn?.transferSourceAccountId ||
    null;
  const destinationAccountId =
    transferOut?.transferDestinationAccountId ||
    transferIn?.accountId ||
    transferIn?.transferDestinationAccountId ||
    null;

  return {
    transferOut,
    transferIn,
    transferGroupId,
    transferAmountCents,
    totalDebitCents,
    sourceAccountId,
    destinationAccountId,
  };
}

// ---------------------------------------------------------------------------
// from transfer-delete-account-updates.ts
// ---------------------------------------------------------------------------

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
  const selectableClient =
    typeof (tx as unknown as { select?: unknown }).select === 'function' ? tx : db;

  const account = await selectableClient
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
  throw new Error(`${label} account not found`);
}

async function revertTransferPairBalances({
  tx,
  userId,
  householdId,
  sourceAccountId,
  destinationAccountId,
  transferAmountCents,
  totalDebitCents,
}: {
  tx: DbClient;
  userId: string;
  householdId: string;
  sourceAccountId: string | null;
  destinationAccountId: string | null;
  transferAmountCents: number;
  totalDebitCents: number;
}): Promise<void> {
  if (!sourceAccountId || !destinationAccountId) {
    return;
  }

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

  // Reverse each leg's original (liability-aware) effect: the source was debited
  // (transfer_out of amount+fees), the destination credited (transfer_in of
  // amount). Coalescing per account also fixes the same-account clobber where
  // two absolute writes from a shared stale read dropped one leg (H-XFER-2).
  const sourceReversal = -computeBalanceDeltaCents({
    accountType: sourceAccount.type,
    transactionType: 'transfer_out',
    amountCents: totalDebitCents,
  });
  const destinationReversal = -computeBalanceDeltaCents({
    accountType: destinationAccount.type,
    transactionType: 'transfer_in',
    amountCents: transferAmountCents,
  });

  await applyAccountBalanceDeltas(
    tx,
    [
      { accountId: sourceAccountId, deltaCents: sourceReversal },
      { accountId: destinationAccountId, deltaCents: destinationReversal },
    ],
    { userId, householdId }
  );
}

// ---------------------------------------------------------------------------
// from transfer-delete-pair-execution.ts
// ---------------------------------------------------------------------------

async function deleteTransferPairRecordsAndRevertBalances(
  tx: DbClient,
  {
    userId,
    householdId,
    txRecord,
    paired,
  }: {
    userId: string;
    householdId: string;
    txRecord: typeof transactions.$inferSelect;
    paired: typeof transactions.$inferSelect | null;
  }
): Promise<void> {
  const transferGroupId =
    txRecord.transferGroupId ||
    paired?.transferGroupId ||
    (txRecord.transferId && txRecord.transferId !== txRecord.accountId ? txRecord.transferId : null);
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
  const deleteContext = resolveTransferDeleteContext({
    txRecord,
    paired,
    transferRows: transferRecord,
  });

  await revertTransferPairBalances({
    tx,
    userId,
    householdId,
    sourceAccountId: deleteContext.sourceAccountId,
    destinationAccountId: deleteContext.destinationAccountId,
    transferAmountCents: deleteContext.transferAmountCents,
    totalDebitCents: deleteContext.totalDebitCents,
  });

  // Reverse any goal contribution / bill payment / debt payment linked to either
  // leg of the pair before deleting them (C-LIFE-2, H-BILL-1). A credit-card
  // payment transfer, for example, links a bill payment to the transfer_in leg.
  await reverseTransactionSideEffects(tx, {
    transactionId: txRecord.id,
    userId,
    householdId,
  });
  if (paired) {
    await reverseTransactionSideEffects(tx, {
      transactionId: paired.id,
      userId,
      householdId,
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
}

// ---------------------------------------------------------------------------
// from transfer-link-existing-execution.ts
// ---------------------------------------------------------------------------
async function executeLinkExistingTransferPair({
  userId,
  householdId,
  firstTransactionId,
  secondTransactionId,
  transferGroupId,
}: {
  userId: string;
  householdId: string;
  firstTransactionId: string;
  secondTransactionId: string;
  transferGroupId: string;
}): Promise<{ transferOutId: string; transferInId: string }> {
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

    if (
      first[0].transferGroupId ||
      second[0].transferGroupId ||
      first[0].pairedTransactionId ||
      second[0].pairedTransactionId
    ) {
      throw new Error('One or both transactions are already linked as a transfer');
    }

    const { transferOut, transferIn } = resolveTransferRoles(first[0], second[0]);
    transferOutId = transferOut.id;
    transferInId = transferIn.id;
    const transferAmountCents = getTransactionAmountCents(transferOut);

    // Invariants (audit finding H-XFER-1): the two legs of a transfer must have
    // EQUAL amounts and DIFFERENT accounts. Linking a $100 expense to a $98
    // income (rule tolerance matching) stored the out-leg amount on the transfers
    // row; deleting the pair later reversed the destination by $100 when only
    // $98 was ever applied — permanent drift the project's own integrity script
    // flags as corrupt. Same-account pairs corrupt balances on delete (H-XFER-2).
    if (Math.abs(getTransactionAmountCents(transferIn)) !== Math.abs(transferAmountCents)) {
      throw new Error(
        'Cannot link transactions with different amounts as a transfer'
      );
    }
    if (transferOut.accountId === transferIn.accountId) {
      throw new Error('Cannot link two transactions on the same account as a transfer');
    }

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
    transferOutId,
    transferInId,
  };
}

// ---------------------------------------------------------------------------
// from transfer-service-link-delete.ts
// ---------------------------------------------------------------------------
async function linkExistingTransferPair({
  userId,
  householdId,
  firstTransactionId,
  secondTransactionId,
  incomingTransferGroupId,
}: {
  userId: string;
  householdId: string;
  firstTransactionId: string;
  secondTransactionId: string;
  incomingTransferGroupId?: string;
}): Promise<{
  transferGroupId: string;
  transferOutId: string;
  transferInId: string;
}> {
  const transferGroupId = incomingTransferGroupId ?? nanoid();
  const { transferOutId, transferInId } = await executeLinkExistingTransferPair({
    userId,
    householdId,
    firstTransactionId,
    secondTransactionId,
    transferGroupId,
  });

  return {
    transferGroupId,
    transferOutId,
    transferInId,
  };
}

async function deleteCanonicalTransferPair({
  userId,
  householdId,
  transactionId,
}: {
  userId: string;
  householdId: string;
  transactionId: string;
}): Promise<void> {
  await runInDatabaseTransaction(async (tx) => {
    const { txRecord, paired } = await loadTransferDeleteContext({
      tx,
      userId,
      householdId,
      transactionId,
    });

    await deleteTransferPairRecordsAndRevertBalances(tx, {
      userId,
      householdId,
      txRecord,
      paired,
    });
  });
}

// ---------------------------------------------------------------------------
// from transfer-service.ts
// ---------------------------------------------------------------------------
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
  return executeTransferCreateOrchestration({
    userId,
    householdId,
    fromAccountId,
    toAccountId,
    amountCents,
    feesCents,
    date,
    description,
    notes,
    isPending,
    isBalanceTransfer,
    savingsGoalId,
    offlineId,
    syncStatus,
    transferGroupId: incomingTransferGroupId,
    fromTransactionId: incomingFromTransactionId,
    toTransactionId: incomingToTransactionId,
  });
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
  return linkExistingTransferPair({
    userId,
    householdId,
    firstTransactionId,
    secondTransactionId,
    incomingTransferGroupId,
  });
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
  return executeTransferUpdateOrchestration({
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
  });
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
  await deleteCanonicalTransferPair({
    userId,
    householdId,
    transactionId,
  });
}
