/**
 * Convert-to-transfer flow: turns an existing transaction into one leg of a
 * transfer pair (or matches it to an existing opposite leg), atomically
 * rewriting types, links, and account balances inside one DB transaction.
 *
 * Consolidated from 12 single-use shim files (write-types / write-balance /
 * write-helpers / transfer-writes / branch-writes / write-execution /
 * pair-execution / route-helpers / validation / scoped-load /
 * matched-execution / route-handler) during the post-audit cleanup; behavior
 * is unchanged.
 */
import { db } from '@/lib/db';
import { accounts, transactions } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import {
  getAccountBalanceCents,
  getTransactionAmountCents,
  insertTransactionMovement,
  insertTransferMovement,
  updateScopedAccountBalance,
} from '@/lib/transactions/money-movement-service';
import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import { linkExistingTransactionsAsCanonicalTransfer } from '@/lib/transactions/transfer-service';
import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { nanoid } from 'nanoid';
import { handleRouteError } from '@/lib/api/route-helpers';

// ---------------------------------------------------------------------------
// from transaction-convert-write-types.ts
// ---------------------------------------------------------------------------
type MoneyTx = typeof db;

interface ConvertWriteBaseParams {
  tx: MoneyTx;
  id: string;
  userId: string;
  householdId: string;
  targetAccountId: string;
  transaction: typeof transactions.$inferSelect;
  sourceAccount: typeof accounts.$inferSelect;
  targetAccount: typeof accounts.$inferSelect;
  amountCents: number;
  transferGroupId: string;
  pairedTransactionId: string;
  nowIso: string;
}

// ---------------------------------------------------------------------------
// from transaction-convert-write-balance.ts
// ---------------------------------------------------------------------------
async function adjustTargetAccountBalance({
  tx,
  targetAccountId,
  userId,
  householdId,
  amountDeltaCents,
}: {
  tx: MoneyTx;
  targetAccountId: string;
  userId: string;
  householdId: string;
  amountDeltaCents: number;
}) {
  const refreshedTarget = await tx
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.id, targetAccountId),
        eq(accounts.userId, userId),
        eq(accounts.householdId, householdId)
      )
    )
    .limit(1);

  if (refreshedTarget.length === 0) {
    return;
  }

  await updateScopedAccountBalance(tx, {
    accountId: targetAccountId,
    userId,
    householdId,
    balanceCents: getAccountBalanceCents(refreshedTarget[0]) + amountDeltaCents,
  });
}

// ---------------------------------------------------------------------------
// from transaction-convert-write-helpers.ts
// ---------------------------------------------------------------------------
async function updateConvertedTransactionRecord({
  tx,
  id,
  transferType,
  transferGroupId,
  pairedTransactionId,
  transferSourceAccountId,
  transferDestinationAccountId,
  description,
  nowIso,
}: {
  tx: MoneyTx;
  id: string;
  transferType: 'transfer_out' | 'transfer_in';
  transferGroupId: string;
  pairedTransactionId: string;
  transferSourceAccountId: string;
  transferDestinationAccountId: string;
  description: string;
  nowIso: string;
}): Promise<void> {
  await tx
    .update(transactions)
    .set({
      type: transferType,
      categoryId: null,
      merchantId: null,
      transferId: transferGroupId,
      transferGroupId,
      pairedTransactionId,
      transferSourceAccountId,
      transferDestinationAccountId,
      description,
      updatedAt: nowIso,
    })
    .where(eq(transactions.id, id));
}

async function applyTargetBalanceDelta({
  tx,
  targetAccountId,
  userId,
  householdId,
  amountDeltaCents,
}: {
  tx: MoneyTx;
  targetAccountId: string;
  userId: string;
  householdId: string;
  amountDeltaCents: number;
}): Promise<void> {
  await adjustTargetAccountBalance({
    tx,
    targetAccountId,
    userId,
    householdId,
    amountDeltaCents,
  });
}

