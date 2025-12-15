import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GET as GET_SPENDING_SUMMARY } from '@/app/api/spending-summary/route';

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
import { budgetCategories, transactions } from '@/lib/db/schema';

describe('GET /api/spending-summary household scoping', () => {
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
        where: async (whereArg: unknown) => {
          selectCalls.push({ table, whereArg });

          if (table === transactions) {
            return [
              {
                id: 'tx_1',
                userId: TEST_USER_ID,
                householdId: TEST_HOUSEHOLD_ID,
                type: 'expense',
                amount: 12.34,
                date: '2025-12-01',
                description: 'Coffee Shop',
                categoryId: 'cat_1',
              },
            ];
          }

          if (table === budgetCategories) {
            return [
              {
                id: 'cat_1',
                name: 'Food & Drink',
                userId: TEST_USER_ID,
                householdId: TEST_HOUSEHOLD_ID,
              },
            ];
          }

          return [];
        },
      };
    });

    (db.select as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      from: fromMock,
    });

    (db as unknown as { __selectCalls?: typeof selectCalls }).__selectCalls = selectCalls;
  });

  it('scopes transactions + categories queries by household', async () => {
    const request = {
      url: 'https://example.com/api/spending-summary?period=monthly&date=2025-12-01',
      headers: new Headers({ 'x-household-id': TEST_HOUSEHOLD_ID }),
    } as unknown as Request;

    const response = await GET_SPENDING_SUMMARY(request);
    expect(response.status).toBe(200);

    expect(getAndVerifyHousehold).toHaveBeenCalledTimes(1);

    const json = (await response.json()) as {
      byCategory: Array<{ categoryId: string; categoryName: string }>;
    };

    expect(json.byCategory[0]?.categoryId).toBe('cat_1');
    expect(json.byCategory[0]?.categoryName).toBe('Food & Drink');

    const selectCalls = (db as unknown as {
      __selectCalls: Array<{ table: unknown; whereArg: unknown }>;
    }).__selectCalls;

    const txnSelect = selectCalls.find((c) => c.table === transactions);
    expect(txnSelect).toBeTruthy();

    const txnWhere = util.inspect(txnSelect!.whereArg, { depth: 8, colors: false }).toLowerCase();
    expect(txnWhere).toContain('household');
    expect(txnWhere).toContain('user');

    const categorySelect = selectCalls.find((c) => c.table === budgetCategories);
    expect(categorySelect).toBeTruthy();

    const categoryWhere = util
      .inspect(categorySelect!.whereArg, { depth: 8, colors: false })
      .toLowerCase();
    expect(categoryWhere).toContain('household');
    expect(categoryWhere).toContain('user');
  });
});
