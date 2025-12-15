import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GET as GET_TRANSFERS_SUGGEST } from '@/app/api/transfers/suggest/route';

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
import { accounts, usageAnalytics } from '@/lib/db/schema';

describe('GET /api/transfers/suggest household scoping', () => {
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

          if (table === usageAnalytics) {
            return {
              orderBy: () => ({
                limit: async () => [
                  {
                    id: 'ua_1',
                    userId: TEST_USER_ID,
                    householdId: TEST_HOUSEHOLD_ID,
                    itemType: 'transfer_pair',
                    itemId: 'acct_from',
                    itemSecondaryId: 'acct_to',
                    usageCount: 5,
                    lastUsedAt: '2025-12-01T00:00:00.000Z',
                  },
                ],
              }),
            };
          }

          if (table === accounts) {
            return {
              limit: async () => [
                {
                  id: 'acct_from',
                  userId: TEST_USER_ID,
                  householdId: TEST_HOUSEHOLD_ID,
                  name: 'Checking',
                  color: '#000000',
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

  it('scopes usage analytics and account enrichment by household', async () => {
    const request = {
      url: 'https://example.com/api/transfers/suggest?limit=10',
      headers: new Headers({ 'x-household-id': TEST_HOUSEHOLD_ID }),
    } as unknown as Request;

    const response = await GET_TRANSFERS_SUGGEST(request);
    expect(response.status).toBe(200);

    const selectCalls = (db as unknown as {
      __selectCalls: Array<{ table: unknown; whereArg: unknown }>;
    }).__selectCalls;

    const uaCall = selectCalls.find((c) => c.table === usageAnalytics);
    expect(uaCall).toBeTruthy();
    const uaWhere = util.inspect(uaCall!.whereArg, { depth: 8, colors: false }).toLowerCase();
    expect(uaWhere).toContain('household');
    expect(uaWhere).toContain('user');

    const accountCalls = selectCalls.filter((c) => c.table === accounts);
    expect(accountCalls.length).toBeGreaterThan(0);

    for (const call of accountCalls) {
      const whereStr = util.inspect(call.whereArg, { depth: 8, colors: false }).toLowerCase();
      expect(whereStr).toContain('household');
      expect(whereStr).toContain('user');
    }

    expect(getAndVerifyHousehold).toHaveBeenCalledTimes(1);
  });
});
