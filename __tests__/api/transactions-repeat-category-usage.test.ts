/* eslint-disable @typescript-eslint/no-explicit-any */
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

import util from 'node:util';
import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { budgetCategories } from '@/lib/db/schema';

describe('POST /api/transactions/repeat category usage scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (requireAuth as any).mockResolvedValue({ userId: 'user_1' });
    (getHouseholdIdFromRequest as any).mockReturnValue('hh_1');
    (requireHouseholdAuth as any).mockResolvedValue({ role: 'owner' });

    // Deterministic IDs
    (nanoid as any).mockReturnValue('id_1');

    // SELECT chain (template -> account -> category -> usageAnalytics -> merchants)
    const limitMock = vi.fn();
    limitMock
      .mockResolvedValueOnce([
        {
          id: 'tmpl_1',
          userId: 'user_1',
          accountId: 'acct_1',
          categoryId: 'cat_1',
          amount: 12.34,
          description: 'Test',
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
      .mockResolvedValueOnce([
        {
          id: 'cat_1',
          userId: 'user_1',
          householdId: 'hh_1',
          usageCount: 5,
        },
      ])
      .mockResolvedValueOnce([]) // existing usageAnalytics
      .mockResolvedValueOnce([]); // existing merchant

    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.select as any).mockReturnValue({ from: fromMock });

    // INSERT chain
    const insertValuesMock = vi.fn().mockResolvedValue(undefined);
    (db.insert as any).mockReturnValue({ values: insertValuesMock });

    // UPDATE chain: capture budgetCategories where clause
    const updateWhereCalls: Array<{ table: unknown; whereArg: unknown }> = [];
    const updateWhereMock = vi.fn(async (whereArg: unknown) => {
      updateWhereCalls.push({ table: (db.update as any).mock.calls.at(-1)?.[0], whereArg });
      return undefined;
    });

    (db.update as any).mockImplementation((_table: unknown) => {
      return {
        set: vi.fn().mockReturnValue({
          where: updateWhereMock,
        }),
      };
    });

    // Expose calls for assertion
    (db as any).__updateWhereCalls = updateWhereCalls;
  });

  it('scopes budgetCategories usage update by householdId', async () => {
    const request = {
      json: async () => ({ templateId: 'tmpl_1' }),
      headers: new Headers({ 'x-household-id': 'hh_1' }),
    } as unknown as Request;

    const response = await POST_REPEAT(request);
    expect(response.status).toBe(201);

    const calls = (db as any).__updateWhereCalls as Array<{ table: unknown; whereArg: unknown }>;
    const budgetCategoryUpdate = calls.find((c) => c.table === budgetCategories);

    expect(budgetCategoryUpdate).toBeTruthy();

    const inspected = util.inspect(budgetCategoryUpdate!.whereArg, { depth: 8, colors: false }).toLowerCase();
    expect(inspected).toContain('household');
  });
});
