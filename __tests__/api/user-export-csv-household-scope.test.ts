import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GET as GET_EXPORT_CSV } from '@/app/api/user/export/csv/route';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/api/household-auth', () => ({
  getAndVerifyHousehold: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

import util from 'node:util';

import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { accounts, budgetCategories, merchants } from '@/lib/db/schema';

describe('GET /api/user/export/csv household scoping', () => {
  const TEST_USER_ID = 'user_1';
  const TEST_HOUSEHOLD_ID = 'hh_1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when household header is missing (regression)', async () => {
    (requireAuth as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      userId: TEST_USER_ID,
    });

    (getAndVerifyHousehold as unknown as { mockImplementation: (fn: () => unknown) => void }).mockImplementation(
      () => {
        throw new Error('Household ID is required');
      }
    );

    const request = {
      url: 'https://example.com/api/user/export/csv?startDate=2025-12-01&endDate=2025-12-31',
      headers: new Headers(),
    } as unknown as Request;

    const response = await GET_EXPORT_CSV(request);
    expect(response.status).toBe(400);

    const json = (await response.json()) as { error: string };
    expect(json.error).toContain('Household ID is required');
  });

  it('scopes joins and where-clause by user + household', async () => {
    (requireAuth as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      userId: TEST_USER_ID,
    });

    (getAndVerifyHousehold as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      householdId: TEST_HOUSEHOLD_ID,
    });

    const joinCalls: Array<{ table: unknown; on: unknown }> = [];
    let whereArg: unknown = null;

    const query = {
      leftJoin: vi.fn((table: unknown, on: unknown) => {
        joinCalls.push({ table, on });
        return query;
      }),
      where: vi.fn((arg: unknown) => {
        whereArg = arg;
        return query;
      }),
      orderBy: vi.fn(async () => []),
    };

    const fromMock = vi.fn(() => query);

    (db.select as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      from: fromMock,
    });

    const request = {
      url: 'https://example.com/api/user/export/csv?startDate=2025-12-01&endDate=2025-12-31',
      headers: new Headers({ 'x-household-id': TEST_HOUSEHOLD_ID }),
    } as unknown as Request;

    const response = await GET_EXPORT_CSV(request);
    expect(response.status).toBe(200);

    expect(getAndVerifyHousehold).toHaveBeenCalledTimes(1);

    const whereStr = util.inspect(whereArg, { depth: 8, colors: false }).toLowerCase();
    expect(whereStr).toContain('user');
    expect(whereStr).toContain('household');

    // Ensure joins are constrained to scope (prevents cross-scope join leakage)
    expect(joinCalls.length).toBe(3);

    const accountJoin = joinCalls.find((c) => c.table === accounts);
    expect(accountJoin).toBeTruthy();
    const accountJoinStr = util.inspect(accountJoin!.on, { depth: 8, colors: false }).toLowerCase();
    expect(accountJoinStr).toContain('user');
    expect(accountJoinStr).toContain('household');

    const categoryJoin = joinCalls.find((c) => c.table === budgetCategories);
    expect(categoryJoin).toBeTruthy();
    const categoryJoinStr = util.inspect(categoryJoin!.on, { depth: 8, colors: false }).toLowerCase();
    expect(categoryJoinStr).toContain('user');
    expect(categoryJoinStr).toContain('household');

    const merchantJoin = joinCalls.find((c) => c.table === merchants);
    expect(merchantJoin).toBeTruthy();
    const merchantJoinStr = util.inspect(merchantJoin!.on, { depth: 8, colors: false }).toLowerCase();
    expect(merchantJoinStr).toContain('user');
    expect(merchantJoinStr).toContain('household');
  });
});


