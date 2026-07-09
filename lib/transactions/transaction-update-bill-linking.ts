/**
 * Bill re-linking for the transaction UPDATE flow.
 *
 * When an expense edit changes fields that affect bill matching (amount, date,
 * description, category) — or the client passes an explicit billInstanceId —
 * the existing link is unwound (H-BILL-2 symmetric unlink) and matching reruns.
 *
 * Consolidated from 4 single-use shim files (matches / execution / flow / head)
 * during the post-audit cleanup; behavior is unchanged.
 * transaction-update-bill-linking-helpers stays separate: the reversal
 * integration test imports it directly.
 */
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { transactions } from '@/lib/db/schema';
import { findMatchingBillInstance } from '@/lib/bills/bill-matching-helpers';
import {
  findCategoryPendingBillMatch,
  findScopedBillById,
  findScopedPendingBillInstanceById,
} from '@/lib/transactions/transaction-create-bill-linking';
import {
  processUpdatedBillPayment,
  shouldRematchUpdatedExpenseBill,
  unlinkExistingBillInstance,
} from '@/lib/transactions/transaction-update-bill-linking-helpers';

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

interface UpdatedBillLinkMatch {
  templateId: string;
  templateName: string;
  occurrenceId: string;
  notes: string;
}

async function matchUpdatedTransactionByExplicitBillInstance({
  billInstanceId,
  userId,
  householdId,
}: {
  billInstanceId?: string;
  userId: string;
  householdId: string;
}): Promise<UpdatedBillLinkMatch | null> {
  if (!billInstanceId) {
    return null;
  }

  const instance = await findScopedPendingBillInstanceById({
    billInstanceId,
    userId,
    householdId,
  });

  if (!instance) {
    return null;
  }

  return {
    templateId: instance.bill.id,
    templateName: instance.bill.name,
    occurrenceId: instance.instance.id,
    notes: `Bill payment update: ${instance.bill.name}`,
  };
}

