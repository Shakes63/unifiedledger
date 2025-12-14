/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handleAccountChange } from '@/lib/rules/account-action-handler';

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn(),
}));

import util from 'node:util';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { accounts, activityLog, householdMembers, transactions } from '@/lib/db/schema';

describe('account-action-handler household scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(nanoid).mockReturnValue('log_1');

    // db.select() chain calls:
    // 1) tx fetch (limit 1)
    // 2) target account validation (limit 1)
    // 3) member fetch for log (limit 1)
    // 4) old account name (limit 1)
    // 5) new account name (limit 1)

    const limitMock = vi
      .fn<(n: number) => Promise<unknown[]>>()
      .mockResolvedValueOnce([
        {
          id: 'tx_1',
          userId: 'user_1',
          householdId: 'hh_1',
          accountId: 'acct_old',
          type: 'expense',
          amount: 12.34,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'acct_new',
          userId: 'user_1',
          householdId: 'hh_1',
        },
      ])
      .mockResolvedValueOnce([{ householdId: 'hh_1' }])
      .mockResolvedValueOnce([{ name: 'Old Account' }])
      .mockResolvedValueOnce([{ name: 'New Account' }]);

    const selectCalls: Array<{ table: unknown; whereArg: unknown }> = [];

    const fromMock = vi.fn((table: unknown) => {
      return {
        where: (whereArg: unknown) => {
          selectCalls.push({ table, whereArg });
          return { limit: limitMock };
        },
      };
    });

    vi.mocked(db.select).mockReturnValue({ from: fromMock } as any);

    const updateWhereCalls: Array<{ table: unknown; whereArg: unknown }> = [];
    vi.mocked(db.update).mockImplementation((table: unknown) => {
      return {
        set: vi.fn().mockReturnValue({
          where: vi.fn(async (whereArg: unknown) => {
            updateWhereCalls.push({ table, whereArg });
            return undefined;
          }),
        }),
      } as any;
    });

    const inserts: Array<{ table: unknown; values: any }> = [];
    vi.mocked(db.insert).mockImplementation((table: unknown) => {
      return {
        values: vi.fn(async (values: any) => {
          inserts.push({ table, values });
          return undefined;
        }),
      } as any;
    });

    (db as any).__selectCalls = selectCalls;
    (db as any).__updateWhereCalls = updateWhereCalls;
    (db as any).__inserts = inserts;
  });

  it('validates target account in the same household and logs to tx household', async () => {
    const result = await handleAccountChange('user_1', 'tx_1', 'acct_new');
    expect(result.success).toBe(true);

    const selectCalls = (db as any).__selectCalls as Array<{ table: unknown; whereArg: unknown }>;

    // Target account validation should include household filter
    const accountValidation = selectCalls.find((c) => c.table === accounts);
    expect(accountValidation).toBeTruthy();
    const accountWhere = util.inspect(accountValidation!.whereArg, { depth: 8, colors: false }).toLowerCase();
    expect(accountWhere).toContain('household');

    // Member selection should be for the same household
    const memberSelect = selectCalls.find((c) => c.table === householdMembers);
    expect(memberSelect).toBeTruthy();
    const memberWhere = util.inspect(memberSelect!.whereArg, { depth: 8, colors: false }).toLowerCase();
    expect(memberWhere).toContain('household');

    const inserts = (db as any).__inserts as Array<{ table: unknown; values: any }>;
    const activityInsert = inserts.find((i) => i.table === activityLog);
    expect(activityInsert).toBeTruthy();
    expect(activityInsert!.values.householdId).toBe('hh_1');

    const updateCalls = (db as any).__updateWhereCalls as Array<{ table: unknown; whereArg: unknown }>;
    const txUpdate = updateCalls.find((c) => c.table === transactions);
    expect(txUpdate).toBeTruthy();
    const txWhere = util.inspect(txUpdate!.whereArg, { depth: 8, colors: false }).toLowerCase();
    expect(txWhere).toContain('household');
    expect(txWhere).toContain('user');
  });
});
