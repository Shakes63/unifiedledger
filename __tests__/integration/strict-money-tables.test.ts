/**
 * Migration 0019 converted the 12 money tables to SQLite STRICT tables. The
 * type flexibility that enabled the original corruption class (a float like
 * 3332.999... or garbage text landing in an INTEGER cents column) must now be
 * rejected by the DATABASE, not just by app-level validation.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { transactions } from '@/lib/db/schema';
import {
  setupTestUserWithHousehold,
  cleanupTestHousehold,
  createTestTransaction,
} from './test-utils';

const MONEY_TABLES = [
  'accounts',
  'transactions',
  'debts',
  'savings_goals',
  'bill_occurrences',
  'transaction_splits',
  'transaction_tags',
  'custom_field_values',
  'debt_payments',
  'savings_goal_contributions',
  'bill_payment_events',
  'transfers',
];

describe('STRICT money tables (migration 0019)', () => {
  it('every money table is declared STRICT', async () => {
    for (const table of MONEY_TABLES) {
      const row = (await db.get(
        sql`SELECT sql AS ddl FROM sqlite_master WHERE type = 'table' AND name = ${table}`
      )) as { ddl: string } | undefined;
      expect(row, `${table} should exist`).toBeTruthy();
      // Anchored check — LIKE '%STRICT%' would false-positive on names like
      // special_district_rate.
      expect(
        /\)\s*STRICT\s*;?\s*$/i.test(row!.ddl),
        `${table} should be STRICT`
      ).toBe(true);
    }
  });

  describe('write-time type enforcement', () => {
    let ctx: { userId: string; householdId: string };
    let txId: string;

    beforeEach(async () => {
      ctx = await setupTestUserWithHousehold();
      const tx = createTestTransaction(ctx.userId, ctx.householdId, 'acct-x', {
        type: 'expense',
        amount: 10,
      });
      txId = tx.id;
      await db.insert(transactions).values(tx as typeof transactions.$inferInsert);
    });

    afterEach(async () => {
      await db.delete(transactions).where(eq(transactions.householdId, ctx.householdId));
      await cleanupTestHousehold(ctx.userId, ctx.householdId);
    });

    // The sync better-sqlite3 driver throws EAGERLY from db.run, and drizzle
    // wraps the SqliteError — so take a thunk and assert on the error code.
    async function expectDatatypeRejection(run: () => Promise<unknown>): Promise<void> {
      let error: unknown = null;
      try {
        await run();
      } catch (e) {
        error = e;
      }
      expect(error, 'the write should have been rejected').toBeTruthy();
      const code =
        (error as { code?: string }).code ??
        ((error as { cause?: { code?: string } }).cause?.code ?? '');
      expect(code).toBe('SQLITE_CONSTRAINT_DATATYPE');
    }

    it('rejects a fractional float written into an INTEGER cents column', async () => {
      // 33.33 * 100 in float land is 3332.9999999999995 — the exact drift the
      // cents migration exists to prevent. Pre-STRICT this stored silently;
      // now the DB errors. (STRICT checks fire per row actually written, which
      // is why this targets a real row.)
      await expectDatatypeRejection(() =>
        db.run(
          sql`UPDATE transactions SET amount_cents = ${33.33 * 100 + 0.0000000001} WHERE id = ${txId}`
        )
      );
    });

    it('rejects garbage text written into a REAL amount column', async () => {
      await expectDatatypeRejection(() =>
        db.run(
          sql`UPDATE transactions SET amount = ${'not-a-number'} WHERE id = ${txId}`
        )
      );
    });
  });
});
