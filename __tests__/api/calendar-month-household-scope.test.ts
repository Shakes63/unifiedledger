import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GET as GET_CALENDAR_MONTH } from '@/app/api/calendar/month/route';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/api/household-auth', () => ({
  getAndVerifyHousehold: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

import util from 'node:util';

import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { accounts, billInstances, billMilestones, bills, transactions } from '@/lib/db/schema';

type QueryResult<T> = PromiseLike<T[]> & { limit?: (n: number) => Promise<T[]> };

function makeQueryResult<T>(rows: T[]): QueryResult<T> {
  return {
    then: (onfulfilled, onrejected) => Promise.resolve(rows).then(onfulfilled, onrejected),
  };
}

describe('GET /api/calendar/month household scoping', () => {
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
      const where = (whereArg: unknown) => {
        selectCalls.push({ table, whereArg });

        if (table === billMilestones) {
          return makeQueryResult([
            {
              id: 'bm_1',
              userId: TEST_USER_ID,
              householdId: TEST_HOUSEHOLD_ID,
              billId: 'bill_1',
              accountId: 'acct_1',
              percentage: 50,
              achievedAt: '2025-12-05T12:00:00.000Z',
            },
          ]);
        }

        // Keep the rest empty to keep route execution small.
        return makeQueryResult([]);
      };

      return {
        where,
        innerJoin: () => ({ where }),
      };
    });

    (db.select as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      from: fromMock,
    });

    const updateWhereCalls: Array<{ table: unknown; whereArg: unknown }> = [];

    (db.update as unknown as {
      mockImplementation: (fn: (table: unknown) => unknown) => void;
    }).mockImplementation((table: unknown) => {
      return {
        set: () => ({
          where: async (whereArg: unknown) => {
            updateWhereCalls.push({ table, whereArg });
            return undefined;
          },
        }),
      };
    });

    (db as unknown as { __selectCalls?: typeof selectCalls }).__selectCalls = selectCalls;
    (db as unknown as { __updateWhereCalls?: typeof updateWhereCalls }).__updateWhereCalls = updateWhereCalls;
  });

  it('scopes month queries and milestone enrichment by household', async () => {
    const request = {
      url: 'https://example.com/api/calendar/month?startDate=2025-12-01&endDate=2025-12-31',
      headers: new Headers({ 'x-household-id': TEST_HOUSEHOLD_ID }),
    } as unknown as Request;

    const response = await GET_CALENDAR_MONTH(request);
    expect(response.status).toBe(200);

    expect(getAndVerifyHousehold).toHaveBeenCalledTimes(1);

    const selectCalls = (db as unknown as {
      __selectCalls: Array<{ table: unknown; whereArg: unknown }>;
    }).__selectCalls;

    const txnSelect = selectCalls.find((c) => c.table === transactions);
    expect(txnSelect).toBeTruthy();
    const txnWhere = util.inspect(txnSelect!.whereArg, { depth: 8, colors: false }).toLowerCase();
    expect(txnWhere).toContain('household');
    expect(txnWhere).toContain('user');

    // We should scope every accounts/bills select in this handler (including milestone enrichment)
    const anyBillsSelects = selectCalls.filter((c) => c.table === bills);
    expect(anyBillsSelects.length).toBeGreaterThan(0);
    for (const call of anyBillsSelects) {
      const whereStr = util.inspect(call.whereArg, { depth: 8, colors: false }).toLowerCase();
      expect(whereStr).toContain('household');
      expect(whereStr).toContain('user');
    }

    const anyAccountsSelects = selectCalls.filter((c) => c.table === accounts);
    expect(anyAccountsSelects.length).toBeGreaterThan(0);
    for (const call of anyAccountsSelects) {
      const whereStr = util.inspect(call.whereArg, { depth: 8, colors: false }).toLowerCase();
      expect(whereStr).toContain('household');
      expect(whereStr).toContain('user');
    }

    const anyBillInstancesSelects = selectCalls.filter((c) => c.table === billInstances);
    expect(anyBillInstancesSelects.length).toBeGreaterThan(0);
    for (const call of anyBillInstancesSelects) {
      const whereStr = util.inspect(call.whereArg, { depth: 8, colors: false }).toLowerCase();
      expect(whereStr).toContain('household');
      expect(whereStr).toContain('user');
    }

    const updateWhereCalls = (db as unknown as {
      __updateWhereCalls: Array<{ table: unknown; whereArg: unknown }>;
    }).__updateWhereCalls;

    const billInstanceUpdate = updateWhereCalls.find((c) => c.table === billInstances);
    expect(billInstanceUpdate).toBeTruthy();
    const updateWhere = util
      .inspect(billInstanceUpdate!.whereArg, { depth: 8, colors: false })
      .toLowerCase();
    expect(updateWhere).toContain('household');
    expect(updateWhere).toContain('user');
  });
});