// ---------------------------------------------------------------------------
// from transaction-convert-transfer-writes.ts
// ---------------------------------------------------------------------------
async function insertPairedTransferTransaction({
  tx,
  id,
  userId,
  householdId,
  accountId,
  date,
  amountCents,
  description,
  notes,
  transferType,
  transferGroupId,
  pairedTransactionId,
  transferSourceAccountId,
  transferDestinationAccountId,
  isPending,
  nowIso,
}: {
  tx: MoneyTx;
  id: string;
  userId: string;
  householdId: string;
  accountId: string;
  date: string;
  amountCents: number;
  description: string;
  notes: string | null;
  transferType: 'transfer_in' | 'transfer_out';
  transferGroupId: string;
  pairedTransactionId: string;
  transferSourceAccountId: string;
  transferDestinationAccountId: string;
  isPending: boolean;
  nowIso: string;
}): Promise<void> {
  await insertTransactionMovement(tx, {
    id,
    userId,
    householdId,
    accountId,
    categoryId: null,
    merchantId: null,
    date,
    amountCents,
    description,
    notes,
    type: transferType,
    transferId: transferGroupId,
    transferGroupId,
    pairedTransactionId,
    transferSourceAccountId,
    transferDestinationAccountId,
    isPending,
    createdAt: nowIso,
    updatedAt: nowIso,
  });
}

