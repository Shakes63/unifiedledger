import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { POST } from '@/app/api/transactions/route';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/api/household-auth', () => ({
  getHouseholdIdFromRequest: vi.fn(),
  requireHouseholdAuth: vi.fn(),
}));

vi.mock('@/lib/api/entity-auth', () => ({
  resolveAndRequireEntity: vi.fn(),
}));

vi.mock('@/lib/household/entities', () => ({
  requireAccountEntityAccess: vi.fn(),
  resolveAccountEntityId: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    transaction: vi.fn(),
  },
}));

import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { resolveAndRequireEntity } from '@/lib/api/entity-auth';
import { requireAccountEntityAccess, resolveAccountEntityId } from '@/lib/household/entities';
import { db } from '@/lib/db';
import { accounts, transactions } from '@/lib/db/schema';

interface FakeAccount {
  id: string;
  currentBalance: number;
  currentBalanceCents: number;
  usageCount: number;
  type: string;
}

interface FakeState {
  accounts: FakeAccount[];
  transactions: Array<Record<string, unknown>>;
}

describe('POST /api/transactions atomicity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as Mock).mockResolvedValue({ userId: 'user-1' });
    (getHouseholdIdFromRequest as Mock).mockReturnValue('hh-1');
    (requireHouseholdAuth as Mock).mockResolvedValue({ householdId: 'hh-1', userId: 'user-1' });
    (resolveAndRequireEntity as Mock).mockResolvedValue({
      id: 'entity_personal',
      householdId: 'hh-1',
      name: 'Personal',
      type: 'personal',
      isDefault: true,
      enableSalesTax: false,
      isActive: true,
    });
    (requireAccountEntityAccess as Mock).mockImplementation(
      async (_userId: string, householdId: string, accountEntityId: string | null | undefined) => ({
        id: accountEntityId ?? 'entity_personal',
        householdId,
        name: 'Personal',
        type: 'personal',
        isDefault: true,
        enableSalesTax: false,
        isActive: true,
      })
    );
    (resolveAccountEntityId as Mock).mockImplementation(
      async (_householdId: string, _userId: string, accountEntityId: string | null | undefined) =>
        accountEntityId ?? 'entity_personal'
    );
  });

  it('rolls back transfer writes when a mid-transaction account update fails', async () => {
    const initialState: FakeState = {
      accounts: [
        { id: 'acc-source', currentBalance: 1000, currentBalanceCents: 100000, usageCount: 1, type: 'checking' },
        { id: 'acc-dest', currentBalance: 500, currentBalanceCents: 50000, usageCount: 2, type: 'savings' },
      ],
      transactions: [],
    };

    let persistedState: FakeState = structuredClone(initialState);
    let accountValidationSelectCall = 0;

    (db.select as Mock).mockReturnValue({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => {
            if (table === accounts) {
              accountValidationSelectCall += 1;
              if (accountValidationSelectCall === 1) {
                return [persistedState.accounts[0]];
              }
              if (accountValidationSelectCall === 2) {
                return [persistedState.accounts[1]];
              }
            }
            return [];
          },
        }),
      }),
    });

    (db.transaction as Mock).mockImplementation(async (callback: (tx: unknown) => Promise<void>) => {
      const stagedState: FakeState = structuredClone(persistedState);
      let accountUpdateCount = 0;

      const tx = {
        insert: (table: unknown) => ({
          values: async (values: Record<string, unknown>) => {
            if (table === transactions) {
              stagedState.transactions.push(values);
            }
          },
        }),
        update: (table: unknown) => ({
          set: (updates: Record<string, unknown>) => ({
            where: async () => {
              if (table === accounts) {
                accountUpdateCount += 1;
                if (accountUpdateCount === 2) {
                  throw new Error('simulated destination account update failure');
                }

                const target = stagedState.accounts[accountUpdateCount - 1];
                if (target) {
                  target.currentBalance = Number(updates.currentBalance ?? target.currentBalance);
                  target.currentBalanceCents = Number(
                    updates.currentBalanceCents ?? target.currentBalanceCents
                  );
                  target.usageCount = Number(updates.usageCount ?? target.usageCount);
                }
              }
            },
          }),
        }),
      };

      try {
        await callback(tx);
        persistedState = stagedState;
      } catch (error) {
        throw error;
      }
    });

    const request = {
      url: 'http://localhost/api/transactions',
      headers: new Headers({ 'x-household-id': 'hh-1' }),
      json: async () => ({
        accountId: 'acc-source',
        toAccountId: 'acc-dest',
        date: '2026-02-01',
        amount: 125,
        description: 'Transfer rollback test',
        type: 'transfer',
      }),
    } as unknown as Request;

    const response = await POST(request);
    expect(response.status).toBe(500);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(persistedState).toEqual(initialState);
  });
});
