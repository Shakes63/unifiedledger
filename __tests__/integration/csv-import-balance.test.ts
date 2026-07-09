/**
 * C-IMP-1 / H-IMP-2: confirming a CSV import must apply the imported
 * transactions' balance effects to the account (previously balances never
 * changed), and re-confirming the same rows must not double-import.
 * Real DB; mocks only auth + household verification.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import {
  accounts,
  importHistory,
  importStaging,
  transactions,
} from '@/lib/db/schema';
import { getAccountBalanceCents } from '@/lib/transactions/money-movement-service';
import {
  createTestAccount,
  setupTestUserWithHousehold,
  cleanupTestHousehold,
} from './test-utils';

vi.mock('@/lib/auth-helpers', () => ({ requireAuth: vi.fn() }));
vi.mock('@/lib/api/household-auth', () => ({
  requireHouseholdAuth: vi.fn(),
  getHouseholdIdFromRequest: vi.fn(),
  getAndVerifyHousehold: vi.fn(),
}));
import { requireAuth } from '@/lib/auth-helpers';
import { requireHouseholdAuth } from '@/lib/api/household-auth';

describe('CSV import confirm updates balances (C-IMP-1)', () => {
  let ctx: { userId: string; householdId: string };
  let accountId: string;
  let importId: string;

  beforeEach(async () => {
    ctx = await setupTestUserWithHousehold();
    (requireAuth as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      userId: ctx.userId,
    });
    (requireHouseholdAuth as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      userId: ctx.userId,
      householdId: ctx.householdId,
    });

    const account = createTestAccount(ctx.userId, ctx.householdId, { currentBalance: 1000 });
    await db.insert(accounts).values(account as typeof accounts.$inferInsert);
    accountId = account.id as string;

    importId = nanoid();
    await db.insert(importHistory).values({
      id: importId,
      userId: ctx.userId,
      householdId: ctx.householdId,
      filename: 'test.csv',
      rowsTotal: 1,
      rowsImported: 0,
      rowsSkipped: 0,
      rowsDuplicates: 0,
      status: 'pending',
      createdAt: new Date().toISOString(),
    } as typeof importHistory.$inferInsert);

    await db.insert(importStaging).values({
      id: nanoid(),
      importHistoryId: importId,
      userId: ctx.userId,
      rowNumber: 1,
      status: 'approved',
      mappedData: JSON.stringify({
        description: 'Groceries',
        amount: 40,
        accountId,
        accountName: 'Test Checking',
        date: '2026-03-01',
        notes: null,
        type: 'expense',
        category: null,
      }),
      rawData: '{}',
      createdAt: new Date().toISOString(),
    } as typeof importStaging.$inferInsert);
  });

  afterEach(async () => {
    await db.delete(importStaging).where(eq(importStaging.importHistoryId, importId));
    await db.delete(importHistory).where(eq(importHistory.id, importId));
    await db.delete(accounts).where(eq(accounts.householdId, ctx.householdId));
    await cleanupTestHousehold(ctx.userId, ctx.householdId);
  });

  async function balance(): Promise<number> {
    const [row] = await db
      .select({ currentBalanceCents: accounts.currentBalanceCents })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);
    return getAccountBalanceCents(row);
  }

  async function confirm(): Promise<Response> {
    const { POST } = await import('@/app/api/csv-import/[importId]/confirm/route');
    return POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ recordIds: ['1'] }),
      }),
      { params: Promise.resolve({ importId }) }
    );
  }

  it('applies the imported expense to the account balance', async () => {
    expect(await balance()).toBe(100000); // $1,000 before

    const res = await confirm();
    expect(res.status).toBe(200);

    // $40 expense imported -> $960. Previously the balance stayed $1,000 forever.
    expect(await balance()).toBe(96000);

    const imported = await db
      .select()
      .from(transactions)
      .where(eq(transactions.importHistoryId, importId));
    expect(imported).toHaveLength(1);
    expect(imported[0].amountCents).toBe(4000);
  });

  it('re-confirming the same rows does not double-import or double-apply (H-IMP-2)', async () => {
    await confirm();
    expect(await balance()).toBe(96000);

    // Second confirm with the same recordIds: previously duplicated every row.
    const res2 = await confirm();
    // No rows left to import -> 400 "No records to import" (or 200 with 0);
    // either way the balance and row count must be unchanged.
    expect([200, 400]).toContain(res2.status);
    expect(await balance()).toBe(96000);

    const imported = await db
      .select()
      .from(transactions)
      .where(eq(transactions.importHistoryId, importId));
    expect(imported).toHaveLength(1);
  });
});