async function insertCanonicalTransferRecord({
  tx,
  transferGroupId,
  userId,
  householdId,
  fromAccountId,
  toAccountId,
  amountCents,
  date,
  description,
  fromTransactionId,
  toTransactionId,
  notes,
  nowIso,
}: {
  tx: MoneyTx;
  transferGroupId: string;
  userId: string;
  householdId: string;
  fromAccountId: string;
  toAccountId: string;
  amountCents: number;
  date: string;
  description: string;
  fromTransactionId: string;
  toTransactionId: string;
  notes: string | null;
  nowIso: string;
}): Promise<void> {
  await insertTransferMovement(tx, {
    id: transferGroupId,
    userId,
    householdId,
    fromAccountId,
    toAccountId,
    amountCents,
    feesCents: 0,
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
// from transaction-convert-branch-writes.ts
// ---------------------------------------------------------------------------
async function executeConversionBranchWrites({
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

// ---------------------------------------------------------------------------
// from transaction-convert-write-execution.ts
// ---------------------------------------------------------------------------
async function executeExpenseConversionWrites({
  tx,
  id,
  userId,
  householdId,
  targetAccountId,
  transaction,
  sourceAccount,
  targetAccount,
  amountCents,
  transferGroupId,
  pairedTransactionId,
  nowIso,
}: ConvertWriteBaseParams): Promise<void> {
  await executeConversionBranchWrites({
    tx,
    id,
    userId,
    householdId,
    amountCents,
    transferGroupId,
    pairedTransactionId,
    nowIso,
    originalTransactionDate: transaction.date,
    originalTransactionNotes: transaction.notes,
    originalTransactionDescription: transaction.description,
    convertedType: 'transfer_out',
    convertedDescription: `Transfer: ${sourceAccount.name} -> ${targetAccount.name}`,
    convertedSourceAccountId: transaction.accountId,
    convertedDestinationAccountId: targetAccountId,
    pairedType: 'transfer_in',
    pairedDescription: `Transfer: ${sourceAccount.name} -> ${targetAccount.name}`,
    pairedAccountId: targetAccountId,
    pairedId: pairedTransactionId,
    pairedLinkTransactionId: id,
    pairedSourceAccountId: transaction.accountId,
    pairedDestinationAccountId: targetAccountId,
    balanceDeltaCents: amountCents,
    canonicalFromAccountId: transaction.accountId,
    canonicalToAccountId: targetAccountId,
    canonicalFromTransactionId: id,
    canonicalToTransactionId: pairedTransactionId,
    isPending: Boolean(transaction.isPending),
  });
}

async function executeIncomeConversionWrites({
  tx,
  id,
  userId,
  householdId,
  targetAccountId,
  transaction,
  sourceAccount,
  targetAccount,
  amountCents,
  transferGroupId,
  pairedTransactionId,
  nowIso,
}: ConvertWriteBaseParams): Promise<void> {
  await executeConversionBranchWrites({
    tx,
    id,
    userId,
    householdId,
    amountCents,
    transferGroupId,
    pairedTransactionId,
    nowIso,
    originalTransactionDate: transaction.date,
    originalTransactionNotes: transaction.notes,
    originalTransactionDescription: transaction.description,
    convertedType: 'transfer_in',
    convertedDescription: `Transfer: ${targetAccount.name} -> ${sourceAccount.name}`,
    convertedSourceAccountId: targetAccountId,
    convertedDestinationAccountId: transaction.accountId,
    pairedType: 'transfer_out',
    pairedDescription: `Transfer: ${targetAccount.name} -> ${sourceAccount.name}`,
    pairedAccountId: targetAccountId,
    pairedId: pairedTransactionId,
    pairedLinkTransactionId: id,
    pairedSourceAccountId: targetAccountId,
    pairedDestinationAccountId: transaction.accountId,
    balanceDeltaCents: -amountCents,
    canonicalFromAccountId: targetAccountId,
    canonicalToAccountId: transaction.accountId,
    canonicalFromTransactionId: pairedTransactionId,
    canonicalToTransactionId: id,
    isPending: Boolean(transaction.isPending),
  });
}

// ---------------------------------------------------------------------------
// from transaction-convert-pair-execution.ts
// ---------------------------------------------------------------------------
async function executeUnmatchedTransferConversion({
  id,
  userId,
  householdId,
  targetAccountId,
  transaction,
  sourceAccount,
  targetAccount,
  amountCents,
  isExpense,
  transferGroupId,
  pairedTransactionId,
}: {
  id: string;
  userId: string;
  householdId: string;
  targetAccountId: string;
  transaction: typeof transactions.$inferSelect;
  sourceAccount: typeof accounts.$inferSelect;
  targetAccount: typeof accounts.$inferSelect;
  amountCents: number;
  isExpense: boolean;
  transferGroupId: string;
  pairedTransactionId: string;
}): Promise<void> {
  const nowIso = new Date().toISOString();

  await runInDatabaseTransaction(async (tx) => {
    if (isExpense) {
      await executeExpenseConversionWrites({
        tx,
        id,
        userId,
        householdId,
        targetAccountId,
        transaction,
        sourceAccount,
        targetAccount,
        amountCents,
        transferGroupId,
        pairedTransactionId,
        nowIso,
      });
      return;
    }

    await executeIncomeConversionWrites({
      tx,
      id,
      userId,
      householdId,
      targetAccountId,
      transaction,
      sourceAccount,
      targetAccount,
      amountCents,
      transferGroupId,
      pairedTransactionId,
      nowIso,
    });
  });
}

// ---------------------------------------------------------------------------
// from transaction-convert-route-helpers.ts
// ---------------------------------------------------------------------------
function validateSourceTransactionForConversion({
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

function buildConvertSuccessResponse({
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

// ---------------------------------------------------------------------------
// from transaction-convert-validation.ts
// ---------------------------------------------------------------------------
function isTransferType(type: string | null | undefined): boolean {
  return type === 'transfer_out' || type === 'transfer_in';
}

function validateMatchingTransactionForConversion({
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

// ---------------------------------------------------------------------------
// from transaction-convert-scoped-load.ts
// ---------------------------------------------------------------------------
function validateConvertRequestInput({
  householdId,
  targetAccountId,
}: {
  householdId: string | null;
  targetAccountId?: string;
}): Response | null {
  if (!householdId) {
    return Response.json({ error: 'Household ID is required' }, { status: 400 });
  }

  if (!targetAccountId) {
    return Response.json({ error: 'Target account ID is required' }, { status: 400 });
  }

  return null;
}

async function loadScopedTransaction({
  id,
  userId,
  householdId,
}: {
  id: string;
  userId: string;
  householdId: string;
}): Promise<typeof transactions.$inferSelect | null> {
  const rows = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.id, id),
        eq(transactions.userId, userId),
        eq(transactions.householdId, householdId)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

async function loadScopedAccount({
  accountId,
  userId,
  householdId,
}: {
  accountId: string;
  userId: string;
  householdId: string;
}): Promise<typeof accounts.$inferSelect | null> {
  const rows = await db
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
  return rows[0] ?? null;
}

async function loadConversionAccounts({
  sourceAccountId,
  targetAccountId,
  userId,
  householdId,
}: {
  sourceAccountId: string;
  targetAccountId: string;
  userId: string;
  householdId: string;
}): Promise<{
  sourceAccount: typeof accounts.$inferSelect | null;
  targetAccount: typeof accounts.$inferSelect | null;
}> {
  const [targetAccount, sourceAccount] = await Promise.all([
    loadScopedAccount({ accountId: targetAccountId, userId, householdId }),
    loadScopedAccount({ accountId: sourceAccountId, userId, householdId }),
  ]);

  return { sourceAccount, targetAccount };
}

// ---------------------------------------------------------------------------
// from transaction-convert-matched-execution.ts
// ---------------------------------------------------------------------------
async function executeMatchedTransactionConversion({
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

// ---------------------------------------------------------------------------
// from transaction-convert-to-transfer-route-handler.ts
// ---------------------------------------------------------------------------
export async function handleConvertTransactionToTransfer(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const { targetAccountId, matchingTransactionId } = body;

    const householdId = getHouseholdIdFromRequest(request, body);
    await requireHouseholdAuth(userId, householdId);
    const requestValidationError = validateConvertRequestInput({
      householdId,
      targetAccountId,
    });
    if (requestValidationError) {
      return requestValidationError;
    }
    const scopedHouseholdId = householdId as string;
    const requiredTargetAccountId = targetAccountId as string;

    const transaction = await loadScopedTransaction({
      id,
      userId,
      householdId: scopedHouseholdId,
    });
    if (!transaction) {
      return Response.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }
    const sourceValidationError = validateSourceTransactionForConversion({
      transaction,
      targetAccountId: requiredTargetAccountId,
    });
    if (sourceValidationError) {
      return sourceValidationError;
    }

    const { targetAccount, sourceAccount } = await loadConversionAccounts({
      sourceAccountId: transaction.accountId,
      targetAccountId: requiredTargetAccountId,
      userId,
      householdId: scopedHouseholdId,
    });
    if (!targetAccount) {
      return Response.json(
        { error: 'Target account not found in household' },
        { status: 404 }
      );
    }
    if (!sourceAccount) {
      return Response.json(
        { error: 'Source account not found' },
        { status: 404 }
      );
    }

    if (matchingTransactionId) {
      return executeMatchedTransactionConversion({
        id,
        matchingTransactionId,
        userId,
        householdId: scopedHouseholdId,
        targetAccountId: requiredTargetAccountId,
        transaction,
      });
    }

    const amountCents = getTransactionAmountCents(transaction);
    const isExpense = transaction.type === 'expense';
    const transferGroupId = nanoid();
    const pairedTransactionId = nanoid();
    await executeUnmatchedTransferConversion({
      id,
      userId,
      householdId: scopedHouseholdId,
      targetAccountId: requiredTargetAccountId,
      transaction,
      sourceAccount,
      targetAccount,
      amountCents,
      isExpense,
      transferGroupId,
      pairedTransactionId,
    });

    return buildConvertSuccessResponse({
      id,
      pairedTransactionId,
      transferGroupId,
      matched: false,
    });
  } catch (error) {
    return handleRouteError(error, {
      defaultError: 'Internal server error',
      logLabel: 'Convert to transfer error:',
    });
  }
}
