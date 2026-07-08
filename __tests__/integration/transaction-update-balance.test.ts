import { afterEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { accounts, transactions } from '@/lib/db/schema';
import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import {
  adjustUpdatedTransactionAccountBalances,
} from '@/lib/transactions/transaction-update-nontransfer';
import { getAccountBalanceCents } from '@/lib/transactions/money-movement-service';
import {
  createTestAccount,
  setupTestUserWithHousehold,
  cleanupTestHousehold,
} from './test-utils';

/**
 * Regression test for C-TXN-1: editing a same-account transaction's amount used
 * to read the account balance twice and let the second (re-apply) write clobber
 * the first (reversal) write, corrupting the balance by the old amount. The fix
 * coalesces per-account deltas and applies each account exactly once.
 */

async function balanceCents(accountId: string): Promise<number> {
  const [row] = await db
    .select({ currentBalanceCents: accounts.currentBalanceCents })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);
  return getAccountBalanceCents(row);
}

async function insertAccount(
  userId: string,
  householdId: string,
  balance: number,
  name: string
): Promise<string> {
  const account = createTestAccount(userId, householdId, { name, currentBalance: balance });
  await db.insert(accounts).values(account as typeof accounts.$inferInsert);
  return account.id as string;
}

function fakeExpense(accountId: string): typeof transactions.$inferSelect {
  return { type: 'expense', accountId } as unknown as typeof transactions.$inferSelect;
}

describe('adjustUpdatedTransactionAccountBalances (C-TXN-1)', () => {
  let ctx: { userId: string; householdId: string } | null = null;

  afterEach(async () => {
    if (ctx) {
      await cleanupTestHousehold(ctx.userId, ctx.householdId);
      ctx = null;
    }
  });

  it('same-account amount edit adjusts by (old - new), not by -new', async () => {
    ctx = await setupTestUserWithHousehold();
    // Balance $100 before reversal. Original expense was $50, edited to $60.
    const accountId = await insertAccount(ctx.userId, ctx.householdId, 100, 'Checking');

    await runInDatabaseTransaction(async (tx) => {
      await adjustUpdatedTransactionAccountBalances(tx, {
        transaction: fakeExpense(accountId),
        newAccountId: accountId,
        oldAmountCents: 5000,
        newAmountCents: 6000,
      });
    });

    // Correct: 100 + 50 - 60 = $90. The old bug produced 100 - 60 = $40.
    expect(await balanceCents(accountId)).toBe(9000);
  });

  it('resubmitting the same amount leaves the balance unchanged', async () => {
    ctx = await setupTestUserWithHousehold();
    const accountId = await insertAccount(ctx.userId, ctx.householdId, 100, 'Checking');

    await runInDatabaseTransaction(async (tx) => {
      await adjustUpdatedTransactionAccountBalances(tx, {
        transaction: fakeExpense(accountId),
        newAccountId: accountId,
        oldAmountCents: 5000,
        newAmountCents: 5000,
      });
    });

    // 100 + 50 - 50 = $100. The old bug dropped it to $50.
    expect(await balanceCents(accountId)).toBe(10000);
  });

  it('credit account: editing a charge upward increases the amount owed (C-MATH-1)', async () => {
    ctx = await setupTestUserWithHousehold();
    // Credit card with $500 owed (positive-owed convention).
    const account = createTestAccount(ctx.userId, ctx.householdId, {
      name: 'Card',
      type: 'credit',
      currentBalance: 500,
      creditLimit: 5000,
    });
    await db.insert(accounts).values(account as typeof accounts.$inferInsert);
    const accountId = account.id as string;

    await runInDatabaseTransaction(async (tx) => {
      await adjustUpdatedTransactionAccountBalances(tx, {
        transaction: fakeExpense(accountId),
        newAccountId: accountId,
        oldAmountCents: 5000,
        newAmountCents: 6000,
      });
    });

    // A credit-card charge edited $50 -> $60 increases what you owe by $10:
    // $500 -> $510. (The old asset-style math would have wrongly reduced it.)
    expect(await balanceCents(accountId)).toBe(51000);
  });

  it('moving a transaction to another account reverses source and applies destination once', async () => {
    ctx = await setupTestUserWithHousehold();
    const source = await insertAccount(ctx.userId, ctx.householdId, 100, 'Source');
    const dest = await insertAccount(ctx.userId, ctx.householdId, 200, 'Dest');

    await runInDatabaseTransaction(async (tx) => {
      await adjustUpdatedTransactionAccountBalances(tx, {
        transaction: fakeExpense(source),
        newAccountId: dest,
        oldAmountCents: 5000,
        newAmountCents: 6000,
      });
    });

    // Source reverses the old $50 expense: 100 + 50 = $150.
    expect(await balanceCents(source)).toBe(15000);
    // Dest applies the new $60 expense: 200 - 60 = $140.
    expect(await balanceCents(dest)).toBe(14000);
  });
});
