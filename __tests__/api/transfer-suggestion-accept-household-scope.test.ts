import { describe, it, expect, vi, beforeEach } from 'vitest';

import { POST as POST_ACCEPT } from '@/app/api/transfer-suggestions/[id]/accept/route';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/api/household-auth', () => ({
  getAndVerifyHousehold: vi.fn(),
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}));

import util from 'node:util';

import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { transactions, transferSuggestions } from '@/lib/db/schema';

describe('POST /api/transfer-suggestions/[id]/accept household scoping', () => {
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

    (nanoid as unknown as { mockReturnValue: (v: string) => void }).mockReturnValue('xfer_1');

    const selectCalls: Array<{ table: unknown; whereArg: unknown }> = [];

    const fromMock = vi.fn((table: unknown) => {
      return {
        where: (whereArg: unknown) => {
          selectCalls.push({ table, whereArg });
          return {
            limit: async () => {
              if (table === transferSuggestions) {
                return [
                  {
                    id: 's_1',
                    userId: TEST_USER_ID,
                    sourceTransactionId: 'tx_1',
                    suggestedTransactionId: 'tx_2',
                    status: 'pending',
                  },
                ];
              }

              if (table === transactions) {
                const whereStr = util.inspect(whereArg, { depth: 8, colors: false });
                if (whereStr.includes('tx_1')) {
                  return [
                    {
                      id: 'tx_1',
                      userId: TEST_USER_ID,
                      householdId: TEST_HOUSEHOLD_ID,
                      type: 'expense',
                      transferId: null,
                    },
                  ];
                }
                return [
                  {
                    id: 'tx_2',
                    userId: TEST_USER_ID,
                    householdId: TEST_HOUSEHOLD_ID,
                    type: 'income',
                    transferId: null,
                  },
                ];
              }

              return [];
            },
          };
        },
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

    const txUpdateWhereCalls: Array<{ table: unknown; whereArg: unknown }> = [];
    const tx = {
      select: () => ({
        from: (table: unknown) => ({
          where: (whereArg: unknown) => ({
            limit: async () => {
              if (table !== transactions) return [];
              const whereStr = util.inspect(whereArg, { depth: 8, colors: false });
              if (whereStr.includes('tx_1')) {
                return [
                  {
                    id: 'tx_1',
                    userId: TEST_USER_ID,
                    householdId: TEST_HOUSEHOLD_ID,
                    accountId: 'acc_1',
                    type: 'expense',
                    transferId: null,
                    transferGroupId: null,
                    pairedTransactionId: null,
                    amount: 100,
                    amountCents: 10000,
                  },
                ];
              }
              return [
                {
                  id: 'tx_2',
                  userId: TEST_USER_ID,
                  householdId: TEST_HOUSEHOLD_ID,
                  accountId: 'acc_2',
                  type: 'income',
                  transferId: null,
                  transferGroupId: null,
                  pairedTransactionId: null,
                  amount: 100,
                  amountCents: 10000,
                },
              ];
            },
          }),
        }),
      }),
      update: (table: unknown) => ({
        set: () => ({
          where: async (whereArg: unknown) => {
            txUpdateWhereCalls.push({ table, whereArg });
            return undefined;
          },
        }),
      }),
      insert: () => ({
        values: async () => undefined,
      }),
    };

    (db.transaction as unknown as {
      mockImplementation: (fn: (tx: unknown) => Promise<unknown>) => void;
    }).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return await fn(tx);
    });

    (db as unknown as { __selectCalls?: typeof selectCalls }).__selectCalls = selectCalls;
    (db as unknown as { __updateWhereCalls?: typeof updateWhereCalls }).__updateWhereCalls = updateWhereCalls;
    (db as unknown as { __txUpdateWhereCalls?: typeof txUpdateWhereCalls }).__txUpdateWhereCalls = txUpdateWhereCalls;
  });

  it('scopes transaction selects and updates by household', async () => {
    const req = {
      method: 'POST',
      url: 'https://example.com/api/transfer-suggestions/s_1/accept',
      headers: new Headers({ 'x-household-id': TEST_HOUSEHOLD_ID }),
    } as unknown as Request;

    const response = await POST_ACCEPT(req as unknown as never, { params: Promise.resolve({ id: 's_1' }) });
    expect(response.status).toBe(200);

    const selectCalls = (db as unknown as {
      __selectCalls: Array<{ table: unknown; whereArg: unknown }>;
    }).__selectCalls;

    const txnSelects = selectCalls.filter((c) => c.table === transactions);
    expect(txnSelects.length).toBeGreaterThan(0);

    for (const sel of txnSelects) {
      const whereStr = util.inspect(sel.whereArg, { depth: 8, colors: false }).toLowerCase();
      expect(whereStr).toContain('household');
      expect(whereStr).toContain('user');
    }

    const updateWhereCalls = (db as unknown as {
      __updateWhereCalls: Array<{ table: unknown; whereArg: unknown }>;
    }).__updateWhereCalls;

    const txnUpdates = (db as unknown as {
      __txUpdateWhereCalls: Array<{ table: unknown; whereArg: unknown }>;
    }).__txUpdateWhereCalls.filter((c) => c.table === transactions);
    expect(txnUpdates.length).toBeGreaterThan(0);

    for (const upd of txnUpdates) {
      const whereStr = util.inspect(upd.whereArg, { depth: 8, colors: false }).toLowerCase();
      expect(whereStr).toContain('household');
      expect(whereStr).toContain('user');
    }

    const suggestionUpdates = updateWhereCalls.filter((c) => c.table === transferSuggestions);
    expect(suggestionUpdates.length).toBeGreaterThan(0);

    expect(getAndVerifyHousehold).toHaveBeenCalledTimes(1);
  });
});
