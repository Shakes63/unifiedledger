import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GET as GET_VALUES } from '@/app/api/custom-field-values/route';

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
import { customFieldValues, transactions } from '@/lib/db/schema';

type QueryResult<T> = PromiseLike<T[]> & { limit: (n: number) => Promise<T[]> };

function makeQueryResult<T>(rows: T[]): QueryResult<T> {
  return {
    then: (onfulfilled, onrejected) => Promise.resolve(rows).then(onfulfilled, onrejected),
    limit: async (n: number) => rows.slice(0, n),
  };
}

describe('GET /api/custom-field-values scoping', () => {
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

          if (table === transactions) {
            return makeQueryResult([
              { id: 'tx_1', userId: TEST_USER_ID, householdId: TEST_HOUSEHOLD_ID },
            ]);
          }

          if (table === customFieldValues) {
            return makeQueryResult([
              { id: 'cfv_1', userId: TEST_USER_ID, transactionId: 'tx_1', value: '"x"' },
            ]);
          }

          return makeQueryResult([]);
        },
      };
    });

    (db.select as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      from: fromMock,
    });

    (db as unknown as { __selectCalls?: typeof selectCalls }).__selectCalls = selectCalls;
  });

  it('scopes values query by userId (and transaction validation by household)', async () => {
    const request = {
      url: 'https://example.com/api/custom-field-values?transactionId=tx_1',
      headers: new Headers({ 'x-household-id': TEST_HOUSEHOLD_ID }),
    } as unknown as Request;

    const response = await GET_VALUES(request);
    expect(response.status).toBe(200);

    const selectCalls = (db as unknown as {
      __selectCalls: Array<{ table: unknown; whereArg: unknown }>;
    }).__selectCalls;

    const txCall = selectCalls.find((c) => c.table === transactions);
    expect(txCall).toBeTruthy();
    const txWhere = util.inspect(txCall!.whereArg, { depth: 8, colors: false }).toLowerCase();
    expect(txWhere).toContain('household');
    expect(txWhere).toContain('user');

    const valuesCall = selectCalls.find((c) => c.table === customFieldValues);
    expect(valuesCall).toBeTruthy();
    const valuesWhere = util.inspect(valuesCall!.whereArg, { depth: 8, colors: false }).toLowerCase();
    expect(valuesWhere).toContain('user');

    expect(getAndVerifyHousehold).toHaveBeenCalledTimes(1);
  });
});
