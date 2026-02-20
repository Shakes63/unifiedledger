import { describe, it, expect, vi, beforeEach } from 'vitest';

import { POST as POST_REPEAT } from '@/app/api/transactions/repeat/route';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/api/household-auth', () => ({
  getHouseholdIdFromRequest: vi.fn(),
  requireHouseholdAuth: vi.fn(),
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

vi.mock('@/lib/rules/transfer-action-handler', () => ({
  handleTransferConversion: vi.fn(),
}));

vi.mock('@/lib/rules/split-action-handler', () => ({
  handleSplitCreation: vi.fn(),
}));

vi.mock('@/lib/rules/account-action-handler', () => ({
  handleAccountChange: vi.fn(),
}));

import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { findMatchingRule } from '@/lib/rules/rule-matcher';
import { executeRuleActions } from '@/lib/rules/actions-executor';
import { handleTransferConversion } from '@/lib/rules/transfer-action-handler';
import { handleSplitCreation } from '@/lib/rules/split-action-handler';
import { handleAccountChange } from '@/lib/rules/account-action-handler';
import { merchants, ruleExecutionLog, transactions } from '@/lib/db/schema';

type DbSelectChain = {
  from: (table: unknown) => {
    where: (whereArg: unknown) => {
      limit: (n: number) => Promise<unknown[]>;
    };
  };
};

type InsertRecord = { table: unknown; values: unknown };
type InsertDb = typeof db & { __inserts?: InsertRecord[] };

describe('POST /api/transactions/repeat applies full rule actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(requireAuth).mockResolvedValue({ userId: 'user_1' });
    vi.mocked(getHouseholdIdFromRequest).mockReturnValue('hh_1');
    vi.mocked(requireHouseholdAuth).mockResolvedValue({ role: 'owner' } as unknown as { role: string });

    // Deterministic IDs
    vi.mocked(nanoid).mockReturnValue('tx_1');

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
        description: 'Mutated description',
        merchantId: 'm_1',
        isTaxDeductible: true,
        isSalesTaxable: true,
        convertToTransfer: {
          targetAccountId: 'acct_2',
          autoMatch: true,
          matchTolerance: 1,
          matchDayRange: 7,
          createIfNoMatch: true,
        },
        createSplits: [
          {
            categoryId: 'cat_split',
            isPercentage: false,
            amount: 1,
          },
        ],
        changeAccount: { targetAccountId: 'acct_3' },
      },
      appliedActions: [
        { type: 'set_description', field: 'description', originalValue: 'Original', newValue: 'Mutated description' },
        { type: 'set_merchant', field: 'merchantId', originalValue: null, newValue: 'm_1' },
      ],
    });

    vi.mocked(handleTransferConversion).mockResolvedValue({ success: true });
    vi.mocked(handleSplitCreation).mockResolvedValue({ success: true, createdSplits: [] });
    vi.mocked(handleAccountChange).mockResolvedValue({ success: true });

    // db.select() chain returns sequential results for each limit(1)
    const limitMock = vi
      .fn<(n: number) => Promise<unknown[]>>()
      .mockResolvedValueOnce([
        {
          id: 'tmpl_1',
          userId: 'user_1',
          accountId: 'acct_1',
          categoryId: null,
          amount: 12.34,
          description: 'Original',
          name: 'Template',
          notes: null,
          type: 'expense',
          usageCount: 0,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'acct_1',
          userId: 'user_1',
          householdId: 'hh_1',
          name: 'Checking',
          currentBalance: 100,
          currentBalanceCents: 10000,
          usageCount: 0,
        },
      ])
      // merchant exists (validation before insert)
      .mockResolvedValueOnce([
        {
          id: 'm_1',
          userId: 'user_1',
          householdId: 'hh_1',
          name: 'Merchant 1',
          normalizedName: 'merchant 1',
          usageCount: 1,
          totalSpent: 0,
          averageTransaction: 0,
        },
      ])
      // merchantById for usage update
      .mockResolvedValueOnce([
        {
          id: 'm_1',
          userId: 'user_1',
          householdId: 'hh_1',
          name: 'Merchant 1',
          normalizedName: 'merchant 1',
          usageCount: 1,
          totalSpent: 0,
          averageTransaction: 0,
        },
      ]);

    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });

    vi.mocked(db.select).mockImplementation(selectMock as unknown as () => DbSelectChain);

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

  it('applies executeRuleActions mutations and logs appliedActions', async () => {
    const request = {
      json: async () => ({ templateId: 'tmpl_1' }),
      headers: new Headers({ 'x-household-id': 'hh_1' }),
    } as unknown as Request;

    const response = await POST_REPEAT(request);
    expect(response.status).toBe(201);

    // Transaction insert uses mutated fields
    const inserts = (db as unknown as InsertDb).__inserts ?? [];
    const txInsert = inserts.find((i) => i.table === transactions);
    expect(txInsert).toBeTruthy();
    expect(txInsert!.values).toEqual(
      expect.objectContaining({
        description: 'Mutated description',
        merchantId: 'm_1',
        isTaxDeductible: true,
        isSalesTaxable: true,
      })
    );

    // Rule execution log includes appliedActions and does not require category
    const logInsert = inserts.find((i) => i.table === ruleExecutionLog);
    expect(logInsert).toBeTruthy();
    expect(logInsert!.values).toEqual(
      expect.objectContaining({
        appliedCategoryId: null,
        appliedActions: expect.stringContaining('set_description'),
      })
    );

    // Post-creation actions invoked when mutations contain them
    expect(vi.mocked(handleTransferConversion)).toHaveBeenCalledWith('user_1', 'tx_1', expect.any(Object));
    expect(vi.mocked(handleSplitCreation)).toHaveBeenCalledWith('user_1', 'tx_1', expect.any(Array));
    expect(vi.mocked(handleAccountChange)).toHaveBeenCalledWith('user_1', 'tx_1', 'acct_3');

    // Merchant upsert path is skipped because merchantId was set and exists
    expect(vi.mocked(db.insert)).not.toHaveBeenCalledWith(merchants);
  });
});
