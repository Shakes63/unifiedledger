/**
 * H-DBG-7: budget spending must count split-row categories, not just the parent
 * transaction's category. A $300 "Groceries" expense split $100 Groceries /
 * $200 Gas previously reported Groceries $300 and Gas $0.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { accounts, budgetCategories, transactions, transactionSplits } from '@/lib/db/schema';
import { getCategorySpendingCents } from '@/lib/budgets/category-spending';
import {
  createTestAccount,
  createTestCategory,
  createTestTransaction,
  setupTestUserWithHousehold,
  cleanupTestHousehold,
} from './test-utils';

describe('split-aware category spending (H-DBG-7)', () => {
  let ctx: { userId: string; householdId: string };
  let groceriesId: string;
  let gasId: string;
  let accountId: string;

  beforeEach(async () => {
    ctx = await setupTestUserWithHousehold();
    const account = createTestAccount(ctx.userId, ctx.householdId);
    await db.insert(accounts).values(account as typeof accounts.$inferInsert);
    accountId = account.id as string;
    const groceries = createTestCategory(ctx.userId, ctx.householdId, { name: 'Groceries' });
    const gas = createTestCategory(ctx.userId, ctx.householdId, { name: 'Gas' });
    await db.insert(budgetCategories).values([
      groceries as typeof budgetCategories.$inferInsert,
      gas as typeof budgetCategories.$inferInsert,
    ]);
    groceriesId = groceries.id as string;
    gasId = gas.id as string;
  });

  afterEach(async () => {
    await db.delete(transactionSplits).where(eq(transactionSplits.householdId, ctx.householdId));
    await db.delete(budgetCategories).where(eq(budgetCategories.householdId, ctx.householdId));
    await db.delete(accounts).where(eq(accounts.householdId, ctx.householdId));
    await cleanupTestHousehold(ctx.userId, ctx.householdId);
  });

  it('counts split rows by their own category, not the parent category', async () => {
    // A $300 Groceries expense, split $100 Groceries / $200 Gas.
    const parent = createTestTransaction(ctx.userId, ctx.householdId, accountId, {
      amount: 300,
      type: 'expense',
      date: '2026-03-10',
      categoryId: groceriesId,
      isSplit: true,
    });
    await db.insert(transactions).values(parent as typeof transactions.$inferInsert);
    await db.insert(transactionSplits).values([
      {
        id: nanoid(),
        transactionId: parent.id,
        userId: ctx.userId,
        householdId: ctx.householdId,
        categoryId: groceriesId,
        amount: 100,
        amountCents: 10000,
        percentage: 0,
        isPercentage: false,
      },
      {
        id: nanoid(),
        transactionId: parent.id,
        userId: ctx.userId,
        householdId: ctx.householdId,
        categoryId: gasId,
        amount: 200,
        amountCents: 20000,
        percentage: 0,
        isPercentage: false,
      },
    ] as (typeof transactionSplits.$inferInsert)[]);

    // Plus a plain $40 Groceries expense (non-split).
    const plain = createTestTransaction(ctx.userId, ctx.householdId, accountId, {
      amount: 40,
      type: 'expense',
      date: '2026-03-12',
      categoryId: groceriesId,
    });
    await db.insert(transactions).values(plain as typeof transactions.$inferInsert);

    const range = { householdId: ctx.householdId, startDate: '2026-03-01', endDate: '2026-03-31' };

    // Groceries = $40 non-split + $100 split = $140 (the bug counted the $300 parent).
    const groceries = await getCategorySpendingCents({
      ...range,
      categoryId: groceriesId,
      categoryType: 'expense',
    });
    expect(groceries).toBe(14000);

    // Gas = $200 split (the bug counted $0).
    const gas = await getCategorySpendingCents({
      ...range,
      categoryId: gasId,
      categoryType: 'expense',
    });
    expect(gas).toBe(20000);
  });
});
