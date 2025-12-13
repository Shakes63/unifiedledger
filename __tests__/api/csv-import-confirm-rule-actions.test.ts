import { describe, it, expect, vi, beforeEach } from 'vitest';

import { POST as POST_CONFIRM } from '@/app/api/csv-import/[importId]/confirm/route';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

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

vi.mock('@/lib/rules/rule-matcher', () => ({
  findMatchingRule: vi.fn(),
}));

vi.mock('@/lib/rules/actions-executor', () => ({
  executeRuleActions: vi.fn(),
}));

import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { findMatchingRule } from '@/lib/rules/rule-matcher';
import { executeRuleActions } from '@/lib/rules/actions-executor';
import { importHistory, importStaging, ruleExecutionLog, transactions } from '@/lib/db/schema';

type DbSelectChain = {
  from: (table: unknown) => {
    where: (whereArg: unknown) => {
      limit: (n: number) => Promise<unknown[]>;
    };
  };
};

type InsertRecord = { table: unknown; values: unknown };

type InsertDb = typeof db & { __inserts?: InsertRecord[] };

describe('POST /api/csv-import/[importId]/confirm applies full rule actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(requireAuth).mockResolvedValue({ userId: 'user_1' });

    // Deterministic IDs: tx, log
    vi.mocked(nanoid)
      .mockReturnValueOnce('tx_1')
      .mockReturnValueOnce('log_1');

    vi.mocked(findMatchingRule).mockResolvedValue({
      matched: true,
      rule: {
        ruleId: 'rule_1',
        ruleName: 'Rule 1',
        priority: 1,
        actions: [
          { type: 'set_description', pattern: 'ignored' },
          { type: 'set_merchant', value: 'm_1' },
        ],
      },
    });

    vi.mocked(executeRuleActions).mockResolvedValue({
      mutations: {
        categoryId: null,
        description: 'Imported mutated description',
        merchantId: 'm_1',
        isTaxDeductible: true,
        isSalesTaxable: true,
      },
      appliedActions: [
        { type: 'set_description', field: 'description', originalValue: 'Orig', newValue: 'Imported mutated description' },
      ],
    });

    // db.select() chain: importHistory limit(1), then importStaging list
    const limitMock = vi
      .fn<(n: number) => Promise<unknown[]>>()
      .mockResolvedValueOnce([
        {
          id: 'import_1',
          userId: 'user_1',
          householdId: 'hh_1',
        },
      ]);

    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });

    const fromMock = vi.fn((table: unknown) => {
      if (table === importHistory) {
        return { where: whereMock };
      }

      if (table === importStaging) {
        return {
          where: vi.fn().mockResolvedValue([
            {
              id: 'stg_1',
              importHistoryId: 'import_1',
              rowNumber: 1,
              status: 'approved',
              duplicateOf: null,
              mappedData: JSON.stringify({
                description: 'Orig',
                amount: '12.34',
                accountId: 'acct_1',
                accountName: 'Checking',
                date: '2025-12-01',
                notes: null,
                type: 'expense',
                category: null,
              }),
            },
          ]),
        };
      }

      throw new Error('Unexpected table select');
    });

    vi.mocked(db.select).mockImplementation((() => ({ from: fromMock })) as unknown as () => DbSelectChain);

    const inserts: InsertRecord[] = [];
    vi.mocked(db.insert).mockImplementation((table: unknown) => {
      return {
        values: async (values: unknown) => {
          inserts.push({ table, values });
          return undefined;
        },
      };
    });

    vi.mocked(db.update).mockImplementation((_table: unknown) => {
      return {
        set: () => ({
          where: async () => undefined,
        }),
      };
    });

    (db as unknown as InsertDb).__inserts = inserts;
  });

  it('uses executeRuleActions output for insert and logs appliedActions', async () => {
    const request = {
      json: async () => ({ recordIds: null }),
    } as unknown as Request;

    const response = await POST_CONFIRM(request, {
      params: Promise.resolve({ importId: 'import_1' }),
    });

    expect(response.status).toBe(200);

    const inserts = (db as unknown as InsertDb).__inserts ?? [];

    const txInsert = inserts.find((i) => i.table === transactions);
    expect(txInsert).toBeTruthy();
    expect(txInsert!.values).toEqual(
      expect.objectContaining({
        id: 'tx_1',
        householdId: 'hh_1',
        description: 'Imported mutated description',
        merchantId: 'm_1',
        isTaxDeductible: true,
        isSalesTaxable: true,
      })
    );

    const logInsert = inserts.find((i) => i.table === ruleExecutionLog);
    expect(logInsert).toBeTruthy();
    expect(logInsert!.values).toEqual(
      expect.objectContaining({
        id: 'log_1',
        transactionId: 'tx_1',
        ruleId: 'rule_1',
        appliedCategoryId: null,
        appliedActions: expect.stringContaining('set_description'),
      })
    );
  });
});