async function matchUpdatedTransactionByGeneralHeuristics({
  transactionId,
  userId,
  householdId,
  transactionType,
  newDescription,
  newAmount,
  newDate,
  newCategoryId,
}: {
  transactionId: string;
  userId: string;
  householdId: string;
  transactionType: typeof transactions.$inferSelect['type'];
  newDescription: string;
  newAmount: number;
  newDate: string;
  newCategoryId: string | null;
}): Promise<UpdatedBillLinkMatch | null> {
  if (!transactionType) {
    return null;
  }

  const billMatch = await findMatchingBillInstance(
    {
      id: transactionId,
      description: newDescription,
      amount: newAmount,
      date: newDate,
      type: transactionType,
      categoryId: newCategoryId,
    },
    userId,
    householdId,
    70
  );

  if (!billMatch) {
    return null;
  }

  const bill = await findScopedBillById({
    billId: billMatch.billId,
    userId,
    householdId,
  });
  if (!bill) {
    return null;
  }

  return {
    templateId: bill.id,
    templateName: bill.name,
    occurrenceId: billMatch.instanceId,
    notes: `Auto-matched bill update: ${bill.name}`,
  };
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

async function executeMatchedBillLink({
  match,
  transactionId,
  userId,
  householdId,
  newAccountId,
  newAmount,
  newDate,
}: {
  match: UpdatedBillLinkMatch;
  transactionId: string;
  userId: string;
  householdId: string;
  newAccountId: string;
  newAmount: number;
  newDate: string;
}): Promise<void> {
  await processUpdatedBillPayment({
    templateId: match.templateId,
    occurrenceId: match.occurrenceId,
    transactionId,
    paymentAmount: newAmount,
    paymentDate: newDate,
    userId,
    householdId,
    linkedAccountId: newAccountId,
    notes: match.notes,
  });
}

async function clearTransactionBillLink(transactionId: string): Promise<void> {
  await db
    .update(transactions)
    .set({
      billId: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(transactions.id, transactionId));
}

async function matchAndExecuteGeneralUpdatedBillLink({
  transactionId,
  userId,
  householdId,
  transactionType,
  newDescription,
  newAmount,
  newDate,
  newCategoryId,
  newAccountId,
}: {
  transactionId: string;
  userId: string;
  householdId: string;
  transactionType: typeof transactions.$inferSelect['type'];
  newDescription: string;
  newAmount: number;
  newDate: string;
  newCategoryId: string | null;
  newAccountId: string;
}): Promise<boolean> {
  const generalMatch = await matchUpdatedTransactionByGeneralHeuristics({
    transactionId,
    userId,
    householdId,
    transactionType,
    newDescription,
    newAmount,
    newDate,
    newCategoryId,
  });

  if (generalMatch) {
    await executeMatchedBillLink({
      match: generalMatch,
      transactionId,
      userId,
      householdId,
      newAccountId,
      newAmount,
      newDate,
    });
    return true;
  }

  return false;
}

/**
 * Category-only fallback for the UPDATE flow. NOT wired into
 * autoLinkUpdatedExpenseBill (audit finding C-BILL-2 — it marked unrelated
 * bills paid with no amount/name/date check). Kept exported for the Phase 3
 * gated reintroduction.
 */
export async function matchAndExecuteCategoryFallbackUpdatedBillLink({
  transactionId,
  userId,
  householdId,
  newAmount,
  newDate,
  newCategoryId,
  newAccountId,
}: {
  transactionId: string;
  userId: string;
  householdId: string;
  newAmount: number;
  newDate: string;
  newCategoryId: string;
  newAccountId: string;
}): Promise<boolean> {
  const categoryMatch = await findCategoryPendingBillMatch({
    userId,
    householdId,
    categoryId: newCategoryId,
  });
  if (!categoryMatch) {
    return false;
  }

  await executeMatchedBillLink({
    match: {
      templateId: categoryMatch.bill.id,
      templateName: categoryMatch.bill.name,
      occurrenceId: categoryMatch.instance.id,
      notes: `Category-matched bill update: ${categoryMatch.bill.name}`,
    },
    transactionId,
    userId,
    householdId,
    newAccountId,
    newAmount,
    newDate,
  });

  return true;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function autoLinkUpdatedExpenseBill({
  transactionId,
  userId,
  householdId,
  transaction,
  billInstanceId,
  amountWasProvided,
  newAccountId,
  newAmount,
  newDate,
  newDescription,
  newCategoryId,
}: {
  transactionId: string;
  userId: string;
  householdId: string;
  transaction: typeof transactions.$inferSelect;
  billInstanceId?: string;
  amountWasProvided: boolean;
  newAccountId: string;
  newAmount: number;
  newDate: string;
  newDescription: string;
  newCategoryId: string | null;
}): Promise<void> {
  try {
    if (transaction.type !== 'expense') {
      return;
    }

    const explicitMatch = await matchUpdatedTransactionByExplicitBillInstance({
      billInstanceId,
      userId,
      householdId,
    });
    if (explicitMatch) {
      if (transaction.billId) {
        await unlinkExistingBillInstance({
          transactionId,
          householdId,
        });
      }

      await executeMatchedBillLink({
        match: explicitMatch,
        transactionId,
        userId,
        householdId,
        newAccountId,
        newAmount,
        newDate,
      });
      return;
    }

    const shouldRematch = shouldRematchUpdatedExpenseBill({
      amountWasProvided,
      newAmount,
      newDate,
      newDescription,
      newCategoryId,
      transaction,
    });

    if (!shouldRematch) {
      return;
    }

    if (transaction.billId) {
      await unlinkExistingBillInstance({
        transactionId,
        householdId,
      });
      await clearTransactionBillLink(transactionId);
    }

    await matchAndExecuteGeneralUpdatedBillLink({
      transactionId,
      userId,
      householdId,
      transactionType: transaction.type,
      newDescription,
      newAmount,
      newDate,
      newCategoryId,
      newAccountId,
    });
    // Category-only fallback intentionally omitted here (audit finding C-BILL-2):
    // editing a transaction's category previously marked an unrelated bill paid
    // with no amount/name/date check. Phase 3 will reintroduce a gated version.
  } catch (error) {
    console.error('Error auto-linking bill on update:', error);
  }
}
