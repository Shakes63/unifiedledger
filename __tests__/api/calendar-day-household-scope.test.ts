import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GET as GET_CALENDAR_DAY } from '@/app/api/calendar/day/route';

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
import { accounts, billInstances, bills } from '@/lib/db/schema';

type QueryResult<T> = PromiseLike<T[]> & { limit: (n: number) => Promise<T[]> };

function makeQueryResult<T>(rows: T[]): QueryResult<T> {
  return {
    then: (onfulfilled, onrejected) => Promise.resolve(rows).then(onfulfilled, onrejected),
    limit: async (n: number) => rows.slice(0, n),
  };
}

describe('GET /api/calendar/day household scoping', () => {
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

        if (table === billInstances) {
          // The route queries billInstances multiple times (overdue update aside).
          // We return one instance for the day so bill enrichment runs.
          return makeQueryResult([
            {
              id: 'bi_1',
              userId: TEST_USER_ID,
              householdId: TEST_HOUSEHOLD_ID,
              billId: 'bill_1',
              dueDate: '2025-12-01',
              expectedAmount: 25,
              status: 'pending',
            },
          ]);
        }

        if (table === bills) {
          return makeQueryResult([
            {
              id: 'bill_1',
              userId: TEST_USER_ID,
              householdId: TEST_HOUSEHOLD_ID,
              name: 'Internet',
              linkedAccountId: 'acct_1',
              isDebt: false,
              isAutopayEnabled: false,
              billType: 'expense',
            },
          ]);
        }

        if (table === accounts) {
          return makeQueryResult([
            {
              id: 'acct_1',
              userId: TEST_USER_ID,
              householdId: TEST_HOUSEHOLD_ID,
              name: 'Checking',
            },
          ]);
        }

        // Everything else: empty to keep route execution small.
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

    // Mock update(billInstances).set(...).where(...)
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

  it('scopes bill instance + bill + account lookups by household', async () => {
    const request = {
      url: 'https://example.com/api/calendar/day?date=2025-12-01',
      headers: new Headers({ 'x-household-id': TEST_HOUSEHOLD_ID }),
    } as unknown as Request;

    const response = await GET_CALENDAR_DAY(request);
    expect(response.status).toBe(200);

    expect(getAndVerifyHousehold).toHaveBeenCalledTimes(1);

    const selectCalls = (db as unknown as {
      __selectCalls: Array<{ table: unknown; whereArg: unknown }>;
    }).__selectCalls;

    const billInstanceSelect = selectCalls.find((c) => c.table === billInstances);
    expect(billInstanceSelect).toBeTruthy();
    const biWhere = util.inspect(billInstanceSelect!.whereArg, { depth: 8, colors: false }).toLowerCase();
    expect(biWhere).toContain('household');
    expect(biWhere).toContain('user');

    const billSelect = selectCalls.find((c) => c.table === bills);
    expect(billSelect).toBeTruthy();
    const billWhere = util.inspect(billSelect!.whereArg, { depth: 8, colors: false }).toLowerCase();
    expect(billWhere).toContain('household');
    expect(billWhere).toContain('user');

    const accountSelect = selectCalls.find((c) => c.table === accounts);
    expect(accountSelect).toBeTruthy();
    const acctWhere = util.inspect(accountSelect!.whereArg, { depth: 8, colors: false }).toLowerCase();
    expect(acctWhere).toContain('household');
    expect(acctWhere).toContain('user');

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
