/**
 * Bug-hunt findings A2/M5: a confirmed CSV import could never be undone.
 * `status: 'rolled_back'` and `rolledBackAt` were declared in the schema and
 * never written by anything — there was no rollback route at all — so an import
 * that corrupted balances was permanent.
 *
 * These tests drive the real POST handler against the real database.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { accounts, importHistory, importStaging, transactions } from '@/lib/db/schema';
import { setupTestUserWithHousehold, cleanupTestHousehold } from './test-utils';

// Real DB; mocks only auth + household verification, matching the sibling
// csv-import-balance integration test.
vi.mock('@/lib/auth-helpers', () => ({ requireAuth: vi.fn() }));
vi.mock('@/lib/api/household-auth', () => ({
  requireHouseholdAuth: vi.fn(),
  getHouseholdIdFromRequest: vi.fn(),
  getAndVerifyHousehold: vi.fn(),
}));
import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest } from '@/lib/api/household-auth';
import { POST as rollback } from '@/app/api/csv-import/[importId]/rollback/route';

describe('CSV import rollback (A2/M5)', () => {
  let ctx: { userId: string; householdId: string } | null = null;

  afterEach(async () => {
    if (ctx) {
      await db.delete(transactions).where(eq(transactions.householdId, ctx.householdId));
      await db.delete(importStaging).where(eq(importStaging.importHistoryId, 'imp-1'));
      await db.delete(importHistory).where(eq(importHistory.userId, ctx.userId));
      await db.delete(accounts).where(eq(accounts.householdId, ctx.householdId));
      await cleanupTestHousehold(ctx.userId, ctx.householdId);
      ctx = null;
    }
  });

  async function seedImport(accountType: string, rows: Array<{ type: string; cents: number }>) {
    ctx = await setupTestUserWithHousehold();
    vi.mocked(requireAuth).mockResolvedValue({ userId: ctx.userId } as never);
    vi.mocked(getHouseholdIdFromRequest).mockReturnValue(ctx.householdId);
    const accountId = nanoid();
    await db.insert(accounts).values({
      id: accountId,
      userId: ctx.userId,
      householdId: ctx.householdId,
      name: 'Imported Account',
      type: accountType,
      bankName: 'Test',
      currentBalance: 1000,
      currentBalanceCents: 100000,
    } as typeof accounts.$inferInsert);

    await db.insert(importHistory).values({
      id: 'imp-1',
      userId: ctx.userId,
      householdId: ctx.householdId,
      filename: 'statement.csv',
      rowsTotal: rows.length,
      rowsImported: rows.length,
      rowsSkipped: 0,
      rowsDuplicates: 0,
      status: 'completed',
    } as typeof importHistory.$inferInsert);

    for (const [index, row] of rows.entries()) {
      await db.insert(transactions).values({
        id: nanoid(),
        userId: ctx.userId,
        householdId: ctx.householdId,
        accountId,
        date: '2026-01-05',
        description: `ROW ${index + 1}`,
        type: row.type,
        amount: row.cents / 100,
        amountCents: row.cents,
        importHistoryId: 'imp-1',
        importRowNumber: index + 1,
      } as typeof transactions.$inferInsert);

      await db.insert(importStaging).values({
        id: nanoid(),
        importHistoryId: 'imp-1',
        rowNumber: index + 1,
        rawData: '{}',
        mappedData: '{}',
        status: 'imported',
      } as typeof importStaging.$inferInsert);
    }
    return accountId;
  }

  const call = async () =>
    rollback(
      {
        headers: new Headers({ 'x-household-id': ctx!.householdId }),
        url: 'http://localhost/api/csv-import/imp-1/rollback',
      } as unknown as Request,
      { params: Promise.resolve({ importId: 'imp-1' }) }
    );

  it('removes the imported transactions and restores the asset balance', async () => {
    // Two expenses totalling $150 were applied against an opening $1,000.
    const accountId = await seedImport('checking', [
      { type: 'expense', cents: 10000 },
      { type: 'expense', cents: 5000 },
    ]);
    // Balance as it would stand after the import.
    await db
      .update(accounts)
      .set({ currentBalanceCents: 85000, currentBalance: 850 })
      .where(eq(accounts.id, accountId));

    const response = await call();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ transactionsRemoved: 2 });

    const remaining = await db
      .select()
      .from(transactions)
      .where(eq(transactions.importHistoryId, 'imp-1'));
    expect(remaining).toHaveLength(0);

    const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
    expect(account.currentBalanceCents).toBe(100000);
  });

  it('restores a LIABILITY balance under the positive-owed convention', async () => {
    // On a credit account a $200 purchase raises what you owe.
    // NOTE: the liability enum value is 'credit', not 'credit_card'.
    const accountId = await seedImport('credit', [{ type: 'expense', cents: 20000 }]);
    await db
      .update(accounts)
      .set({ currentBalanceCents: 120000, currentBalance: 1200 })
      .where(eq(accounts.id, accountId));

    await call();

    const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
    expect(account.currentBalanceCents).toBe(100000);
  });

  it('marks the import rolled_back and returns staging rows to approved', async () => {
    await seedImport('checking', [{ type: 'expense', cents: 10000 }]);

    await call();

    const [record] = await db
      .select()
      .from(importHistory)
      .where(eq(importHistory.id, 'imp-1'));
    expect(record.status).toBe('rolled_back');
    expect(record.rolledBackAt).toBeTruthy();
    expect(record.rowsImported).toBe(0);

    const staging = await db
      .select()
      .from(importStaging)
      .where(eq(importStaging.importHistoryId, 'imp-1'));
    expect(staging.every((row) => row.status === 'approved')).toBe(true);
  });

  it('refuses to roll back the same import twice', async () => {
    await seedImport('checking', [{ type: 'expense', cents: 10000 }]);

    expect((await call()).status).toBe(200);
    const second = await call();
    expect(second.status).toBe(409);
  });
});
