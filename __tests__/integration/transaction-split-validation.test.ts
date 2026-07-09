/**
 * H-TXN-6: the single-split create route did no sum validation (you could attach
 * a $1,000 split to a $50 transaction) and stored percentage splits with
 * amountCents = 0. Verify it now materializes the percentage amount and rejects
 * splits that exceed the parent. Real DB; mocks only auth + household resolution.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { accounts, budgetCategories, transactions } from '@/lib/db/schema';
import {
  createTestAccount,
  createTestCategory,
  createTestTransaction,
  setupTestUserWithHousehold,
  cleanupTestHousehold,
} from './test-utils';

vi.mock('@/lib/auth-helpers', () => ({ requireAuth: vi.fn() }));
vi.mock('@/lib/api/household-auth', () => ({
  getAndVerifyHousehold: vi.fn(),
  getHouseholdIdFromRequest: vi.fn(),
  requireHouseholdAuth: vi.fn(),
}));
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';

async function makeTxn(
  userId: string,
  householdId: string,
  accountId: string,
  categoryId: string,
  amount: number
): Promise<string> {
  const txn = createTestTransaction(userId, householdId, accountId, {
    categoryId,
    amount,
    type: 'expense',
  });
  await db.insert(transactions).values(txn as typeof transactions.$inferInsert);
  return txn.id as string;
}

describe('single-split validation (H-TXN-6)', () => {
  let ctx: { userId: string; householdId: string };
  let accountId: string;
  let categoryId: string;

  beforeEach(async () => {
    ctx = await setupTestUserWithHousehold();
    (requireAuth as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      userId: ctx.userId,
    });
    (getAndVerifyHousehold as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      householdId: ctx.householdId,
    });

    const account = createTestAccount(ctx.userId, ctx.householdId);
    await db.insert(accounts).values(account as typeof accounts.$inferInsert);
    accountId = account.id as string;
    const category = createTestCategory(ctx.userId, ctx.householdId, { name: 'Groceries' });
    await db.insert(budgetCategories).values(category as typeof budgetCategories.$inferInsert);
    categoryId = category.id as string;
  });

  afterEach(async () => {
    await db.delete(accounts).where(eq(accounts.householdId, ctx.householdId));
    await cleanupTestHousehold(ctx.userId, ctx.householdId);
  });

  function body(payload: Record<string, unknown>): Request {
    return new Request('http://localhost', {
      method: 'POST',
      headers: { 'x-household-id': ctx.householdId },
      body: JSON.stringify(payload),
    });
  }

  it('rejects a split that would exceed the transaction amount', async () => {
    const txnId = await makeTxn(ctx.userId, ctx.householdId, accountId, categoryId, 100);
    const { handleCreateTransactionSplit } = await import(
      '@/lib/transactions/transaction-splits-route-handler'
    );

    const ok = await handleCreateTransactionSplit(body({ categoryId, amount: 60 }), txnId);
    expect(ok.status).toBe(201);

    const tooBig = await handleCreateTransactionSplit(body({ categoryId, amount: 50 }), txnId);
    expect(tooBig.status).toBe(400);
  });

  it('materializes a percentage split amount instead of storing 0', async () => {
    const txnId = await makeTxn(ctx.userId, ctx.householdId, accountId, categoryId, 200);
    const { handleCreateTransactionSplit } = await import(
      '@/lib/transactions/transaction-splits-route-handler'
    );

    const res = await handleCreateTransactionSplit(
      body({ categoryId, isPercentage: true, percentage: 25 }),
      txnId
    );
    expect(res.status).toBe(201);
    const split = await res.json();
    // 25% of $200 = $50 = 5000 cents (previously stored as 0).
    expect(split.amountCents).toBe(5000);
  });
});
