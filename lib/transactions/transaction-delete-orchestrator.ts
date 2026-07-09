/**
 * Transaction DELETE flow: routes transfer legs to the canonical pair delete,
 * otherwise deletes the single movement (reversing debt/goal/bill side
 * effects) and writes the deletion audit entry.
 *
 * Consolidated from 3 shim files (audit / execution / orchestrator) during the
 * post-audit cleanup; behavior is unchanged.
 */
import { and, eq } from 'drizzle-orm';
import { createTransactionSnapshot, logTransactionAudit } from '@/lib/transactions/audit-logger';
import { db } from '@/lib/db';
import {
  accounts,
  betterAuthUser,
  billTemplates,
  budgetCategories,
  debts,
  merchants,
  transactions,
  salesTaxTransactions,
  transactionSplits,
} from '@/lib/db/schema';
import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import {
  applyAccountBalanceDelta,
  computeBalanceDeltaCents,
  type MovementTransactionType,
  getTransactionAmountCents,
} from '@/lib/transactions/money-movement-service';
import { reverseTransactionSideEffects } from '@/lib/transactions/transaction-side-effect-reversal';
import { deleteCanonicalTransferPairByTransactionId } from '@/lib/transactions/transfer-service';

// ---------------------------------------------------------------------------
// from transaction-delete-audit.ts
// ---------------------------------------------------------------------------
interface LogTransactionDeletionAuditParams {
  transactionId: string;
  userId: string;
  householdId: string;
  transaction: typeof transactions.$inferSelect;
}

async function logTransactionDeletionAudit({
  transactionId,
  userId,
  householdId,
  transaction,
}: LogTransactionDeletionAuditParams): Promise<void> {
  try {
    const [accountData, categoryData, merchantData, billData, debtData, userRecord] = await Promise.all([
      db
        .select({ name: accounts.name })
        .from(accounts)
        .where(
          and(
            eq(accounts.id, transaction.accountId),
            eq(accounts.userId, userId),
            eq(accounts.householdId, householdId)
          )
        )
        .limit(1),
      transaction.categoryId
        ? db
            .select({ name: budgetCategories.name })
            .from(budgetCategories)
            .where(
              and(
                eq(budgetCategories.id, transaction.categoryId),
                eq(budgetCategories.userId, userId),
                eq(budgetCategories.householdId, householdId)
              )
            )
            .limit(1)
        : Promise.resolve([]),
      transaction.merchantId
        ? db
            .select({ name: merchants.name })
            .from(merchants)
            .where(
              and(
                eq(merchants.id, transaction.merchantId),
                eq(merchants.userId, userId),
                eq(merchants.householdId, householdId)
              )
            )
            .limit(1)
        : Promise.resolve([]),
      transaction.billId
        ? db
            .select({ name: billTemplates.name })
            .from(billTemplates)
            .where(
              and(
                eq(billTemplates.id, transaction.billId),
                eq(billTemplates.createdByUserId, userId),
                eq(billTemplates.householdId, householdId)
              )
            )
            .limit(1)
        : Promise.resolve([]),
      transaction.debtId
        ? db
            .select({ name: debts.name })
            .from(debts)
            .where(
              and(
                eq(debts.id, transaction.debtId),
                eq(debts.userId, userId),
                eq(debts.householdId, householdId)
              )
            )
            .limit(1)
        : Promise.resolve([]),
      db.select({ name: betterAuthUser.name }).from(betterAuthUser).where(eq(betterAuthUser.id, userId)).limit(1),
    ]);

    const snapshot = createTransactionSnapshot(transaction, {
      accountName: accountData[0]?.name,
      categoryName: categoryData[0]?.name,
      merchantName: merchantData[0]?.name,
      billName: billData[0]?.name,
      debtName: debtData[0]?.name,
    });

    await logTransactionAudit({
      transactionId,
      userId,
      householdId,
      userName: userRecord[0]?.name || 'Unknown User',
      actionType: 'deleted',
      snapshot,
    });
  } catch (error) {
    console.error('Failed to log transaction deletion audit:', error);
  }
}

// ---------------------------------------------------------------------------
// from transaction-delete-execution.ts
// ---------------------------------------------------------------------------
interface DeleteNonTransferTransactionParams {
  transactionId: string;
  userId: string;
  householdId: string;
  transaction: typeof transactions.$inferSelect;
  transactionAmountCents: number;
}

async function deleteNonTransferTransaction({
  transactionId,
  userId,
  householdId,
  transaction,
  transactionAmountCents,
}: DeleteNonTransferTransactionParams): Promise<void> {
  await runInDatabaseTransaction(async (tx) => {
    if (transaction.isSplit) {
      await tx
        .delete(transactionSplits)
        .where(
          and(
            eq(transactionSplits.userId, userId),
            eq(transactionSplits.householdId, householdId),
            eq(transactionSplits.transactionId, transactionId)
          )
        );
    }

    const account = await tx
      .select({ id: accounts.id, type: accounts.type })
      .from(accounts)
      .where(eq(accounts.id, transaction.accountId))
      .limit(1);

    if (account.length > 0) {
      // Reverse the transaction's original balance effect (negate the delta it
      // applied). Liability-aware and transfer_out-aware (C-MATH-1, H-TXN-3).
      const reversalDelta = -computeBalanceDeltaCents({
        accountType: account[0].type,
        transactionType: transaction.type as MovementTransactionType,
        amountCents: transactionAmountCents,
      });
      await applyAccountBalanceDelta(tx, {
        accountId: transaction.accountId,
        deltaCents: reversalDelta,
      });
    }

    await tx
      .delete(salesTaxTransactions)
      .where(eq(salesTaxTransactions.transactionId, transactionId));

    // Reverse linked debt payment(s), goal contribution(s), and bill payment(s)
    // inside the same transaction, so deleting the funding transaction can't leave
    // a debt reduced, a goal inflated, or a bill marked paid (C-LIFE-1/2/3).
    await reverseTransactionSideEffects(tx, { transactionId, userId, householdId });

    await tx
      .delete(transactions)
      .where(
        and(
          eq(transactions.id, transactionId),
          eq(transactions.userId, userId),
          eq(transactions.householdId, householdId)
        )
      );
  });
}

// ---------------------------------------------------------------------------
// from transaction-delete-orchestrator.ts
// ---------------------------------------------------------------------------
export async function executeTransactionDeleteOrchestration({
  transactionId,
  userId,
  householdId,
  transaction,
}: {
  transactionId: string;
  userId: string;
  householdId: string;
  transaction: typeof transactions.$inferSelect;
}): Promise<Response> {
  const transactionAmountCents = getTransactionAmountCents(transaction);

  await logTransactionDeletionAudit({
    transactionId,
    userId,
    householdId,
    transaction,
  });

  if (transaction.type === 'transfer_out' || transaction.type === 'transfer_in') {
    await deleteCanonicalTransferPairByTransactionId({
      userId,
      householdId,
      transactionId,
    });
    return Response.json({ message: 'Transaction deleted successfully' }, { status: 200 });
  }

  await deleteNonTransferTransaction({
    transactionId,
    userId,
    householdId,
    transaction,
    transactionAmountCents,
  });

  return Response.json({ message: 'Transaction deleted successfully' }, { status: 200 });
}
