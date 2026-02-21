import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { resolveAndRequireEntity } from '@/lib/api/entity-auth';
import { db } from '@/lib/db';
import { transfers, accounts, transactions } from '@/lib/db/schema';
import { eq, and, isNull, or } from 'drizzle-orm';
import { handleRouteError } from '@/lib/api/route-helpers';
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

export const dynamic = 'force-dynamic';

async function transferVisibleInSelectedEntity({
  userId,
  householdId,
  selectedEntityId,
  selectedEntityIsDefault,
  fromAccountId,
  toAccountId,
}: {
  userId: string;
  householdId: string;
  selectedEntityId: string;
  selectedEntityIsDefault: boolean;
  fromAccountId: string;
  toAccountId: string;
}) {
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
        or(eq(accounts.id, fromAccountId), eq(accounts.id, toAccountId))
      )
    );

  return visibleAccounts.length > 0;
}

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
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);
    const selectedEntity = await resolveAndRequireEntity(userId, householdId, request);

    const transfer = await db
      .select()
      .from(transfers)
      .where(
        and(
          eq(transfers.id, id),
          eq(transfers.userId, userId),
          eq(transfers.householdId, householdId)
        )
      )
      .limit(1);

    if (transfer.length === 0) {
      return Response.json(
        { error: 'Transfer not found' },
        { status: 404 }
      );
    }
    const visible = await transferVisibleInSelectedEntity({
      userId,
      householdId,
      selectedEntityId: selectedEntity.id,
      selectedEntityIsDefault: selectedEntity.isDefault,
      fromAccountId: transfer[0].fromAccountId,
      toAccountId: transfer[0].toAccountId,
    });
    if (!visible) {
      return Response.json({ error: 'Transfer not found' }, { status: 404 });
    }

    // Enrich with account names
    const [fromAccount, toAccount] = await Promise.all([
      db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.id, transfer[0].fromAccountId),
            eq(accounts.userId, userId),
            eq(accounts.householdId, householdId)
          )
        )
        .limit(1),
      db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.id, transfer[0].toAccountId),
            eq(accounts.userId, userId),
            eq(accounts.householdId, householdId)
          )
        )
        .limit(1),
    ]);

    if (fromAccount.length === 0 || toAccount.length === 0) {
      return Response.json(
        { error: 'Transfer not found' },
        { status: 404 }
      );
    }

    return Response.json({
      ...transfer[0],
      fromAccountName: fromAccount[0]?.name,
      toAccountName: toAccount[0]?.name,
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
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);
    const selectedEntity = await resolveAndRequireEntity(userId, householdId, request);

    const transfer = await db
      .select()
      .from(transfers)
      .where(
        and(
          eq(transfers.id, id),
          eq(transfers.userId, userId),
          eq(transfers.householdId, householdId)
        )
      )
      .limit(1);

    if (transfer.length === 0) {
      return Response.json(
        { error: 'Transfer not found' },
        { status: 404 }
      );
    }
    const visible = await transferVisibleInSelectedEntity({
      userId,
      householdId,
      selectedEntityId: selectedEntity.id,
      selectedEntityIsDefault: selectedEntity.isDefault,
      fromAccountId: transfer[0].fromAccountId,
      toAccountId: transfer[0].toAccountId,
    });
    if (!visible) {
      return Response.json({ error: 'Transfer not found' }, { status: 404 });
    }

    // Only allow updating metadata like description and notes
    const body = await request.json();
    const { description, notes } = body;

    const updateData: Partial<typeof transfers.$inferInsert> = {};
    if (description !== undefined) updateData.description = description;
    if (notes !== undefined) updateData.notes = notes;

    if (Object.keys(updateData).length === 0) {
      return Response.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    const transferData = transfer[0];
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
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (!message.includes('not found')) {
          throw error;
        }

        await db
          .update(transfers)
          .set(updateData)
          .where(
            and(
              eq(transfers.id, id),
              eq(transfers.userId, userId),
              eq(transfers.householdId, householdId)
            )
          );
      }
    } else {
      await db
        .update(transfers)
        .set(updateData)
        .where(
          and(
            eq(transfers.id, id),
            eq(transfers.userId, userId),
            eq(transfers.householdId, householdId)
          )
        );
    }

    return Response.json({
      message: 'Transfer updated successfully',
    });
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
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);
    const selectedEntity = await resolveAndRequireEntity(userId, householdId, request);

    const transfer = await db
      .select()
      .from(transfers)
      .where(
        and(
          eq(transfers.id, id),
          eq(transfers.userId, userId),
          eq(transfers.householdId, householdId)
        )
      )
      .limit(1);

    if (transfer.length === 0) {
      return Response.json(
        { error: 'Transfer not found' },
        { status: 404 }
      );
    }
    const visible = await transferVisibleInSelectedEntity({
      userId,
      householdId,
      selectedEntityId: selectedEntity.id,
      selectedEntityIsDefault: selectedEntity.isDefault,
      fromAccountId: transfer[0].fromAccountId,
      toAccountId: transfer[0].toAccountId,
    });
    if (!visible) {
      return Response.json({ error: 'Transfer not found' }, { status: 404 });
    }

    const transferData = transfer[0];
    const canonicalAnchorTransactionId = transferData.fromTransactionId || transferData.toTransactionId;

    if (canonicalAnchorTransactionId) {
      try {
        await deleteCanonicalTransferPairByTransactionId({
          userId,
          householdId,
          transactionId: canonicalAnchorTransactionId,
        });

        return Response.json({
          message: 'Transfer deleted successfully',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (!message.includes('not found')) {
          throw error;
        }
      }
    }

    // Start transaction to delete transfer and revert balances
    await runInDatabaseTransaction(async (tx) => {
      // Delete the transfer
      await tx
        .delete(transfers)
        .where(
          and(
            eq(transfers.id, id),
            eq(transfers.userId, userId),
            eq(transfers.householdId, householdId)
          )
        );

      // Delete associated transactions if they exist
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

      // Revert account balances
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

    return Response.json({
      message: 'Transfer deleted successfully',
    });
  } catch (error) {
    return handleRouteError(error, {
      defaultError: 'Failed to delete transfer',
      logLabel: 'Error deleting transfer:',
    });
  }
}
