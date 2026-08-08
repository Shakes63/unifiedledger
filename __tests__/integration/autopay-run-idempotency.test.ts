/**
 * Bug-hunt findings A4/A5: a fixed-amount autopay rule re-fired every day of
 * the 14-day catch-up window (the occurrence stayed 'partial' and the
 * idempotency key was per-day), draining $100/day until the bill was gone; and
 * a retry run re-reported already-paid occurrences as fresh successes.
 * Autopay now pays each occurrence at most ONCE, and replays count as skipped.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import {
  accounts,
  autopayRules,
  autopayRuns,
  billOccurrences,
  billPaymentEvents,
  billTemplates,
  transactions,
} from '@/lib/db/schema';
import { runAutopay } from '@/lib/bills/service';
import { setupTestUserWithHousehold, cleanupTestHousehold } from './test-utils';

describe('runAutopay occurrence-level idempotency (A4/A5)', () => {
  let ctx: { userId: string; householdId: string };
  let checkingId: string;
  let templateId: string;
  let occurrenceId: string;

  beforeEach(async () => {
    ctx = await setupTestUserWithHousehold();
    checkingId = nanoid();
    templateId = nanoid();
    occurrenceId = nanoid();

    await db.insert(accounts).values({
      id: checkingId,
      userId: ctx.userId,
      householdId: ctx.householdId,
      name: 'Autopay Checking',
      type: 'checking',
      bankName: 'Test',
      currentBalance: 1000,
      currentBalanceCents: 100000,
    } as typeof accounts.$inferInsert);

    await db.insert(billTemplates).values({
      id: templateId,
      householdId: ctx.householdId,
      createdByUserId: ctx.userId,
      name: 'Internet',
      billType: 'expense',
      classification: 'utility',
      recurrenceType: 'monthly',
      recurrenceDueDay: 1,
      defaultAmountCents: 50000,
    } as typeof billTemplates.$inferInsert);

    await db.insert(billOccurrences).values({
      id: occurrenceId,
      templateId,
      householdId: ctx.householdId,
      dueDate: '2026-08-01',
      status: 'unpaid',
      amountDueCents: 50000,
      amountRemainingCents: 50000,
    } as typeof billOccurrences.$inferInsert);

    await db.insert(autopayRules).values({
      id: nanoid(),
      templateId,
      householdId: ctx.householdId,
      isEnabled: true,
      payFromAccountId: checkingId,
      amountType: 'fixed',
      fixedAmountCents: 10000,
      daysBeforeDue: 0,
    } as typeof autopayRules.$inferInsert);
  });

  afterEach(async () => {
    await db.delete(billPaymentEvents).where(eq(billPaymentEvents.householdId, ctx.householdId));
    await db.delete(autopayRuns).where(eq(autopayRuns.householdId, ctx.householdId));
    await db.delete(autopayRules).where(eq(autopayRules.householdId, ctx.householdId));
    await db.delete(billOccurrences).where(eq(billOccurrences.householdId, ctx.householdId));
    await db.delete(billTemplates).where(eq(billTemplates.householdId, ctx.householdId));
    await db.delete(transactions).where(eq(transactions.householdId, ctx.householdId));
    await db.delete(accounts).where(eq(accounts.householdId, ctx.householdId));
    await cleanupTestHousehold(ctx.userId, ctx.householdId);
  });

  async function balanceCents(): Promise<number> {
    const [row] = await db
      .select({ cents: accounts.currentBalanceCents })
      .from(accounts)
      .where(eq(accounts.id, checkingId));
    return row.cents ?? 0;
  }

  it('a fixed-amount rule pays once, not daily through the catch-up window', async () => {
    const day1 = await runAutopay({
      userId: ctx.userId,
      householdId: ctx.householdId,
      runType: 'scheduled',
      runDate: '2026-08-01',
    });
    expect(day1.successCount).toBe(1);
    expect(day1.totalAmountCents).toBe(10000);
    expect(await balanceCents()).toBe(90000);

    // Next day: occurrence is 'partial' and still inside the catch-up window.
    // The old per-day idempotency key paid ANOTHER $100 here (and every day
    // after, until the $500 bill was drained).
    const day2 = await runAutopay({
      userId: ctx.userId,
      householdId: ctx.householdId,
      runType: 'scheduled',
      runDate: '2026-08-02',
    });
    expect(day2.successCount).toBe(0);
    expect(day2.skippedCount).toBe(1);
    expect(day2.failedCount).toBe(0);
    expect(await balanceCents()).toBe(90000);

    const [occurrence] = await db
      .select()
      .from(billOccurrences)
      .where(eq(billOccurrences.id, occurrenceId));
    expect(occurrence.amountPaidCents).toBe(10000);
    // Partial payment; past the due date the refresh pass may relabel it
    // overdue — either way it must NOT be paid, and must not be drained.
    expect(['partial', 'overdue']).toContain(occurrence.status);
    expect(occurrence.amountRemainingCents).toBe(40000);
  });

  it('a retry after a failed run counts already-paid occurrences as skipped, not successes', async () => {
    const first = await runAutopay({
      userId: ctx.userId,
      householdId: ctx.householdId,
      runType: 'scheduled',
      runDate: '2026-08-01',
    });
    expect(first.successCount).toBe(1);

    // Force the run row to 'failed' so the same-day guard allows a retry
    // (the guard only blocks started/completed runs).
    await db
      .update(autopayRuns)
      .set({ status: 'failed' })
      .where(eq(autopayRuns.id, first.runId));

    const retry = await runAutopay({
      userId: ctx.userId,
      householdId: ctx.householdId,
      runType: 'scheduled',
      runDate: '2026-08-01',
    });
    // The old code replayed the payment through the idempotent pre-check and
    // reported it as a fresh success with its amount re-added to the total.
    expect(retry.successCount).toBe(0);
    expect(retry.skippedCount).toBe(1);
    expect(retry.totalAmountCents).toBe(0);
    expect(await balanceCents()).toBe(90000);
  });
});
