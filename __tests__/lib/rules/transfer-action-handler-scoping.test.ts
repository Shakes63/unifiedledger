/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handleTransferConversion } from '@/lib/rules/transfer-action-handler';

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
import { accounts, transactions } from '@/lib/db/schema';

describe('transfer-action-handler scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(nanoid)
      .mockReturnValueOnce('transfer_1') // transferId
      .mockReturnValueOnce('tx_pair_1'); // new pair id

    // db.select(): source tx -> validate target account -> candidates
    const limitMock = vi
      .fn<(n: number) => Promise<unknown[]>>()
      .mockResolvedValueOnce([
        {
          id: 'tx_source_1',
          userId: 'user_1',
          householdId: 'hh_1',
          accountId: 'acct_source',
          date: '2025-01-10',
          amount: 50,
          amountCents: 5000,
          description: 'Source',
          notes: null,
          type: 'expense',
          transferId: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'acct_target',
          userId: 'user_1',
          householdId: 'hh_1',
        },
      ])
      .mockResolvedValueOnce([]); // candidates

    const whereArgs: unknown[] = [];

    const whereMock = vi.fn((whereArg: unknown) => {
      whereArgs.push(whereArg);
      return { limit: limitMock };
    });

    const fromMock = vi.fn((_table: unknown) => {
      return { where: whereMock };
    });

    vi.mocked(db.select).mockReturnValue({ from: fromMock } as any);

    // Capture update where clauses
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

    // Capture inserts (for createIfNoMatch path)
    const inserts: Array<{ table: unknown; values: unknown }> = [];
    vi.mocked(db.insert).mockImplementation((table: unknown) => {
      return {
        values: vi.fn(async (values: unknown) => {
          inserts.push({ table, values });
          return undefined;
        }),
      } as any;
    });

    (db as any).__whereArgs = whereArgs;
    (db as any).__updateWhereCalls = updateWhereCalls;
    (db as any).__inserts = inserts;
  });

  it('filters candidate matching by household and uses date-only bounds', async () => {
    const result = await handleTransferConversion('user_1', 'tx_source_1', {
      targetAccountId: 'acct_target',
      autoMatch: false,
      matchTolerance: 1,
      matchDayRange: 7,
      createIfNoMatch: false,
    });

    expect(result.success).toBe(true);

    const whereArgs = (db as any).__whereArgs as unknown[];

    // candidates where(...) should be the 3rd where call
    const candidatesWhere = whereArgs.at(2);
    expect(candidatesWhere).toBeTruthy();

    const inspected = util.inspect(candidatesWhere, { depth: 8, colors: false }).toLowerCase();
    expect(inspected).toContain('household');

    // Ensure we are not using toISOString split artifacts (should be plain yyyy-mm-dd)
    expect(inspected).not.toContain('t00:00');
    expect(inspected).toContain('2025-01-03');
    expect(inspected).toContain('2025-01-17');
  });

  it('scopes account balance updates by household on create-pair path', async () => {
    // Reset deterministic IDs for this test
    vi.clearAllMocks();

    vi.mocked(nanoid)
      .mockReturnValueOnce('transfer_2')
      .mockReturnValueOnce('tx_pair_2');

    // Rebuild mocks with same behavior
    const limitMock = vi
      .fn<(n: number) => Promise<unknown[]>>()
      .mockResolvedValueOnce([
        {
          id: 'tx_source_1',
          userId: 'user_1',
          householdId: 'hh_1',
          accountId: 'acct_source',
          date: '2025-01-10',
          amount: 50,
          amountCents: 5000,
          description: 'Source',
          notes: null,
          type: 'expense',
          transferId: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'acct_target',
          userId: 'user_1',
          householdId: 'hh_1',
        },
      ])
      .mockResolvedValueOnce([]) // candidates
      .mockResolvedValueOnce([
        {
          id: 'acct_source',
          userId: 'user_1',
          householdId: 'hh_1',
          currentBalance: 1000,
          currentBalanceCents: 100000,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'acct_target',
          userId: 'user_1',
          householdId: 'hh_1',
          currentBalance: 500,
          currentBalanceCents: 50000,
        },
      ]);

    const whereArgs: unknown[] = [];
    const whereMock = vi.fn((whereArg: unknown) => {
      whereArgs.push(whereArg);
      return { limit: limitMock };
    });
    const fromMock = vi.fn(() => ({ where: whereMock }));
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

    const inserts: Array<{ table: unknown; values: unknown }> = [];
    vi.mocked(db.insert).mockImplementation((table: unknown) => {
      return {
        values: vi.fn(async (values: unknown) => {
          inserts.push({ table, values });
          return undefined;
        }),
      } as any;
    });

    (db as any).__updateWhereCalls = updateWhereCalls;
    (db as any).__inserts = inserts;

    const result = await handleTransferConversion('user_1', 'tx_source_1', {
      targetAccountId: 'acct_target',
      autoMatch: false,
      matchTolerance: 1,
      matchDayRange: 7,
      createIfNoMatch: true,
    });

    expect(result.success).toBe(true);

    const calls = (db as any).__updateWhereCalls as Array<{ table: unknown; whereArg: unknown }>;
    const accountUpdates = calls.filter((c) => c.table === accounts);

    // Post-creation conversion should only apply destination-side balance adjustment.
    expect(accountUpdates.length).toBeGreaterThanOrEqual(1);

    const inspected = accountUpdates
      .map((c) => util.inspect(c.whereArg, { depth: 8, colors: false }).toLowerCase())
      .join('\n');

    expect(inspected).toContain('household');
    expect(inspected).toContain('user');

    const txUpdates = calls.filter((c) => c.table === transactions);
    expect(txUpdates.length).toBeGreaterThanOrEqual(1);
  });
});
