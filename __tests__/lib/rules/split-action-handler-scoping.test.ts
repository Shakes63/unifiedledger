import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handleSplitCreation } from '@/lib/rules/split-action-handler';

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn(),
}));

import util from 'node:util';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { budgetCategories, transactions } from '@/lib/db/schema';

describe('split-action-handler household scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(nanoid).mockReturnValue('split_1');

    // db.select() chain: tx fetch -> categories
    const limitMock = vi
      .fn<(n: number) => Promise<unknown[]>>()
      .mockResolvedValueOnce([
        {
          id: 'tx_1',
          userId: 'user_1',
          householdId: 'hh_1',
          amount: 10,
        },
      ]);

    const whereArgs: Array<{ table: unknown; whereArg: unknown }> = [];

    const whereMock = vi.fn((whereArg: unknown) => {
      whereArgs.push({ table: (whereArgs.length === 0 ? transactions : budgetCategories), whereArg });
      return { limit: limitMock };
    });

    const fromMock = vi.fn((table: unknown) => {
      // tx fetch uses where().limit(), categories uses where() without limit
      if (table === transactions) {
        return { where: whereMock };
      }
      if (table === budgetCategories) {
        return {
          where: vi.fn(async (whereArg: unknown) => {
            whereArgs.push({ table: budgetCategories, whereArg });
            return [
              { id: 'cat_1', userId: 'user_1', householdId: 'hh_1' },
              { id: 'cat_2', userId: 'user_1', householdId: 'hh_1' },
            ];
          }),
        };
      }
      throw new Error('Unexpected table');
    });

    vi.mocked(db.select).mockReturnValue({ from: fromMock } as any);

    vi.mocked(db.insert).mockImplementation((_table: unknown) => {
      return { values: async () => undefined } as any;
    });

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

    (db as any).__whereArgs = whereArgs;
    (db as any).__updateWhereCalls = updateWhereCalls;
  });

  it('scopes category validation and transaction update by household', async () => {
    const result = await handleSplitCreation('user_1', 'tx_1', [
      { categoryId: 'cat_1', isPercentage: false, amount: 5 },
      { categoryId: 'cat_2', isPercentage: false, amount: 5 },
    ]);

    expect(result.success).toBe(true);

    const whereArgs = (db as any).__whereArgs as Array<{ table: unknown; whereArg: unknown }>;

    const categoryWhere = whereArgs.find((w) => w.table === budgetCategories);
    expect(categoryWhere).toBeTruthy();

    const categoryInspected = util.inspect(categoryWhere!.whereArg, { depth: 8, colors: false }).toLowerCase();
    expect(categoryInspected).toContain('household');

    const updateCalls = (db as any).__updateWhereCalls as Array<{ table: unknown; whereArg: unknown }>;
    const txUpdate = updateCalls.find((c) => c.table === transactions);
    expect(txUpdate).toBeTruthy();

    const txInspected = util.inspect(txUpdate!.whereArg, { depth: 8, colors: false }).toLowerCase();
    expect(txInspected).toContain('household');
    expect(txInspected).toContain('user');
  });
});
