import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  billOccurrences,
  billPaymentEvents,
  debtPayments,
  debts,
  savingsGoalContributions,
  savingsGoals,
} from '@/lib/db/schema';

type ReversalTx = typeof db;

/**
 * Reverse every money side effect a transaction applied when it was created —
 * linked debt payment(s), savings-goal contribution(s), and bill payment(s) —
 * so that deleting (or re-linking during an edit of) the funding transaction
 * leaves debts, goals, and bills consistent (audit findings C-LIFE-1/2/3,
 * H-BILL-1). MUST be called inside the same transaction as the delete so the
 * reversal is atomic with it.
 *
 * Milestones intentionally stay achieved (matching the existing goal-revert
 * convention); this only restores the numeric balances/paid amounts and removes
 * the now-orphaned payment/contribution rows.
 */
export async function reverseTransactionSideEffects(
  tx: ReversalTx,
  {
    transactionId,
    userId,
    householdId,
  }: {
    transactionId: string;
    userId: string;
    householdId: string;
  }
): Promise<void> {
  await reverseDebtPayments(tx, { transactionId, userId, householdId });
  await reverseGoalContributions(tx, { transactionId, userId, householdId });
  await reverseBillPayments(tx, { transactionId, householdId });
}

async function reverseDebtPayments(
  tx: ReversalTx,
  { transactionId, userId, householdId }: { transactionId: string; userId: string; householdId: string }
): Promise<void> {
  const payments = await tx
    .select()
    .from(debtPayments)
    .where(
      and(
        eq(debtPayments.transactionId, transactionId),
        eq(debtPayments.userId, userId),
        eq(debtPayments.householdId, householdId)
      )
    );

  for (const payment of payments) {
    // Only the principal portion reduced the debt balance; restore exactly that.
    const principal = payment.principalAmount ?? 0;
    const [debt] = await tx
      .select({ remainingBalance: debts.remainingBalance })
      .from(debts)
      .where(and(eq(debts.id, payment.debtId), eq(debts.householdId, householdId)))
      .limit(1);

    if (debt) {
      const restoredBalance = (debt.remainingBalance ?? 0) + principal;
      await tx
        .update(debts)
        .set({
          remainingBalance: restoredBalance,
          // Restoring balance means the debt is no longer paid off.
          status: restoredBalance > 0 ? 'active' : 'paid_off',
          updatedAt: new Date().toISOString(),
        })
        .where(and(eq(debts.id, payment.debtId), eq(debts.householdId, householdId)));
    }

    await tx.delete(debtPayments).where(eq(debtPayments.id, payment.id));
  }
}

async function reverseGoalContributions(
  tx: ReversalTx,
  { transactionId, userId, householdId }: { transactionId: string; userId: string; householdId: string }
): Promise<void> {
  const contributions = await tx
    .select()
    .from(savingsGoalContributions)
    .where(
      and(
        eq(savingsGoalContributions.transactionId, transactionId),
        eq(savingsGoalContributions.userId, userId),
        eq(savingsGoalContributions.householdId, householdId)
      )
    );

  for (const contribution of contributions) {
    const [goal] = await tx
      .select({ currentAmount: savingsGoals.currentAmount })
      .from(savingsGoals)
      .where(and(eq(savingsGoals.id, contribution.goalId), eq(savingsGoals.householdId, householdId)))
      .limit(1);

    if (goal) {
      const nextAmount = Math.max(0, (goal.currentAmount ?? 0) - (contribution.amount ?? 0));
      await tx
        .update(savingsGoals)
        .set({ currentAmount: nextAmount, updatedAt: new Date().toISOString() })
        .where(and(eq(savingsGoals.id, contribution.goalId), eq(savingsGoals.householdId, householdId)));
    }

    await tx
      .delete(savingsGoalContributions)
      .where(eq(savingsGoalContributions.id, contribution.id));
  }
}

async function reverseBillPayments(
  tx: ReversalTx,
  { transactionId, householdId }: { transactionId: string; householdId: string }
): Promise<void> {
  const events = await tx
    .select()
    .from(billPaymentEvents)
    .where(
      and(
        eq(billPaymentEvents.transactionId, transactionId),
        eq(billPaymentEvents.householdId, householdId)
      )
    );

  for (const event of events) {
    const [occurrence] = await tx
      .select()
      .from(billOccurrences)
      .where(
        and(
          eq(billOccurrences.id, event.occurrenceId),
          eq(billOccurrences.householdId, householdId)
        )
      )
      .limit(1);

    if (occurrence) {
      const amountPaidCents = Math.max(0, occurrence.amountPaidCents - event.amountCents);
      const amountRemainingCents = Math.max(0, occurrence.amountDueCents - amountPaidCents);
      const status = computeOccurrenceStatus({
        amountPaidCents,
        amountDueCents: occurrence.amountDueCents,
      });

      await tx
        .update(billOccurrences)
        .set({
          amountPaidCents,
          amountRemainingCents,
          status,
          // Clear the paid marker if nothing is paid anymore.
          paidDate: amountPaidCents === 0 ? null : occurrence.paidDate,
          lastTransactionId:
            occurrence.lastTransactionId === transactionId ? null : occurrence.lastTransactionId,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(billOccurrences.id, event.occurrenceId),
            eq(billOccurrences.householdId, householdId)
          )
        );
    }

    await tx.delete(billPaymentEvents).where(eq(billPaymentEvents.id, event.id));
  }
}

function computeOccurrenceStatus({
  amountPaidCents,
  amountDueCents,
}: {
  amountPaidCents: number;
  amountDueCents: number;
}): 'unpaid' | 'partial' | 'paid' | 'overpaid' {
  if (amountPaidCents <= 0) return 'unpaid';
  if (amountPaidCents < amountDueCents) return 'partial';
  if (amountPaidCents === amountDueCents) return 'paid';
  return 'overpaid';
}
