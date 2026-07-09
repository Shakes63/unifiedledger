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
import { buildDebtBalanceFields, getDebtRemainingCents } from '@/lib/debts/debt-money';
import { buildGoalCurrentFields, getGoalCurrentCents } from '@/lib/goals/goal-money';
import { fromMoneyCents, toMoneyCents } from '@/lib/utils/money-cents';
import { loadScopedDebt, persistLegacyDebtPayment } from '@/lib/transactions/payment-linkage-debt';
import { handleGoalContribution } from '@/lib/goals/contribution-handler';
import { processBillPayment } from '@/lib/bills/bill-payment-utils';

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

/**
 * Adjust a transaction's money side effects when its AMOUNT is edited
 * (audit finding C-LIFE-3, edit case): capture the linked debt payment(s),
 * goal contribution(s), and bill payment(s), reverse them, and re-apply each
 * scaled proportionally to the new amount. Correcting a $200 debt payment to
 * $20 previously fixed the account balance but left the debt reduced by $200.
 *
 * MUST run inside the same transaction as the amount update.
 */
export async function adjustTransactionSideEffectsForAmountChange(
  tx: ReversalTx,
  {
    transactionId,
    userId,
    householdId,
    oldAmountCents,
    newAmountCents,
  }: {
    transactionId: string;
    userId: string;
    householdId: string;
    oldAmountCents: number;
    newAmountCents: number;
  }
): Promise<void> {
  if (oldAmountCents === newAmountCents || oldAmountCents === 0) {
    return;
  }
  const ratio = Math.abs(newAmountCents) / Math.abs(oldAmountCents);

  // Capture the linked rows BEFORE reversal deletes them.
  const scope = { transactionId, userId, householdId };
  const [debtRows, goalRows, billRows] = await Promise.all([
    tx
      .select()
      .from(debtPayments)
      .where(
        and(
          eq(debtPayments.transactionId, transactionId),
          eq(debtPayments.userId, userId),
          eq(debtPayments.householdId, householdId)
        )
      ),
    tx
      .select()
      .from(savingsGoalContributions)
      .where(
        and(
          eq(savingsGoalContributions.transactionId, transactionId),
          eq(savingsGoalContributions.userId, userId),
          eq(savingsGoalContributions.householdId, householdId)
        )
      ),
    tx
      .select()
      .from(billPaymentEvents)
      .where(
        and(
          eq(billPaymentEvents.transactionId, transactionId),
          eq(billPaymentEvents.householdId, householdId)
        )
      ),
  ]);

  if (debtRows.length === 0 && goalRows.length === 0 && billRows.length === 0) {
    return;
  }

  await reverseTransactionSideEffects(tx, scope);

  const scaleCents = (cents: number | string | bigint | null, dollars: number | null): number => {
    const base =
      cents !== null && cents !== undefined ? Number(cents) : toMoneyCents(dollars ?? 0) ?? 0;
    return Math.round(base * ratio);
  };

  for (const payment of debtRows) {
    const newPaymentCents = scaleCents(payment.amountCents ?? null, payment.amount);
    if (newPaymentCents <= 0) continue;
    const currentDebt = await loadScopedDebt({
      dbClient: tx,
      debtId: payment.debtId,
      userId,
      householdId,
    });
    if (!currentDebt) continue;
    await persistLegacyDebtPayment({
      dbClient: tx,
      debtId: payment.debtId,
      userId,
      householdId,
      paymentAmount: fromMoneyCents(newPaymentCents) ?? 0,
      paymentDate: payment.paymentDate,
      transactionId,
      notes: payment.notes ?? 'Adjusted for edited transaction',
      currentDebt,
    });
  }

  for (const contribution of goalRows) {
    const newContributionCents = scaleCents(contribution.amountCents ?? null, contribution.amount);
    if (newContributionCents <= 0) continue;
    await handleGoalContribution(
      contribution.goalId,
      fromMoneyCents(newContributionCents) ?? 0,
      transactionId,
      userId,
      householdId
    );
  }

  for (const event of billRows) {
    const newEventCents = scaleCents(event.amountCents, null);
    if (newEventCents <= 0) continue;
    await processBillPayment({
      templateId: event.templateId,
      occurrenceId: event.occurrenceId,
      transactionId,
      paymentAmount: fromMoneyCents(newEventCents) ?? 0,
      paymentDate: event.paymentDate,
      userId,
      householdId,
      paymentMethod:
        event.paymentMethod === 'match' ? 'manual' : event.paymentMethod ?? 'manual',
      linkedAccountId: event.sourceAccountId ?? undefined,
      notes: event.notes ?? undefined,
    });
  }
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
    // Only the principal portion reduced the debt balance; restore exactly that,
    // in integer cents (H-DBG-10). Fall back to the float column for rows written
    // before the cents backfill.
    const principalCents =
      payment.principalCents !== null && payment.principalCents !== undefined
        ? Number(payment.principalCents)
        : toMoneyCents(payment.principalAmount ?? 0) ?? 0;

    const [debt] = await tx
      .select({
        remainingBalance: debts.remainingBalance,
        remainingBalanceCents: debts.remainingBalanceCents,
      })
      .from(debts)
      .where(and(eq(debts.id, payment.debtId), eq(debts.householdId, householdId)))
      .limit(1);

    if (debt) {
      const restoredCents = getDebtRemainingCents(debt) + principalCents;
      await tx
        .update(debts)
        .set({
          ...buildDebtBalanceFields(restoredCents),
          // Restoring balance means the debt is no longer paid off.
          status: restoredCents > 0 ? 'active' : 'paid_off',
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
      .select({
        currentAmount: savingsGoals.currentAmount,
        currentAmountCents: savingsGoals.currentAmountCents,
      })
      .from(savingsGoals)
      .where(and(eq(savingsGoals.id, contribution.goalId), eq(savingsGoals.householdId, householdId)))
      .limit(1);

    if (goal) {
      const revertCents =
        contribution.amountCents !== null && contribution.amountCents !== undefined
          ? Number(contribution.amountCents)
          : toMoneyCents(contribution.amount ?? 0) ?? 0;
      const nextCents = Math.max(0, getGoalCurrentCents(goal) - revertCents);
      await tx
        .update(savingsGoals)
        .set({ ...buildGoalCurrentFields(nextCents), updatedAt: new Date().toISOString() })
        .where(and(eq(savingsGoals.id, contribution.goalId), eq(savingsGoals.householdId, householdId)));
    }

    await tx
      .delete(savingsGoalContributions)
      .where(eq(savingsGoalContributions.id, contribution.id));
  }
}

/**
 * Unwind the bill payment(s) a transaction made: restore amountPaid/remaining,
 * recompute occurrence status, and delete the payment events. Exported for the
 * bill re-link flow (H-BILL-2), which must fully unwind before re-linking.
 */
export async function reverseBillPayments(
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
