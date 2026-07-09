/**
 * C-DB-2 (safety net): with no foreign keys enforcing money relationships,
 * cleanOrphanedMoneyLinks removes debt/goal/bill payment records whose parent is
 * gone and clears dangling transaction references so verify-money-integrity stays
 * clean.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import {
  debtPayments,
  savingsGoalContributions,
  billOccurrences,
  billPaymentEvents,
  transfers,
} from '@/lib/db/schema';
import { cleanOrphanedMoneyLinks } from '@/lib/cleanup/data-cleanup';
import { setupTestUserWithHousehold, cleanupTestHousehold } from './test-utils';

describe('cleanOrphanedMoneyLinks (C-DB-2 safety net)', () => {
  let ctx: { userId: string; householdId: string } | null = null;

  afterEach(async () => {
    if (ctx) {
      await db.delete(debtPayments).where(eq(debtPayments.householdId, ctx.householdId));
      await db.delete(savingsGoalContributions).where(eq(savingsGoalContributions.householdId, ctx.householdId));
      await db.delete(billPaymentEvents).where(eq(billPaymentEvents.householdId, ctx.householdId));
      await db.delete(billOccurrences).where(eq(billOccurrences.householdId, ctx.householdId));
      await db.delete(transfers).where(eq(transfers.householdId, ctx.householdId));
      await cleanupTestHousehold(ctx.userId, ctx.householdId);
      ctx = null;
    }
  });

  it('deletes payment records with a missing parent and clears dangling refs', async () => {
    ctx = await setupTestUserWithHousehold();

    // The money-link FKs (migration 0018) now block orphan creation through
    // normal writes, so these can only exist as legacy pre-FK data. Reproduce
    // that by inserting with foreign-key enforcement temporarily disabled on the
    // connection; cleanOrphanedMoneyLinks is the safety net for exactly this.
    const orphanPaymentId = nanoid();
    const transferId = nanoid();
    await db.run(sql`PRAGMA foreign_keys = OFF`);
    try {
      // Debt payment referencing a debt that does NOT exist.
      await db.insert(debtPayments).values({
        id: orphanPaymentId,
        debtId: 'ghost-debt',
        userId: ctx.userId,
        householdId: ctx.householdId,
        amount: 50,
        amountCents: 5000,
        principalCents: 5000,
        interestCents: 0,
        paymentDate: '2026-02-01',
        // Also a dangling transaction reference.
        transactionId: 'ghost-transaction',
      } as typeof debtPayments.$inferInsert);

      // Contribution to a missing goal.
      await db.insert(savingsGoalContributions).values({
        id: nanoid(),
        transactionId: 'x',
        goalId: 'ghost-goal',
        userId: ctx.userId,
        householdId: ctx.householdId,
        amount: 10,
        amountCents: 1000,
      } as typeof savingsGoalContributions.$inferInsert);

      // Bill payment event for a missing occurrence.
      await db.insert(billPaymentEvents).values({
        id: nanoid(),
        householdId: ctx.householdId,
        templateId: 't',
        occurrenceId: 'ghost-occurrence',
        transactionId: 'x',
        amountCents: 1000,
        paymentDate: '2026-02-01',
        paymentMethod: 'manual',
      } as typeof billPaymentEvents.$inferInsert);

      // Transfer with a dangling from_transaction_id (keep the row, clear the ref).
      await db.insert(transfers).values({
        id: transferId,
        userId: ctx.userId,
        householdId: ctx.householdId,
        fromAccountId: 'a1',
        toAccountId: 'a2',
        amount: 100,
        amountCents: 10000,
        fees: 0,
        feesCents: 0,
        date: '2026-02-01',
        status: 'completed',
        fromTransactionId: 'ghost-transaction',
        toTransactionId: null,
      } as typeof transfers.$inferInsert);
    } finally {
      await db.run(sql`PRAGMA foreign_keys = ON`);
    }

    const result = await cleanOrphanedMoneyLinks();
    expect(result.status).toBe('success');
    // 3 orphan payment records deleted (debt payment, contribution, bill event).
    expect(result.deletedRecords).toBe(3);

    expect(
      await db.select().from(debtPayments).where(eq(debtPayments.id, orphanPaymentId))
    ).toHaveLength(0);

    // The transfer row survives, but its dangling reference is cleared.
    const [tr] = await db.select().from(transfers).where(eq(transfers.id, transferId));
    expect(tr).toBeTruthy();
    expect(tr.fromTransactionId).toBeNull();
  });
});
