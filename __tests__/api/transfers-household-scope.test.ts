import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GET as GET_TRANSFERS, POST as POST_TRANSFERS } from '@/app/api/transfers/route';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/api/household-auth', () => ({
  getAndVerifyHousehold: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    transaction: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

import util from 'node:util';

import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { accounts, transfers, usageAnalytics } from '@/lib/db/schema';

describe('Transfers API household scoping', () => {
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

    (db.insert as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      values: async () => undefined,
    });
    (db.update as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      set: () => ({
        where: async () => undefined,
      }),
    });
  });

  it('GET /api/transfers scopes transfers and account enrichment by household', async () => {
    const selectCalls: Array<{ table: unknown; whereArg: unknown }> = [];
    let transferSelectCount = 0;

    (db.select as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      from: (table: unknown) => ({
        where: (whereArg: unknown) => {
          selectCalls.push({ table, whereArg });

          if (table === transfers) {
            transferSelectCount += 1;
            if (transferSelectCount === 1) {
              return Promise.resolve([{ id: 'tr_count_1' }, { id: 'tr_count_2' }]);
            }

            return {
              orderBy: () => ({
                limit: () => ({
                  offset: async () => [
                    {
                      id: 'tr_1',
                      userId: TEST_USER_ID,
                      householdId: TEST_HOUSEHOLD_ID,
                      fromAccountId: 'acct_from',
                      toAccountId: 'acct_to',
                      amount: 10,
                      amountCents: 1000,
                      date: '2026-01-01',
                    },
                  ],
                }),
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
                    currentBalance: 100,
                    currentBalanceCents: 10000,
                  },
                ],
              };
          }

          return { limit: async () => [] };
        },
      }),
    });

    const request = {
      url: 'https://example.com/api/transfers?limit=10&offset=0',
      headers: new Headers({ 'x-household-id': TEST_HOUSEHOLD_ID }),
    } as unknown as Request;

    const response = await GET_TRANSFERS(request);
    expect(response.status).toBe(200);

    const transferCalls = selectCalls.filter((c) => c.table === transfers);
    expect(transferCalls.length).toBeGreaterThan(0);

    for (const call of transferCalls) {
      const whereStr = util.inspect(call.whereArg, { depth: 8, colors: false }).toLowerCase();
      expect(whereStr).toContain('household');
      expect(whereStr).toContain('user');
    }

    const accountCalls = selectCalls.filter((c) => c.table === accounts);
    expect(accountCalls.length).toBeGreaterThan(0);

    for (const call of accountCalls) {
      const whereStr = util.inspect(call.whereArg, { depth: 8, colors: false }).toLowerCase();
      expect(whereStr).toContain('household');
      expect(whereStr).toContain('user');
    }
  });

  it('POST /api/transfers scopes account validation and transfer writes by household', async () => {
    const selectCalls: Array<{ table: unknown; whereArg: unknown }> = [];
    const txInsertCalls: Array<{ table: unknown; values: unknown }> = [];
    const txUpdateCalls: Array<{ table: unknown; whereArg: unknown }> = [];

    (db.select as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      from: (table: unknown) => ({
        where: (whereArg: unknown) => {
          selectCalls.push({ table, whereArg });
          if (table === accounts) {
            return {
              limit: async () => [
                {
                  id: 'acct_1',
                  userId: TEST_USER_ID,
                  householdId: TEST_HOUSEHOLD_ID,
                  name: 'Checking',
                  currentBalance: 100,
                  currentBalanceCents: 10000,
                },
              ],
            };
          }

          return { limit: async () => [] };
        },
      }),
    });

    const tx = {
      insert: (table: unknown) => ({
        values: async (values: unknown) => {
          txInsertCalls.push({ table, values });
          return undefined;
        },
      }),
      update: (table: unknown) => ({
        set: () => ({
          where: async (whereArg: unknown) => {
            txUpdateCalls.push({ table, whereArg });
            return undefined;
          },
        }),
      }),
      select: () => ({
        from: (_table: unknown) => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      }),
    };

    (db.transaction as unknown as {
      mockImplementation: (fn: (tx: unknown) => Promise<unknown>) => void;
    }).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return await fn(tx);
    });

    const request = {
      url: 'https://example.com/api/transfers',
      headers: new Headers({ 'x-household-id': TEST_HOUSEHOLD_ID }),
      json: async () => ({
        fromAccountId: 'acct_1',
        toAccountId: 'acct_2',
        amount: 25,
        date: '2026-01-01',
        householdId: TEST_HOUSEHOLD_ID,
      }),
    } as unknown as Request;

    const response = await POST_TRANSFERS(request);
    expect(response.status).toBe(201);

    const accountSelectCalls = selectCalls.filter((c) => c.table === accounts);
    expect(accountSelectCalls.length).toBeGreaterThan(0);
    for (const call of accountSelectCalls) {
      const whereStr = util.inspect(call.whereArg, { depth: 8, colors: false }).toLowerCase();
      expect(whereStr).toContain('household');
      expect(whereStr).toContain('user');
    }

    const transferInsert = txInsertCalls.find((c) => c.table === transfers);
    expect(transferInsert).toBeTruthy();
    const transferValues = transferInsert!.values as { householdId?: string };
    expect(transferValues.householdId).toBe(TEST_HOUSEHOLD_ID);

    const usageSelect = selectCalls.find((c) => c.table === usageAnalytics);
    expect(usageSelect).toBeTruthy();
    const usageWhere = util.inspect(usageSelect!.whereArg, { depth: 8, colors: false }).toLowerCase();
    expect(usageWhere).toContain('household');
    expect(usageWhere).toContain('user');

    const accountUpdates = txUpdateCalls.filter((c) => c.table === accounts);
    expect(accountUpdates.length).toBeGreaterThan(0);
    for (const call of accountUpdates) {
      const whereStr = util.inspect(call.whereArg, { depth: 8, colors: false }).toLowerCase();
      expect(whereStr).toContain('household');
      expect(whereStr).toContain('user');
    }
  });

  it('POST /api/transfers rejects same-user accounts outside household scope', async () => {
    const selectCalls: Array<{ table: unknown; whereArg: unknown }> = [];

    (db.select as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      from: (table: unknown) => ({
        where: (whereArg: unknown) => {
          selectCalls.push({ table, whereArg });
          return { limit: async () => [] };
        },
      }),
    });

    const request = {
      url: 'https://example.com/api/transfers',
      headers: new Headers({ 'x-household-id': TEST_HOUSEHOLD_ID }),
      json: async () => ({
        fromAccountId: 'acct_other_household_1',
        toAccountId: 'acct_other_household_2',
        amount: 25,
        date: '2026-01-01',
        householdId: TEST_HOUSEHOLD_ID,
      }),
    } as unknown as Request;

    const response = await POST_TRANSFERS(request);
    expect(response.status).toBe(404);
    expect(db.transaction).not.toHaveBeenCalled();

    const accountCalls = selectCalls.filter((c) => c.table === accounts);
    expect(accountCalls.length).toBeGreaterThan(0);
    for (const call of accountCalls) {
      const whereStr = util.inspect(call.whereArg, { depth: 8, colors: false }).toLowerCase();
      expect(whereStr).toContain('household');
      expect(whereStr).toContain('user');
    }
  });

  it('POST /api/transfers returns 400 for invalid amount payloads', async () => {
    const request = {
      url: 'https://example.com/api/transfers',
      headers: new Headers({ 'x-household-id': TEST_HOUSEHOLD_ID }),
      json: async () => ({
        fromAccountId: 'acct_1',
        toAccountId: 'acct_2',
        amount: 'not-a-number',
        date: '2026-01-01',
        householdId: TEST_HOUSEHOLD_ID,
      }),
    } as unknown as Request;

    const response = await POST_TRANSFERS(request);
    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.error).toContain('Amount and fees');
    expect(db.select).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });
});
