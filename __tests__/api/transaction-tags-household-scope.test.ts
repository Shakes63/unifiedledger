import { describe, it, expect, vi, beforeEach } from 'vitest';

import { DELETE as DELETE_TRANSACTION_TAG } from '@/app/api/transaction-tags/route';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/api/household-auth', () => ({
  getAndVerifyHousehold: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  },
}));

import util from 'node:util';

import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { tags, transactionTags, transactions } from '@/lib/db/schema';

describe('DELETE /api/transaction-tags household scoping', () => {
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
          return {
            limit: async () => {
              if (table === transactionTags) {
                return [{ id: 'tt_1', userId: TEST_USER_ID, transactionId: 'tx_1', tagId: 'tag_1' }];
              }

              if (table === transactions) {
                return [{ id: 'tx_1', userId: TEST_USER_ID, householdId: TEST_HOUSEHOLD_ID }];
              }

              if (table === tags) {
                return [{ id: 'tag_1', userId: TEST_USER_ID, usageCount: 2 }];
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

    const deleteWhereCalls: Array<{ table: unknown; whereArg: unknown }> = [];
    (db.delete as unknown as { mockImplementation: (fn: (table: unknown) => unknown) => void }).mockImplementation(
      (table: unknown) => {
        return {
          where: async (whereArg: unknown) => {
            deleteWhereCalls.push({ table, whereArg });
            return undefined;
          },
        };
      }
    );

    (db.update as unknown as { mockImplementation: (fn: (table: unknown) => unknown) => void }).mockImplementation(
      (table: unknown) => {
        return {
          set: () => ({
            where: async () => undefined,
          }),
        };
      }
    );

    (db as unknown as { __selectCalls?: typeof selectCalls }).__selectCalls = selectCalls;
    (db as unknown as { __deleteWhereCalls?: typeof deleteWhereCalls }).__deleteWhereCalls = deleteWhereCalls;
  });

  it('validates transaction household and scopes delete by userId', async () => {
    const request = {
      url: 'https://example.com/api/transaction-tags',
      json: async () => ({ transactionId: 'tx_1', tagId: 'tag_1' }),
      headers: new Headers({ 'x-household-id': TEST_HOUSEHOLD_ID }),
    } as unknown as Request;

    const response = await DELETE_TRANSACTION_TAG(request);
    expect(response.status).toBe(200);

    const selectCalls = (db as unknown as {
      __selectCalls: Array<{ table: unknown; whereArg: unknown }>;
    }).__selectCalls;

    const txnSelect = selectCalls.find((c) => c.table === transactions);
    expect(txnSelect).toBeTruthy();

    const txnWhere = util.inspect(txnSelect!.whereArg, { depth: 8, colors: false }).toLowerCase();
    expect(txnWhere).toContain('household');
    expect(txnWhere).toContain('user');

    const deleteWhereCalls = (db as unknown as {
      __deleteWhereCalls: Array<{ table: unknown; whereArg: unknown }>;
    }).__deleteWhereCalls;

    const assocDelete = deleteWhereCalls.find((c) => c.table === transactionTags);
    expect(assocDelete).toBeTruthy();

    const assocWhere = util.inspect(assocDelete!.whereArg, { depth: 8, colors: false }).toLowerCase();
    expect(assocWhere).toContain('user');

    expect(getAndVerifyHousehold).toHaveBeenCalledTimes(1);
  });
});
