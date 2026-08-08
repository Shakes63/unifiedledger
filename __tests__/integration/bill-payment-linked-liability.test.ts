/**
 * Bug-hunt finding A2: paying a bill linked to a liability account must be a
 * TRANSFER funding -> card (reducing what you owe), not a bare expense on the
 * funding account. The old path never touched the card's balance and counted
 * the payment as new spending.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import {
  accounts,
  billOccurrences,
  billPaymentEvents,
  billTemplates,
  transactions,
  transfers,
} from '@/lib/db/schema';
import { payOccurrence } from '@/lib/bills/service';
import { setupTestUserWithHousehold, cleanupTestHousehold } from './test-utils';

describe('bill payment with a linked liability account (A2)', () => {
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
        name: 'Bill Checking',
        type: 'checking',
        bankName: 'Test',
        currentBalance: 1000,
        currentBalanceCents: 100000,
      },
      {
        id: cardId,
        userId: ctx.userId,
        householdId: ctx.householdId,
        name: 'Bill Visa',
        type: 'credit',
        bankName: 'Test',
        // Positive-owed convention: $500 owed.
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
      name: 'Visa Payment',
      billType: 'expense',
      classification: 'loan_payment',
      recurrenceType: 'monthly',
      recurrenceDueDay: 1,
      defaultAmountCents: 20000,
      linkedLiabilityAccountId: cardId,
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

  it('paying a card-linked bill transfers funding -> card and reduces the owed balance', async () => {
    const result = await payOccurrence(ctx.userId, ctx.householdId, occurrenceId, {
      accountId: checkingId,
      amountCents: 20000,
      paymentDate: '2026-08-01',
    });

    expect(result.occurrence.status).toBe('paid');

    const [checking] = await db.select().from(accounts).where(eq(accounts.id, checkingId));
    const [card] = await db.select().from(accounts).where(eq(accounts.id, cardId));
    // Checking down $200; the card's OWED balance down $200 (500 -> 300).
    expect(checking.currentBalanceCents).toBe(80000);
    expect(card.currentBalanceCents).toBe(30000);

    // The movement is a canonical transfer pair, not an expense.
    const rows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.householdId, ctx.householdId));
    const types = rows.map((row) => row.type).sort();
    expect(types).toEqual(['transfer_in', 'transfer_out']);

    const [transferRow] = await db
      .select()
      .from(transfers)
      .where(eq(transfers.householdId, ctx.householdId));
    expect(transferRow).toBeTruthy();
    expect(transferRow.amountCents).toBe(20000);

    // The payment event hangs off the transfer-in leg (the card being paid),
    // matching the manual-transfer auto-link convention.
    const [event] = await db
      .select()
      .from(billPaymentEvents)
      .where(eq(billPaymentEvents.occurrenceId, occurrenceId));
    const transferIn = rows.find((row) => row.type === 'transfer_in');
    expect(event.transactionId).toBe(transferIn?.id);
  });

  it('a bill with no linked liability account still books a plain expense', async () => {
    await db
      .update(billTemplates)
      .set({ linkedLiabilityAccountId: null })
      .where(eq(billTemplates.id, templateId));

    await payOccurrence(ctx.userId, ctx.householdId, occurrenceId, {
      accountId: checkingId,
      amountCents: 20000,
      paymentDate: '2026-08-01',
    });

    const [checking] = await db.select().from(accounts).where(eq(accounts.id, checkingId));
    const [card] = await db.select().from(accounts).where(eq(accounts.id, cardId));
    expect(checking.currentBalanceCents).toBe(80000);
    expect(card.currentBalanceCents).toBe(50000);

    const rows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.householdId, ctx.householdId));
    expect(rows.map((row) => row.type)).toEqual(['expense']);
  });
});
