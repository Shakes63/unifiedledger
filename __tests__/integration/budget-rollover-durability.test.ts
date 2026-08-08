/**
 * Bug-hunt findings R1/R3: the rollover engine wrote the balance and the
 * history row as two separate autocommits with only a NON-unique index behind
 * them, so a failed insert after a committed update let the next daily run
 * re-apply the same month and DOUBLE rolloverBalance. A processed month was
 * also permanently unrecomputable, so transactions backdated into that month
 * never reached the carried balance.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import {
  budgetCategories,
  budgetRolloverHistory,
  transactions,
  accounts,
} from '@/lib/db/schema';
import { processMonthlyRollover } from '@/lib/budgets/rollover-utils';
import { setupTestUserWithHousehold, cleanupTestHousehold } from './test-utils';

describe('processMonthlyRollover durability (R1/R3)', () => {
  let ctx: { userId: string; householdId: string };
  let categoryId: string;
  let accountId: string;

  beforeEach(async () => {
    ctx = await setupTestUserWithHousehold();
    categoryId = nanoid();
    accountId = nanoid();

    await db.insert(accounts).values({
      id: accountId,
      userId: ctx.userId,
      householdId: ctx.householdId,
      name: 'Rollover Checking',
      type: 'checking',
      bankName: 'Test',
      currentBalance: 5000,
      currentBalanceCents: 500000,
    } as typeof accounts.$inferInsert);

    await db.insert(budgetCategories).values({
      id: categoryId,
      userId: ctx.userId,
      householdId: ctx.householdId,
      name: 'Groceries',
      type: 'expense',
      monthlyBudget: 600,
      rolloverEnabled: true,
      rolloverBalance: 0,
      isActive: true,
    } as typeof budgetCategories.$inferInsert);
  });

  afterEach(async () => {
    await db.delete(budgetRolloverHistory).where(eq(budgetRolloverHistory.householdId, ctx.householdId));
    await db.delete(budgetCategories).where(eq(budgetCategories.householdId, ctx.householdId));
    await db.delete(transactions).where(eq(transactions.householdId, ctx.householdId));
    await db.delete(accounts).where(eq(accounts.householdId, ctx.householdId));
    await cleanupTestHousehold(ctx.userId, ctx.householdId);
  });

  async function spend(amount: number, date: string) {
    await db.insert(transactions).values({
      id: nanoid(),
      userId: ctx.userId,
      householdId: ctx.householdId,
      accountId,
      categoryId,
      date,
      amount,
      amountCents: Math.round(amount * 100),
      description: 'Groceries',
      type: 'expense',
    } as typeof transactions.$inferInsert);
  }

  async function balance(): Promise<number> {
    const [row] = await db
      .select({ b: budgetCategories.rolloverBalance })
      .from(budgetCategories)
      .where(eq(budgetCategories.id, categoryId));
    return row.b ?? 0;
  }

  it('R1: running the same month twice does NOT double the rollover', async () => {
    await spend(400, '2026-07-15');

    const first = await processMonthlyRollover(ctx.householdId, '2026-07');
    expect(first.processed).toBe(1);
    expect(await balance()).toBe(200); // 600 budget − 400 spent

    // The daily cron hits the same month again.
    const second = await processMonthlyRollover(ctx.householdId, '2026-07');
    expect(second.processed).toBe(0);
    expect(second.skipped).toBe(1);
    expect(await balance()).toBe(200); // NOT 400

    const history = await db
      .select()
      .from(budgetRolloverHistory)
      .where(eq(budgetRolloverHistory.categoryId, categoryId));
    expect(history).toHaveLength(1);
  });

  it('R1: the unique index makes a duplicate history row impossible', async () => {
    await spend(400, '2026-07-15');
    await processMonthlyRollover(ctx.householdId, '2026-07');

    await expect(
      db.insert(budgetRolloverHistory).values({
        id: nanoid(),
        categoryId,
        householdId: ctx.householdId,
        month: '2026-07',
        previousBalance: 0,
        monthlyBudget: 600,
        actualSpent: 400,
        rolloverAmount: 200,
        newBalance: 200,
        rolloverLimit: null,
        wasCapped: false,
        createdAt: new Date().toISOString(),
      } as typeof budgetRolloverHistory.$inferInsert)
    ).rejects.toThrow(/UNIQUE constraint failed/i);
  });

  it('R3: force recomputes a closed month after backdated spending, without stacking', async () => {
    await spend(400, '2026-07-15');
    await processMonthlyRollover(ctx.householdId, '2026-07');
    expect(await balance()).toBe(200);

    // The July bank statement is imported in August: $250 more of July spend.
    // True July result is 600 − 650 = −50 of carry, i.e. balance 0 with
    // negative rollover disallowed (the household default).
    await spend(250, '2026-07-20');

    // Without force, the month stays frozen at the stale +200.
    const noForce = await processMonthlyRollover(ctx.householdId, '2026-07');
    expect(noForce.skipped).toBe(1);
    expect(await balance()).toBe(200);

    const forced = await processMonthlyRollover(ctx.householdId, '2026-07', { force: true });
    expect(forced.processed).toBe(1);
    // The prior carry is reversed before recomputing, so the result reflects
    // the true spend rather than stacking on the stale balance.
    expect(await balance()).toBe(0);

    const history = await db
      .select()
      .from(budgetRolloverHistory)
      .where(eq(budgetRolloverHistory.categoryId, categoryId));
    expect(history).toHaveLength(1);
    expect(history[0].actualSpent).toBe(650);
  });
});
