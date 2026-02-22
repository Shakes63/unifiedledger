import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { transfers } from '@/lib/db/schema';
import {
  deleteCanonicalTransferPairByTransactionId,
  updateCanonicalTransferPairByTransactionId,
} from '@/lib/transactions/transfer-service';
import { deleteLegacyTransferAndRevertBalances } from '@/lib/transfers/transfer-delete-execution';

export function buildTransferNotFoundResponse(): Response {
  return Response.json({ error: 'Transfer not found' }, { status: 404 });
}

export function buildTransferSuccessResponse(message = 'Transfer updated successfully'): Response {
  return Response.json({ message });
}

export async function executeTransferUpdateById({
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

export async function executeTransferDeleteById({
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
