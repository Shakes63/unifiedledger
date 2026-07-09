/**
 * Route handlers for /api/transfers/[id]: scoped access, GET/PUT/DELETE through the canonical transfer engine.
 *
 * Consolidated from single-use shim files during the post-audit cleanup;
 * behavior is unchanged.
 */
import { and, eq, isNull, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { accounts, transfers, transactions } from '@/lib/db/schema';
import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import {
  getAccountBalanceCents,
  getTransferAmountCents,
  getTransferFeesCents,
  updateScopedAccountBalance,
} from '@/lib/transactions/money-movement-service';
import {
  deleteCanonicalTransferPairByTransactionId,
  updateCanonicalTransferPairByTransactionId,
} from '@/lib/transactions/transfer-service';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { resolveAndRequireEntity } from '@/lib/api/entity-auth';
import { handleRouteError } from '@/lib/api/route-helpers';

// ---------------------------------------------------------------------------
// from transfer-id-access.ts
// ---------------------------------------------------------------------------
async function getTransferForSelectedEntity({
  transferId,
  userId,
  householdId,
  selectedEntityId,
  selectedEntityIsDefault,
}: {
  transferId: string;
  userId: string;
  householdId: string;
  selectedEntityId: string;
  selectedEntityIsDefault: boolean;
}) {
  const transferRows = await db
    .select()
    .from(transfers)
    .where(
      and(
        eq(transfers.id, transferId),
        eq(transfers.userId, userId),
        eq(transfers.householdId, householdId)
      )
    )
    .limit(1);
  const transfer = transferRows[0];
  if (!transfer) {
    return null;
  }

  const visibleAccounts = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.householdId, householdId),
        selectedEntityIsDefault
          ? or(eq(accounts.entityId, selectedEntityId), isNull(accounts.entityId))
          : eq(accounts.entityId, selectedEntityId),
        or(eq(accounts.id, transfer.fromAccountId), eq(accounts.id, transfer.toAccountId))
      )
    );

  if (visibleAccounts.length === 0) {
    return null;
  }

  return transfer;
}

async function getTransferAccountNames({
  userId,
  householdId,
  fromAccountId,
  toAccountId,
}: {
  userId: string;
  householdId: string;
  fromAccountId: string;
  toAccountId: string;
}) {
  const [fromAccount, toAccount] = await Promise.all([
    db
      .select({ name: accounts.name })
      .from(accounts)
      .where(
        and(
          eq(accounts.id, fromAccountId),
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId)
        )
      )
      .limit(1),
    db
      .select({ name: accounts.name })
      .from(accounts)
      .where(
        and(
          eq(accounts.id, toAccountId),
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId)
        )
      )
      .limit(1),
  ]);

  if (fromAccount.length === 0 || toAccount.length === 0) {
    return null;
  }

  return {
    fromAccountName: fromAccount[0].name,
    toAccountName: toAccount[0].name,
  };
}

// ---------------------------------------------------------------------------
// from transfer-delete-execution.ts
// ---------------------------------------------------------------------------
async function deleteLegacyTransferAndRevertBalances({
  transferId,
  userId,
  householdId,
  transferData,
}: {
  transferId: string;
  userId: string;
  householdId: string;
  transferData: typeof transfers.$inferSelect;
}): Promise<void> {
  await runInDatabaseTransaction(async (tx) => {
    await tx
      .delete(transfers)
      .where(
        and(
          eq(transfers.id, transferId),
          eq(transfers.userId, userId),
          eq(transfers.householdId, householdId)
        )
      );

    if (transferData.fromTransactionId) {
      await tx
        .delete(transactions)
        .where(
          and(
            eq(transactions.id, transferData.fromTransactionId),
            eq(transactions.userId, userId),
            eq(transactions.householdId, householdId)
          )
        );
    }

    if (transferData.toTransactionId) {
      await tx
        .delete(transactions)
        .where(
          and(
            eq(transactions.id, transferData.toTransactionId),
            eq(transactions.userId, userId),
            eq(transactions.householdId, householdId)
          )
        );
    }

    const [fromAccount, toAccount] = await Promise.all([
      tx
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.id, transferData.fromAccountId),
            eq(accounts.userId, userId),
            eq(accounts.householdId, householdId)
          )
        )
        .limit(1),
      tx
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.id, transferData.toAccountId),
            eq(accounts.userId, userId),
            eq(accounts.householdId, householdId)
          )
        )
        .limit(1),
    ]);

    if (fromAccount.length > 0) {
      const transferAmountCents = getTransferAmountCents(transferData);
      const transferFeesCents = getTransferFeesCents(transferData);
      const totalDebitCents = transferAmountCents + transferFeesCents;
      const newFromBalanceCents = getAccountBalanceCents(fromAccount[0]) + totalDebitCents;

      await updateScopedAccountBalance(tx, {
        accountId: transferData.fromAccountId,
        userId,
        householdId,
        balanceCents: newFromBalanceCents,
      });
    }

    if (toAccount.length > 0) {
      const transferAmountCents = getTransferAmountCents(transferData);
      const newToBalanceCents = getAccountBalanceCents(toAccount[0]) - transferAmountCents;

      await updateScopedAccountBalance(tx, {
        accountId: transferData.toAccountId,
        userId,
        householdId,
        balanceCents: newToBalanceCents,
      });
    }
  });
}

// ---------------------------------------------------------------------------
// from transfers-id-execution.ts
// ---------------------------------------------------------------------------
function buildTransferNotFoundResponse(): Response {
  return Response.json({ error: 'Transfer not found' }, { status: 404 });
}

