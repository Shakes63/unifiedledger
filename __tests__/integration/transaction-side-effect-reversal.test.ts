import { afterEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import {
  billOccurrences,
  billPaymentEvents,
  debtPayments,
  debts,
  savingsGoalContributions,
  savingsGoals,
} from '@/lib/db/schema';
import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import {
  adjustTransactionSideEffectsForAmountChange,
  reverseTransactionSideEffects,
} from '@/lib/transactions/transaction-side-effect-reversal';
import { setupTestUserWithHousehold, cleanupTestHousehold } from './test-utils';

/**
 * C-LIFE-1/2/3, H-BILL-1: deleting a transaction must reverse the debt payment,
 * goal contribution, and bill payment it created. These exercise the shared
 * reversal helper against a real DB.
 */
describe('reverseTransactionSideEffects (C-LIFE-1/2/3)', () => {
  let ctx: { userId: string; householdId: string } | null = null;
  const txId = 'txn-reversal-1';

  afterEach(async () => {
    if (ctx) {
      await db.delete(debtPayments).where(eq(debtPayments.householdId, ctx.householdId));
      await db.delete(debts).where(eq(debts.householdId, ctx.householdId));
      await db.delete(savingsGoalContributions).where(eq(savingsGoalContributions.householdId, ctx.householdId));
      await db.delete(savingsGoals).where(eq(savingsGoals.householdId, ctx.householdId));
      await db.delete(billPaymentEvents).where(eq(billPaymentEvents.householdId, ctx.householdId));
      await db.delete(billOccurrences).where(eq(billOccurrences.householdId, ctx.householdId));
      await cleanupTestHousehold(ctx.userId, ctx.householdId);
      ctx = null;
    }
  });

  it('restores a debt balance and removes the payment row', async () => {
    ctx = await setupTestUserWithHousehold();
    const debtId = nanoid();
    // Debt at $300 after a $200 payment (principal $200) was applied.
    await db.insert(debts).values({
      id: debtId,
      userId: ctx.userId,
      householdId: ctx.householdId,
      name: 'Loan',
      creditorName: 'Test Creditor',
      debtType: 'personal_loan',
      originalAmount: 500,
      remainingBalance: 300,
      startDate: '2026-01-01',
      status: 'active',
    } as typeof debts.$inferInsert);
    await db.insert(debtPayments).values({
      id: nanoid(),
      debtId,
      userId: ctx.userId,
      householdId: ctx.householdId,
      amount: 200,
      principalAmount: 200,
      interestAmount: 0,
      paymentDate: '2026-02-01',
      transactionId: txId,
    } as typeof debtPayments.$inferInsert);

    await runInDatabaseTransaction(async (tx) => {
      await reverseTransactionSideEffects(tx, {
        transactionId: txId,
        userId: ctx!.userId,
        householdId: ctx!.householdId,
      });
    });

    const [debt] = await db.select().from(debts).where(eq(debts.id, debtId));
    expect(debt.remainingBalance).toBe(500);
    expect(debt.status).toBe('active');
    const remainingPayments = await db
      .select()
      .from(debtPayments)
      .where(eq(debtPayments.transactionId, txId));
    expect(remainingPayments).toHaveLength(0);
  });

  it('decrements a goal and removes the contribution row', async () => {
    ctx = await setupTestUserWithHousehold();
    const goalId = nanoid();
    await db.insert(savingsGoals).values({
      id: goalId,
      userId: ctx.userId,
      householdId: ctx.householdId,
      name: 'Vacation',
      targetAmount: 1000,
      currentAmount: 250,
    } as typeof savingsGoals.$inferInsert);
    await db.insert(savingsGoalContributions).values({
      id: nanoid(),
      transactionId: txId,
      goalId,
      userId: ctx.userId,
      householdId: ctx.householdId,
      amount: 100,
    } as typeof savingsGoalContributions.$inferInsert);

    await runInDatabaseTransaction(async (tx) => {
      await reverseTransactionSideEffects(tx, {
        transactionId: txId,
        userId: ctx!.userId,
        householdId: ctx!.householdId,
      });
    });

    const [goal] = await db.select().from(savingsGoals).where(eq(savingsGoals.id, goalId));
    expect(goal.currentAmount).toBe(150);
    const remaining = await db
      .select()
      .from(savingsGoalContributions)
      .where(eq(savingsGoalContributions.transactionId, txId));
    expect(remaining).toHaveLength(0);
  });

  it('amount edit re-scales a linked debt payment (C-LIFE-3 edit case)', async () => {
    ctx = await setupTestUserWithHousehold();
    const debtId = nanoid();
    // Debt at $300 after a $200 payment (principal $200, 0% interest).
    await db.insert(debts).values({
      id: debtId,
      userId: ctx.userId,
      householdId: ctx.householdId,
      name: 'Loan',
      creditorName: 'Test Creditor',
      debtType: 'personal_loan',
      originalAmount: 500,
      remainingBalance: 300,
      remainingBalanceCents: 30000,
      startDate: '2026-01-01',
      status: 'active',
      interestType: 'none',
      interestRate: 0,
    } as typeof debts.$inferInsert);
    await db.insert(debtPayments).values({
      id: nanoid(),
      debtId,
      userId: ctx.userId,
      householdId: ctx.householdId,
      amount: 200,
      principalAmount: 200,
      interestAmount: 0,
      amountCents: 20000,
      principalCents: 20000,
      interestCents: 0,
      paymentDate: '2026-02-01',
      transactionId: txId,
    } as typeof debtPayments.$inferInsert);

    // The funding transaction's amount is corrected $200 -> $20.
    await runInDatabaseTransaction(async (tx) => {
      await adjustTransactionSideEffectsForAmountChange(tx, {
        transactionId: txId,
        userId: ctx!.userId,
        householdId: ctx!.householdId,
        oldAmountCents: 20000,
        newAmountCents: 2000,
      });
    });

    const [debt] = await db.select().from(debts).where(eq(debts.id, debtId));
    // Reversal restores to $500, then a $20 payment applies -> $480.
    // (Previously the debt stayed reduced by the full $200.)
    expect(debt.remainingBalanceCents).toBe(48000);
    const payments = await db
      .select()
      .from(debtPayments)
      .where(eq(debtPayments.transactionId, txId));
    expect(payments).toHaveLength(1);
    expect(payments[0].amountCents).toBe(2000);
  });

  it('unwinds a bill payment: reduces amount paid and reverts status', async () => {
    ctx = await setupTestUserWithHousehold();
    const occurrenceId = nanoid();
    const templateId = nanoid();
    // A $100 bill fully paid by this transaction.
    await db.insert(billOccurrences).values({
      id: occurrenceId,
      templateId,
      householdId: ctx.householdId,
      dueDate: '2026-02-01',
      status: 'paid',
      amountDueCents: 10000,
      amountPaidCents: 10000,
      amountRemainingCents: 0,
      paidDate: '2026-02-01',
      lastTransactionId: txId,
    } as typeof billOccurrences.$inferInsert);
    await db.insert(billPaymentEvents).values({
      id: nanoid(),
      householdId: ctx.householdId,
      templateId,
      occurrenceId,
      transactionId: txId,
      amountCents: 10000,
      paymentDate: '2026-02-01',
      paymentMethod: 'manual',
    } as typeof billPaymentEvents.$inferInsert);

    await runInDatabaseTransaction(async (tx) => {
      await reverseTransactionSideEffects(tx, {
        transactionId: txId,
        userId: ctx!.userId,
        householdId: ctx!.householdId,
      });
    });

    const [occurrence] = await db
      .select()
      .from(billOccurrences)
      .where(eq(billOccurrences.id, occurrenceId));
    expect(occurrence.amountPaidCents).toBe(0);
    expect(occurrence.amountRemainingCents).toBe(10000);
    expect(occurrence.status).toBe('unpaid');
    expect(occurrence.paidDate).toBeNull();
    expect(occurrence.lastTransactionId).toBeNull();
    const events = await db
      .select()
      .from(billPaymentEvents)
      .where(and(eq(billPaymentEvents.transactionId, txId), eq(billPaymentEvents.householdId, ctx.householdId)));
    expect(events).toHaveLength(0);
  });
});
