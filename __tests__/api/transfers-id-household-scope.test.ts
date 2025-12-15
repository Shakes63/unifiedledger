import { describe, it, expect, vi, beforeEach } from 'vitest';

import { DELETE as DELETE_TRANSFER } from '@/app/api/transfers/[id]/route';

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
  },
}));

import util from 'node:util';

import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { accounts, transactions, transfers } from '@/lib/db/schema';

describe('DELETE /api/transfers/[id] household scoping', () => {
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

    // Initial transfer fetch (outside transaction)
    const selectCalls: Array<{ table: unknown; whereArg: unknown }> = [];

    const fromMock = vi.fn((table: unknown) => {
      return {
        where: (whereArg: unknown) => {
          selectCalls.push({ table, whereArg });
          return {
            limit: async () => {
              if (table === transfers) {
                return [
                  {
                    id: 'tr_1',
                    userId: TEST_USER_ID,
                    fromAccountId: 'acct_from',
                    toAccountId: 'acct_to',
                    amount: 10,
                    fees: 0,
                    fromTransactionId: 'tx_from',
                    toTransactionId: 'tx_to',
                  },
                ];
              }

              // Account existence validation is not done outside the transaction for DELETE,
              // so we can return empty here.
              return [];
            },
          };
        },
      };
    });

    (db.select as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      from: fromMock,
    });

    // Transaction mock
    const txSelectCalls: Array<{ table: unknown; whereArg: unknown }> = [];
    const txDeleteCalls: Array<{ table: unknown; whereArg: unknown }> = [];
    const txUpdateCalls: Array<{ table: unknown; whereArg: unknown }> = [];

    const tx = {
      select: () => ({
        from: (table: unknown) => ({
          where: (whereArg: unknown) => {
            txSelectCalls.push({ table, whereArg });
            return {
              limit: async () => {
                if (table === accounts) {
                  return [
                    {
                      id: 'acct_from',
                      userId: TEST_USER_ID,
                      householdId: TEST_HOUSEHOLD_ID,
                      currentBalance: 100,
                    },
                  ];
                }
                return [];
              },
            };
          },
        }),
      }),
      delete: (table: unknown) => ({
        where: async (whereArg: unknown) => {
          txDeleteCalls.push({ table, whereArg });
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
    };

    (db.transaction as unknown as { mockImplementation: (fn: (tx: unknown) => Promise<void>) => void }).mockImplementation(
      async (fn: (txArg: unknown) => Promise<void>) => {
        await fn(tx);
      }
    );

    (db as unknown as { __selectCalls?: typeof selectCalls }).__selectCalls = selectCalls;
    (db as unknown as { __txSelectCalls?: typeof txSelectCalls }).__txSelectCalls = txSelectCalls;
    (db as unknown as { __txDeleteCalls?: typeof txDeleteCalls }).__txDeleteCalls = txDeleteCalls;
    (db as unknown as { __txUpdateCalls?: typeof txUpdateCalls }).__txUpdateCalls = txUpdateCalls;
  });

  it('scopes transaction deletes and account balance operations by household', async () => {
    const request = {
      url: 'https://example.com/api/transfers/tr_1',
      headers: new Headers({ 'x-household-id': TEST_HOUSEHOLD_ID }),
    } as unknown as Request;

    const response = await DELETE_TRANSFER(request, { params: Promise.resolve({ id: 'tr_1' }) });
    expect(response.status).toBe(200);

    expect(getAndVerifyHousehold).toHaveBeenCalledTimes(1);

    const txDeleteCalls = (db as unknown as {
      __txDeleteCalls: Array<{ table: unknown; whereArg: unknown }>;
    }).__txDeleteCalls;

    const transferDelete = txDeleteCalls.find((c) => c.table === transfers);
    expect(transferDelete).toBeTruthy();
    const transferDeleteWhere = util
      .inspect(transferDelete!.whereArg, { depth: 8, colors: false })
      .toLowerCase();
    // transfers has no householdId, but must be scoped by user
    expect(transferDeleteWhere).toContain('user');

    const txnDeletes = txDeleteCalls.filter((c) => c.table === transactions);
    expect(txnDeletes.length).toBeGreaterThan(0);

    for (const del of txnDeletes) {
      const whereStr = util.inspect(del.whereArg, { depth: 8, colors: false }).toLowerCase();
      expect(whereStr).toContain('household');
      expect(whereStr).toContain('user');
    }

    const txSelectCalls = (db as unknown as {
      __txSelectCalls: Array<{ table: unknown; whereArg: unknown }>;
    }).__txSelectCalls;

    const accountSelects = txSelectCalls.filter((c) => c.table === accounts);
    expect(accountSelects.length).toBeGreaterThan(0);
    for (const sel of accountSelects) {
      const whereStr = util.inspect(sel.whereArg, { depth: 8, colors: false }).toLowerCase();
      expect(whereStr).toContain('household');
      expect(whereStr).toContain('user');
    }

    const txUpdateCalls = (db as unknown as {
      __txUpdateCalls: Array<{ table: unknown; whereArg: unknown }>;
    }).__txUpdateCalls;

    const accountUpdates = txUpdateCalls.filter((c) => c.table === accounts);
    expect(accountUpdates.length).toBeGreaterThan(0);
    for (const upd of accountUpdates) {
      const whereStr = util.inspect(upd.whereArg, { depth: 8, colors: false }).toLowerCase();
      expect(whereStr).toContain('household');
      expect(whereStr).toContain('user');
    }
  });
});
