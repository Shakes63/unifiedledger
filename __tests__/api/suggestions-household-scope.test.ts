import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GET as GET_SUGGESTIONS } from '@/app/api/suggestions/route';

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
import { budgetCategories, merchants, usageAnalytics } from '@/lib/db/schema';

describe('GET /api/suggestions household scoping', () => {
  const TEST_USER_ID = 'user_1';
  const TEST_HOUSEHOLD_ID = 'hh_1';

  beforeEach(() => {
    vi.clearAllMocks();

    (requireAuth as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      userId: TEST_USER_ID,
    });

    (getAndVerifyHousehold as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      householdId: TEST_HOUSEHOLD_ID,
    });

    const selectCalls: Array<{ table: unknown; whereArg: unknown }> = [];

    const fromMock = vi.fn((table: unknown) => {
      return {
        where: (whereArg: unknown) => {
          selectCalls.push({ table, whereArg });

          const rows =
            table === merchants
              ? [
                  {
                    id: 'm_1',
                    userId: TEST_USER_ID,
                    householdId: TEST_HOUSEHOLD_ID,
                    name: 'Coffee Shop',
                    normalizedName: 'coffee shop',
                    usageCount: 10,
                    averageTransaction: 4.25,
                  },
                ]
              : table === budgetCategories
                ? [
                    {
                      id: 'cat_1',
                      userId: TEST_USER_ID,
                      householdId: TEST_HOUSEHOLD_ID,
                      name: 'Coffee',
                      usageCount: 7,
                    },
                  ]
                : table === usageAnalytics
                  ? [{ id: 'ua_1', userId: TEST_USER_ID, householdId: TEST_HOUSEHOLD_ID }]
                  : [];

          return {
            orderBy: () => ({
              limit: async () => rows,
            }),
            limit: async () => rows,
          };
        },
      };
    });

    (db.select as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      from: fromMock,
    });

    (db as unknown as { __selectCalls?: typeof selectCalls }).__selectCalls = selectCalls;
  });

  it('scopes merchants/categories/usageAnalytics lookups by household', async () => {
    const request = {
      url: 'https://example.com/api/suggestions?q=co&limit=10',
      headers: new Headers({ 'x-household-id': TEST_HOUSEHOLD_ID }),
    } as unknown as Request;

    const response = await GET_SUGGESTIONS(request);
    expect(response.status).toBe(200);

    const data = (await response.json()) as Array<{ type: string; label: string }>;
    expect(data.some((s) => s.type === 'merchant' && s.label === 'Coffee Shop')).toBe(true);
    expect(data.some((s) => s.type === 'category' && s.label === 'Coffee')).toBe(true);

    const selectCalls = (db as unknown as {
      __selectCalls: Array<{ table: unknown; whereArg: unknown }>;
    }).__selectCalls;

    const tables = [merchants, budgetCategories, usageAnalytics];
    for (const table of tables) {
      const call = selectCalls.find((c) => c.table === table);
      expect(call).toBeTruthy();
      const whereStr = util.inspect(call!.whereArg, { depth: 8, colors: false }).toLowerCase();
      expect(whereStr).toContain('household');
      expect(whereStr).toContain('user');
    }
  });
});
