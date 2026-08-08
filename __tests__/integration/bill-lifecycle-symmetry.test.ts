/**
 * Bug-hunt findings L1/L3/L4: lifecycle symmetry of bill payments.
 * - L1: reversing a payment must restore the template's tracked debt balance
 *   and delete the payment's interest tax-deduction rows.
 * - L3: resetting an occurrence must delete its payment events so stale
 *   events can't replay against post-reset state.
 * - L4: editing a transfer's amount must re-scale the bill occurrence its
 *   transfer-in leg paid.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import {
  accounts,
  billOccurrences,
  billPaymentEvents,
  billTemplates,
  transactions,
  transfers,
} from '@/lib/db/schema';
import { payOccurrence, resetOccurrence } from '@/lib/bills/service';
import { updateCanonicalTransferPairByTransactionId } from '@/lib/transactions/transfer-service';
import { reverseTransactionSideEffects } from '@/lib/transactions/transaction-side-effect-reversal';
import { setupTestUserWithHousehold, cleanupTestHousehold } from './test-utils';

describe('bill payment lifecycle symmetry (L1/L3/L4)', () => {
  let ctx: { userId: string; householdId: string };
  let checkingId: string;
  let cardId: string;
  let templateId: string;
  let occurrenceId: string;

  beforeEach(async () => {
    ctx = await setupTestUserWithHousehold();
    checkingId = nanoid();
    cardId = nanoid();
    templateId = nanoid();
    occurrenceId = nanoid();

    await db.insert(accounts).values([
      {
        id: checkingId,
        userId: ctx.userId,
        householdId: ctx.householdId,
        name: 'Life Checking',
        type: 'checking',
        bankName: 'Test',
        currentBalance: 1000,
        currentBalanceCents: 100000,
      },
      {
        id: cardId,
        userId: ctx.userId,
        householdId: ctx.householdId,
        name: 'Life Visa',
        type: 'credit',
        bankName: 'Test',
        currentBalance: 500,
        currentBalanceCents: 50000,
        creditLimit: 5000,
        creditLimitCents: 500000,
      },
    ] as Array<typeof accounts.$inferInsert>);

    await db.insert(billTemplates).values({
      id: templateId,
      householdId: ctx.householdId,
      createdByUserId: ctx.userId,
      name: 'Car Loan',
      billType: 'expense',
      classification: 'loan_payment',
      recurrenceType: 'monthly',
      recurrenceDueDay: 1,
      defaultAmountCents: 20000,
      debtEnabled: true,
      debtOriginalBalanceCents: 100000,
      debtRemainingBalanceCents: 100000,
    } as typeof billTemplates.$inferInsert);

    await db.insert(billOccurrences).values({
      id: occurrenceId,
      templateId,
      householdId: ctx.householdId,
      dueDate: '2026-08-01',
      status: 'unpaid',
      amountDueCents: 20000,
      amountRemainingCents: 20000,
    } as typeof billOccurrences.$inferInsert);
  });

  afterEach(async () => {
    await db.delete(billPaymentEvents).where(eq(billPaymentEvents.householdId, ctx.householdId));
    await db.delete(billOccurrences).where(eq(billOccurrences.householdId, ctx.householdId));
    await db.delete(billTemplates).where(eq(billTemplates.householdId, ctx.householdId));
    await db.delete(transfers).where(eq(transfers.householdId, ctx.householdId));
    await db.delete(transactions).where(eq(transactions.householdId, ctx.householdId));
    await db.delete(accounts).where(eq(accounts.householdId, ctx.householdId));
    await cleanupTestHousehold(ctx.userId, ctx.householdId);
  });

  it('L1: reversal restores the template debt balance the payment decremented', async () => {
    const result = await payOccurrence(ctx.userId, ctx.householdId, occurrenceId, {
      accountId: checkingId,
      amountCents: 20000,
      paymentDate: '2026-08-01',
    });
    const transactionId = result.paymentEvent.transactionId;

    const [afterPay] = await db
      .select({ debt: billTemplates.debtRemainingBalanceCents })
      .from(billTemplates)
      .where(eq(billTemplates.id, templateId));
    expect(afterPay.debt).toBe(80000);

    await runInDatabaseTransaction(async (tx) => {
      await reverseTransactionSideEffects(tx, {
        transactionId,
        userId: ctx.userId,
        householdId: ctx.householdId,
      });
    });

    const [afterReverse] = await db
      .select({ debt: billTemplates.debtRemainingBalanceCents })
      .from(billTemplates)
      .where(eq(billTemplates.id, templateId));
    // The old reversal left this at 80000 — the $200 principal was lost.
    expect(afterReverse.debt).toBe(100000);

    const [occurrence] = await db
      .select()
      .from(billOccurrences)
      .where(eq(billOccurrences.id, occurrenceId));
    expect(occurrence.amountPaidCents).toBe(0);

    const events = await db
      .select()
      .from(billPaymentEvents)
      .where(eq(billPaymentEvents.occurrenceId, occurrenceId));
    expect(events).toHaveLength(0);
  });

  it('L3: resetting an occurrence deletes its payment events so they cannot replay', async () => {
    const result = await payOccurrence(ctx.userId, ctx.householdId, occurrenceId, {
      accountId: checkingId,
      amountCents: 20000,
      paymentDate: '2026-08-01',
    });
    const transactionId = result.paymentEvent.transactionId;

    await resetOccurrence(ctx.householdId, occurrenceId);

    const events = await db
      .select()
      .from(billPaymentEvents)
      .where(eq(billPaymentEvents.occurrenceId, occurrenceId));
    expect(events).toHaveLength(0);

    // Reversing the original transaction now finds nothing to replay: the
    // occurrence stays at its reset state instead of going negative/unpaid
    // against payments it never counted.
    await runInDatabaseTransaction(async (tx) => {
      await reverseTransactionSideEffects(tx, {
        transactionId,
        userId: ctx.userId,
        householdId: ctx.householdId,
      });
    });
    const [occurrence] = await db
      .select()
      .from(billOccurrences)
      .where(eq(billOccurrences.id, occurrenceId));
    expect(occurrence.amountPaidCents).toBe(0);
    expect(occurrence.amountRemainingCents).toBe(20000);
  });

  it('L4: editing a transfer that paid a card-linked bill re-scales the occurrence', async () => {
    await db
      .update(billTemplates)
      .set({ linkedLiabilityAccountId: cardId, debtEnabled: false, debtRemainingBalanceCents: null })
      .where(eq(billTemplates.id, templateId));

    const result = await payOccurrence(ctx.userId, ctx.householdId, occurrenceId, {
      accountId: checkingId,
      amountCents: 20000,
      paymentDate: '2026-08-01',
    });
    const transferInId = result.paymentEvent.transactionId;

    // Correct the transfer from $200 to $150.
    await updateCanonicalTransferPairByTransactionId({
      userId: ctx.userId,
      householdId: ctx.householdId,
      transactionId: transferInId,
      amountCents: 15000,
    });

    const [occurrence] = await db
      .select()
      .from(billOccurrences)
      .where(eq(billOccurrences.id, occurrenceId));
    // The old update path left amountPaidCents at 20000 with the money at 15000.
    expect(occurrence.amountPaidCents).toBe(15000);
    expect(occurrence.amountRemainingCents).toBe(5000);
    expect(['partial', 'overdue']).toContain(occurrence.status);

    const [checking] = await db.select().from(accounts).where(eq(accounts.id, checkingId));
    const [card] = await db.select().from(accounts).where(eq(accounts.id, cardId));
    expect(checking.currentBalanceCents).toBe(85000);
    expect(card.currentBalanceCents).toBe(35000);
  });
});
