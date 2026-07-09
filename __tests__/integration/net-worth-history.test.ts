/**
 * M-RPT-10: the net-worth chart previously repeated the CURRENT value for every
 * point. It now derives real history from the ledger: net worth at a past date =
 * current - net income/expense after that date. The series must vary and end at
 * the current value.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { accounts, transactions } from '@/lib/db/schema';
import {
  createTestAccount,
  createTestTransaction,
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
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';

describe('net-worth history is derived from the ledger (M-RPT-10)', () => {
  let ctx: { userId: string; householdId: string };

  beforeEach(async () => {
    ctx = await setupTestUserWithHousehold();
    (requireAuth as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      userId: ctx.userId,
    });
    (getHouseholdIdFromRequest as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      ctx.householdId
    );
    (requireHouseholdAuth as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      userId: ctx.userId,
      householdId: ctx.householdId,
    });
  });

  afterEach(async () => {
    await db.delete(accounts).where(eq(accounts.householdId, ctx.householdId));
    await cleanupTestHousehold(ctx.userId, ctx.householdId);
  });

  it('produces a varying series that ends at the current net worth', async () => {
    // Current balance $1,000. A $300 income arrived recently, so net worth was
    // LOWER before it — the series must reflect that, not be flat at $1,000.
    const account = createTestAccount(ctx.userId, ctx.householdId, { currentBalance: 1000 });
    await db.insert(accounts).values(account as typeof accounts.$inferInsert);

    const ymd = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const daysAgo = (n: number) => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return d;
    };
    // Range spans ~3 months up to today; the $300 income arrived 10 days ago
    // (safely in the past so `date <= today` includes it).
    const startDate = ymd(daysAgo(90));
    const endDate = ymd(new Date());

    await db.insert(transactions).values(
      createTestTransaction(ctx.userId, ctx.householdId, account.id as string, {
        amount: 300,
        type: 'income',
        date: ymd(daysAgo(10)),
      }) as typeof transactions.$inferInsert
    );

    const { GET } = await import('@/app/api/reports/net-worth/route');
    const url = `http://localhost/api/reports/net-worth?startDate=${startDate}&endDate=${endDate}`;
    const req = {
      nextUrl: new URL(url),
      headers: new Headers({ 'x-household-id': ctx.householdId }),
      url,
    } as unknown as import('next/server').NextRequest;
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.currentNetWorth).toBe(1000);
    expect(body.history.length).toBeGreaterThanOrEqual(2);

    const worths = body.history.map((p: { netWorth: number }) => p.netWorth);
    // Not flat (the bug produced all-1000).
    expect(new Set(worths).size).toBeGreaterThan(1);
    // The earliest month reflects net worth BEFORE the $300 arrived.
    expect(worths[0]).toBe(700);
    // The last point equals current net worth.
    expect(worths[worths.length - 1]).toBe(1000);
  });
});
