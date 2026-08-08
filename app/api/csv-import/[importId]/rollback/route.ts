import { requireAuth } from '@/lib/auth-helpers';
import { requireHouseholdAuth } from '@/lib/api/household-auth';
import { getHouseholdIdFromRequest } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import { importHistory, importStaging, transactions, transfers } from '@/lib/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import {
  applyAccountBalanceDelta,
  type MovementTransactionType,
} from '@/lib/transactions/money-movement-service';
import { computeBalanceDeltaCents } from '@/lib/transactions/money-movement-fields';
import { reverseTransactionSideEffects } from '@/lib/transactions/transaction-side-effect-reversal';
import { accounts } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

/**
 * POST /api/csv-import/[importId]/rollback
 *
 * Undo a confirmed CSV import (bug-hunt findings A2/M5).
 *
 * The schema has always declared `status: 'rolled_back'` and a `rolledBackAt`
 * column, but nothing ever wrote them — there was no rollback route, no delete
 * route, and no way back. Combined with the sign and direction bugs the same
 * hunt found, an import that silently corrupted balances was also permanent:
 * the only recourse was deleting the transactions one at a time by hand.
 *
 * This reverses, inside ONE transaction:
 *   - each imported transaction's balance delta (negated through the same
 *     computeBalanceDeltaCents used to apply it, so liability accounts stay
 *     positive-owed),
 *   - its side effects (goal contributions, debt payments) via the shared
 *     reversal layer,
 *   - any transfers rows that reference the imported legs,
 *   - the transactions themselves,
 *   - the staging rows, back to 'approved' so the import can be redone.
 *
 * KNOWN LIMITATION, reported in the response rather than hidden: rows imported
 * with the `link_existing` decision destructively re-typed a PRE-EXISTING
 * transaction and did not save its original type, category or merchant. Those
 * transactions are unlinked here (transfer fields cleared) but their original
 * type cannot be restored, because it was never recorded.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ importId: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const householdId = getHouseholdIdFromRequest(request);
    if (!householdId) {
      return Response.json({ error: 'Household ID is required' }, { status: 400 });
    }
    await requireHouseholdAuth(userId, householdId);

    const { importId } = await params;

    const [importRecord] = await db
      .select()
      .from(importHistory)
      .where(and(eq(importHistory.id, importId), eq(importHistory.userId, userId)))
      .limit(1);

    if (!importRecord) {
      return Response.json({ error: 'Import not found' }, { status: 404 });
    }
    if (importRecord.status === 'rolled_back') {
      return Response.json({ error: 'Import has already been rolled back' }, { status: 409 });
    }

    const importedTransactions = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.importHistoryId, importId),
          eq(transactions.householdId, householdId)
        )
      );

    const unlinkedExisting: string[] = [];

    const reversedCount = await runInDatabaseTransaction(async (tx) => {
      const importedIds = importedTransactions.map((t) => t.id);

      for (const imported of importedTransactions) {
        // Reverse the balance by NEGATING the same delta that applied it, so the
        // liability convention is handled identically in both directions.
        const [account] = await tx
          .select({ id: accounts.id, type: accounts.type })
          .from(accounts)
          .where(
            and(eq(accounts.id, imported.accountId), eq(accounts.householdId, householdId))
          )
          .limit(1);

        if (account) {
          await applyAccountBalanceDelta(tx, {
            accountId: account.id,
            deltaCents: -computeBalanceDeltaCents({
              accountType: account.type,
              transactionType: imported.type as MovementTransactionType,
              amountCents: imported.amountCents ?? 0,
            }),
            userId,
            householdId,
          });
        }

        // Goal contributions, debt payments and the rest.
        await reverseTransactionSideEffects(tx, {
          transactionId: imported.id,
          userId,
          householdId,
        });

        // A pre-existing transaction linked by `link_existing` is not ours to
        // delete — unlink it instead. Its original type was overwritten and
        // never saved, so it is reported back to the caller.
        if (imported.pairedTransactionId && !importedIds.includes(imported.pairedTransactionId)) {
          await tx
            .update(transactions)
            .set({
              transferId: null,
              transferGroupId: null,
              pairedTransactionId: null,
              transferSourceAccountId: null,
              transferDestinationAccountId: null,
              updatedAt: new Date().toISOString(),
            })
            .where(
              and(
                eq(transactions.id, imported.pairedTransactionId),
                eq(transactions.householdId, householdId)
              )
            );
          unlinkedExisting.push(imported.pairedTransactionId);
        }
      }

      if (importedIds.length > 0) {
        // transfers rows carry no importHistoryId, so they are found through the
        // legs they reference — otherwise a rollback would orphan them.
        await tx.delete(transfers).where(inArray(transfers.fromTransactionId, importedIds));
        await tx.delete(transfers).where(inArray(transfers.toTransactionId, importedIds));
        await tx.delete(transactions).where(inArray(transactions.id, importedIds));
      }

      // Staging returns to 'approved' so the file can be re-imported once the
      // mapping is corrected.
      await tx
        .update(importStaging)
        .set({ status: 'approved' })
        .where(eq(importStaging.importHistoryId, importId));

      await tx
        .update(importHistory)
        .set({
          status: 'rolled_back',
          rolledBackAt: new Date().toISOString(),
          rowsImported: 0,
        })
        .where(eq(importHistory.id, importId));

      return importedIds.length;
    });

    return Response.json({
      success: true,
      importId,
      transactionsRemoved: reversedCount,
      unlinkedExistingTransactions: unlinkedExisting,
      warning:
        unlinkedExisting.length > 0
          ? 'Some pre-existing transactions were linked by this import. They have been unlinked, but their original transaction type could not be restored because it was overwritten and not saved.'
          : undefined,
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error rolling back CSV import:', error);
    return Response.json({ error: 'Failed to roll back import' }, { status: 500 });
  }
}
