import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GET as GET_CATEGORIZATION_SUGGEST } from '@/app/api/categorization/suggest/route';

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
import { budgetCategories, merchants, transactions } from '@/lib/db/schema';

describe('GET /api/categorization/suggest household scoping', () => {
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

          if (table === merchants) {
            return {
              limit: async () => [
                {
                  id: 'm_1',
                  userId: TEST_USER_ID,
                  householdId: TEST_HOUSEHOLD_ID,
                  name: 'Coffee Shop',
                  normalizedName: 'coffee shop',
                },
              ],
            };
          }

          if (table === transactions) {
            return [
              {
                id: 'tx_1',
                userId: TEST_USER_ID,
                householdId: TEST_HOUSEHOLD_ID,
                description: 'Coffee Shop',
                categoryId: 'cat_1',
              },
              {
                id: 'tx_2',
                userId: TEST_USER_ID,
                householdId: TEST_HOUSEHOLD_ID,
                description: 'Coffee Shop',
                categoryId: 'cat_1',
              },
            ];
          }

          if (table === budgetCategories) {
            return {
              limit: async () => [
                {
                  id: 'cat_1',
                  userId: TEST_USER_ID,
                  householdId: TEST_HOUSEHOLD_ID,
                  name: 'Food & Drink',
                },
              ],
            };
          }

          return { limit: async () => [] };
        },
      };
    });

    (db.select as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      from: fromMock,
    });

    (db as unknown as { __selectCalls?: typeof selectCalls }).__selectCalls = selectCalls;
  });

  it('scopes merchant/history/category queries by household', async () => {
    const request = {
      url: 'https://example.com/api/categorization/suggest?description=Coffee%20Shop',
      headers: new Headers({ 'x-household-id': TEST_HOUSEHOLD_ID }),
    } as unknown as Request;

    const response = await GET_CATEGORIZATION_SUGGEST(request);
    expect(response.status).toBe(200);

    const json = (await response.json()) as null | {
      categoryId: string;
      categoryName: string;
      confidence: number;
      frequency: number;
    };

    expect(json).not.toBeNull();
    expect(json!.categoryId).toBe('cat_1');
    expect(json!.categoryName).toBe('Food & Drink');

    const selectCalls = (db as unknown as {
      __selectCalls: Array<{ table: unknown; whereArg: unknown }>;
    }).__selectCalls;

    for (const table of [merchants, transactions, budgetCategories]) {
      const call = selectCalls.find((c) => c.table === table);
      expect(call).toBeTruthy();
      const whereStr = util.inspect(call!.whereArg, { depth: 8, colors: false }).toLowerCase();
      expect(whereStr).toContain('household');
      expect(whereStr).toContain('user');
    }

    expect(getAndVerifyHousehold).toHaveBeenCalledTimes(1);
  });
});