function buildTransferSuccessResponse(message = 'Transfer updated successfully'): Response {
  return Response.json({ message });
}

async function executeTransferUpdateById({
  transferId,
  userId,
  householdId,
  transferData,
  description,
  notes,
}: {
  transferId: string;
  userId: string;
  householdId: string;
  transferData: {
    fromTransactionId?: string | null;
    toTransactionId?: string | null;
  };
  description?: string;
  notes?: string;
}): Promise<void> {
  const updateData: Partial<typeof transfers.$inferInsert> = {};
  if (description !== undefined) updateData.description = description;
  if (notes !== undefined) updateData.notes = notes;

  const canonicalAnchorTransactionId = transferData.fromTransactionId || transferData.toTransactionId;

  if (canonicalAnchorTransactionId) {
    try {
      await updateCanonicalTransferPairByTransactionId({
        userId,
        householdId,
        transactionId: canonicalAnchorTransactionId,
        description,
        notes,
      });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (!message.includes('not found')) {
        throw error;
      }
    }
  }

  await db
    .update(transfers)
    .set(updateData)
    .where(
      and(eq(transfers.id, transferId), eq(transfers.userId, userId), eq(transfers.householdId, householdId))
    );
}

async function executeTransferDeleteById({
  transferId,
  userId,
  householdId,
  transferData,
}: {
  transferId: string;
  userId: string;
  householdId: string;
  transferData: typeof transfers.$inferSelect;
}): Promise<void> {
  const canonicalAnchorTransactionId = transferData.fromTransactionId || transferData.toTransactionId;

  if (canonicalAnchorTransactionId) {
    try {
      await deleteCanonicalTransferPairByTransactionId({
        userId,
        householdId,
        transactionId: canonicalAnchorTransactionId,
      });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (!message.includes('not found')) {
        throw error;
      }
    }
  }

  await deleteLegacyTransferAndRevertBalances({
    transferId,
    userId,
    householdId,
    transferData,
  });
}

// ---------------------------------------------------------------------------
// from transfers-id-route-context.ts
// ---------------------------------------------------------------------------
async function loadTransferIdRouteContext({
  request,
  transferId,
}: {
  request: Request;
  transferId: string;
}): Promise<{
  userId: string;
  householdId: string;
  transfer: Awaited<ReturnType<typeof getTransferForSelectedEntity>>;
}> {
  const { userId } = await requireAuth();
  const { householdId } = await getAndVerifyHousehold(request, userId);
  const selectedEntity = await resolveAndRequireEntity(userId, householdId, request);

  const transfer = await getTransferForSelectedEntity({
    transferId,
    userId,
    householdId,
    selectedEntityId: selectedEntity.id,
    selectedEntityIsDefault: selectedEntity.isDefault,
  });

  return { userId, householdId, transfer };
}

// ---------------------------------------------------------------------------
// from transfers-id-route-handlers.ts
// ---------------------------------------------------------------------------
export const dynamic = 'force-dynamic';

/**
 * GET /api/transfers/[id]
 * Get a specific transfer by ID
 */
export async function handleGetTransferById(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { userId, householdId, transfer } = await loadTransferIdRouteContext({
      request,
      transferId: id,
    });
    if (!transfer) {
      return buildTransferNotFoundResponse();
    }

    const accountNames = await getTransferAccountNames({
      userId,
      householdId,
      fromAccountId: transfer.fromAccountId,
      toAccountId: transfer.toAccountId,
    });
    if (!accountNames) {
      return Response.json(
        { error: 'Transfer not found' },
        { status: 404 }
      );
    }

    return Response.json({
      ...transfer,
      fromAccountName: accountNames.fromAccountName,
      toAccountName: accountNames.toAccountName,
    });
  } catch (error) {
    return handleRouteError(error, {
      defaultError: 'Failed to fetch transfer',
      logLabel: 'Error fetching transfer:',
    });
  }
}

/**
 * PUT /api/transfers/[id]
 * Update a transfer (only pending transfers can be updated)
 * Body: { description, notes }
 */
export async function handleUpdateTransferById(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { userId, householdId, transfer } = await loadTransferIdRouteContext({
      request,
      transferId: id,
    });
    if (!transfer) {
      return buildTransferNotFoundResponse();
    }

    const body = await request.json();
    const { description, notes } = body;
    if (description === undefined && notes === undefined) {
      return Response.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }
    await executeTransferUpdateById({
      transferId: id,
      userId,
      householdId,
      transferData: transfer,
      description,
      notes,
    });
    return buildTransferSuccessResponse('Transfer updated successfully');
  } catch (error) {
    return handleRouteError(error, {
      defaultError: 'Failed to update transfer',
      logLabel: 'Error updating transfer:',
    });
  }
}

/**
 * DELETE /api/transfers/[id]
 * Delete a transfer and revert account balances
 * Only pending transfers can be deleted
 */
export async function handleDeleteTransferById(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { userId, householdId, transfer } = await loadTransferIdRouteContext({
      request,
      transferId: id,
    });
    if (!transfer) {
      return buildTransferNotFoundResponse();
    }
    await executeTransferDeleteById({
      transferId: id,
      userId,
      householdId,
      transferData: transfer,
    });
    return buildTransferSuccessResponse('Transfer deleted successfully');
  } catch (error) {
    return handleRouteError(error, {
      defaultError: 'Failed to delete transfer',
      logLabel: 'Error deleting transfer:',
    });
  }
}
