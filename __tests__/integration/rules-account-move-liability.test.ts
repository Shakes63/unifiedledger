/**
 * A rule's set_account action moving a transaction between accounts must
 * reverse/apply the balance effect with the LIABILITY rule (C-MATH-1). The
 * handler used raw asset-rule SQL since before the audit, so moving an
 * expense onto a credit card DECREASED the card's owed balance. Caught in the
 * transactions re-verification sweep.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { accounts, transactions } from '@/lib/db/schema';
import { handleAccountChange } from '@/lib/rules/account-action-handler';
import { setupTestUserWithHousehold, cleanupTestHousehold, createTestTransaction } from './test-utils';

describe('rules set_account action with liability accounts (C-MATH-1)', () => {
  let ctx: { userId: string; householdId: string };
  let checkingId: string;
  let creditId: string;

  beforeEach(async () => {
    ctx = await setupTestUserWithHousehold();
    checkingId = nanoid();
    creditId = nanoid();
    await db.insert(accounts).values([
      {
        id: checkingId,
        userId: ctx.userId,
        householdId: ctx.householdId,
        name: 'Rule Checking',
        type: 'checking',
        bankName: 'Test',
        currentBalance: 1000,
        currentBalanceCents: 100000,
      },
      {
        id: creditId,
        userId: ctx.userId,
        householdId: ctx.householdId,
        name: 'Rule Credit',
        type: 'credit',
        bankName: 'Test',
        // Positive-owed convention: the user owes $500.
        currentBalance: 500,
        currentBalanceCents: 50000,
        creditLimit: 5000,
        creditLimitCents: 500000,
      },
    ] as Array<typeof accounts.$inferInsert>);
  });

  afterEach(async () => {
    await db.delete(transactions).where(eq(transactions.householdId, ctx.householdId));
    await db.delete(accounts).where(eq(accounts.householdId, ctx.householdId));
    await cleanupTestHousehold(ctx.userId, ctx.householdId);
  });

  it('moving an expense from checking onto a credit card shifts the debt correctly', async () => {
    // A $60 expense currently on checking (its effect already applied: -$60).
    const tx = createTestTransaction(ctx.userId, ctx.householdId, checkingId, {
      type: 'expense',
      amount: 60,
    });
    await db.insert(transactions).values(tx as typeof transactions.$inferInsert);
    await db
      .update(accounts)
      .set({ currentBalance: 940, currentBalanceCents: 94000 })
      .where(eq(accounts.id, checkingId));

    const result = await handleAccountChange(ctx.userId, tx.id, creditId);
    expect(result.success).toBe(true);

    const rows = await db.select().from(accounts).where(eq(accounts.householdId, ctx.householdId));
    const checking = rows.find((a) => a.id === checkingId)!;
    const credit = rows.find((a) => a.id === creditId)!;

    // Checking gets its $60 back.
    expect(checking.currentBalanceCents).toBe(100000);
    // The credit card's OWED balance grows by $60 (a charge on the card).
    // The old asset rule wrote 44000 — the debt shrank instead.
    expect(credit.currentBalanceCents).toBe(56000);

    const [moved] = await db.select().from(transactions).where(eq(transactions.id, tx.id));
    expect(moved.accountId).toBe(creditId);
  });

  it('moving an income onto a credit card reduces the owed balance', async () => {
    // A $60 income (refund) currently on checking (+$60 applied).
    const tx = createTestTransaction(ctx.userId, ctx.householdId, checkingId, {
      type: 'income',
      amount: 60,
    });
    await db.insert(transactions).values(tx as typeof transactions.$inferInsert);
    await db
      .update(accounts)
      .set({ currentBalance: 1060, currentBalanceCents: 106000 })
      .where(eq(accounts.id, checkingId));

    const result = await handleAccountChange(ctx.userId, tx.id, creditId);
    expect(result.success).toBe(true);

    const rows = await db.select().from(accounts).where(eq(accounts.householdId, ctx.householdId));
    const checking = rows.find((a) => a.id === checkingId)!;
    const credit = rows.find((a) => a.id === creditId)!;

    // Checking loses the income it never should have had.
    expect(checking.currentBalanceCents).toBe(100000);
    // A credit on the card reduces what is owed: $500 - $60.
    expect(credit.currentBalanceCents).toBe(44000);
  });
});
