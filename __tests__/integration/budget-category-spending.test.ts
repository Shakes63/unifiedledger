/**
 * Bug-hunt findings M2/M4/R5 in the shared spending oracle:
 * - R5: a category funded by transfer_out read as $0 spent, so rollover
 *   credited its entire budget as surplus every month, forever.
 * - M2: refunds are stored as income with isRefund while keeping the expense
 *   category, so they never reduced category spending.
 * - M4: a partially-split parent kept isSplit=true, so the uncovered remainder
 *   vanished from every budget total.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { accounts, transactions, transactionSplits } from '@/lib/db/schema';
import { getCategorySpendingCents } from '@/lib/budgets/category-spending';
import { setupTestUserWithHousehold, cleanupTestHousehold } from './test-utils';

describe('getCategorySpendingCents (M2/M4/R5)', () => {
  let ctx: { userId: string; householdId: string };
  let accountId: string;
  const groceries = 'cat-groceries';
  const gas = 'cat-gas';

  const range = { startDate: '2026-07-01', endDate: '2026-07-31' };

  beforeEach(async () => {
    ctx = await setupTestUserWithHousehold();
    accountId = nanoid();
    await db.insert(accounts).values({
      id: accountId,
      userId: ctx.userId,
      householdId: ctx.householdId,
      name: 'Spending Checking',
      type: 'checking',
      bankName: 'Test',
      currentBalance: 5000,
      currentBalanceCents: 500000,
    } as typeof accounts.$inferInsert);
  });

  afterEach(async () => {
    await db.delete(transactionSplits).where(eq(transactionSplits.householdId, ctx.householdId));
    await db.delete(transactions).where(eq(transactions.householdId, ctx.householdId));
    await db.delete(accounts).where(eq(accounts.householdId, ctx.householdId));
    await cleanupTestHousehold(ctx.userId, ctx.householdId);
  });

  async function tx(overrides: Record<string, unknown>): Promise<string> {
    const id = nanoid();
    await db.insert(transactions).values({
      id,
      userId: ctx.userId,
      householdId: ctx.householdId,
      accountId,
      date: '2026-07-15',
      description: 'test',
      type: 'expense',
      ...overrides,
    } as typeof transactions.$inferInsert);
    return id;
  }

  const spend = (categoryId: string) =>
    getCategorySpendingCents({
      categoryId,
      householdId: ctx.householdId,
      categoryType: 'expense',
      ...range,
    });

  it('sums plain expenses in the category', async () => {
    await tx({ categoryId: groceries, amount: 100, amountCents: 10000 });
    await tx({ categoryId: groceries, amount: 25.5, amountCents: 2550 });
    expect(await spend(groceries)).toBe(12550);
  });

  it('R5: a categorized transfer_out counts as spending', async () => {
    await tx({ categoryId: groceries, amount: 100, amountCents: 10000 });
    await tx({ categoryId: groceries, amount: 500, amountCents: 50000, type: 'transfer_out' });
    // Used to report only the $100 expense, so a transfer-funded category
    // looked entirely unspent.
    expect(await spend(groceries)).toBe(60000);
  });

  it('M2: a refund reduces the category it was booked against', async () => {
    await tx({ categoryId: groceries, amount: 33.33, amountCents: 3333 });
    await tx({ categoryId: groceries, amount: 33.33, amountCents: 3333 });
    await tx({ categoryId: groceries, amount: 33.33, amountCents: 3333 });
    // A $10 return: income + isRefund, keeping the Groceries category.
    await tx({
      categoryId: groceries,
      amount: 10,
      amountCents: 1000,
      type: 'income',
      isRefund: true,
    });
    // 99.99 spent - 10.00 refunded = 89.99
    expect(await spend(groceries)).toBe(8999);
  });

  it('M2: refunds never drive a category negative', async () => {
    await tx({ categoryId: groceries, amount: 10, amountCents: 1000 });
    await tx({
      categoryId: groceries,
      amount: 50,
      amountCents: 5000,
      type: 'income',
      isRefund: true,
    });
    expect(await spend(groceries)).toBe(0);
  });

  it('splits are attributed to their own categories, not the parent', async () => {
    const parentId = await tx({
      categoryId: groceries,
      amount: 300,
      amountCents: 30000,
      isSplit: true,
    });
    for (const [categoryId, cents] of [
      [groceries, 10000],
      [gas, 20000],
    ] as const) {
      await db.insert(transactionSplits).values({
        id: nanoid(),
        transactionId: parentId,
        userId: ctx.userId,
        householdId: ctx.householdId,
        categoryId,
        amount: cents / 100,
        amountCents: cents,
      } as typeof transactionSplits.$inferInsert);
    }
    expect(await spend(groceries)).toBe(10000);
    expect(await spend(gas)).toBe(20000);
  });

  it('M4: the uncovered remainder of a partial split stays with the parent category', async () => {
    const parentId = await tx({
      categoryId: groceries,
      amount: 300,
      amountCents: 30000,
      isSplit: true,
    });
    // Only $100 of the $300 is split out to Gas.
    await db.insert(transactionSplits).values({
      id: nanoid(),
      transactionId: parentId,
      userId: ctx.userId,
      householdId: ctx.householdId,
      categoryId: gas,
      amount: 100,
      amountCents: 10000,
    } as typeof transactionSplits.$inferInsert);

    // The $200 remainder used to vanish from every budget total.
    expect(await spend(groceries)).toBe(20000);
    expect(await spend(gas)).toBe(10000);
  });
});
