import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { PUT } from '@/app/api/transactions/[id]/route';

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

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    transaction: vi.fn(),
  },
}));

import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { resolveAndRequireEntity } from '@/lib/api/entity-auth';
import { db } from '@/lib/db';
import { accounts, transactions } from '@/lib/db/schema';

interface FakeState {
  account: { id: string; currentBalance: number; currentBalanceCents: number };
  transaction: {
    id: string;
    userId: string;
    householdId: string;
    accountId: string;
    amount: number;
    amountCents: number;
    type: 'expense' | 'income' | 'transfer_in' | 'transfer_out';
    date: string;
    description: string;
    notes: string | null;
    isPending: boolean;
    categoryId: string | null;
    merchantId: string | null;
    transferId: string | null;
    isSalesTaxable: boolean;
    isTaxDeductible: boolean;
    billId: string | null;
    debtId: string | null;
  };
}

describe('PUT /api/transactions/[id] atomicity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as Mock).mockResolvedValue({ userId: 'user-1' });
    (getHouseholdIdFromRequest as Mock).mockReturnValue('hh-1');
    (requireHouseholdAuth as Mock).mockResolvedValue({ userId: 'user-1', householdId: 'hh-1' });
    (resolveAndRequireEntity as Mock).mockResolvedValue({
      id: 'entity_personal',
      householdId: 'hh-1',
      name: 'Personal',
      type: 'personal',
      isDefault: true,
      enableSalesTax: false,
      isActive: true,
    });
  });

  it('rolls back account balance updates when a mid-transaction write fails', async () => {
    const initialState: FakeState = {
      account: { id: 'acc-1', currentBalance: 1000, currentBalanceCents: 100000 },
      transaction: {
        id: 'tx-1',
        userId: 'user-1',
        householdId: 'hh-1',
        accountId: 'acc-1',
        amount: 100,
        amountCents: 10000,
        type: 'expense',
        date: '2026-02-01',
        description: 'Original',
        notes: null,
        isPending: false,
        categoryId: null,
        merchantId: null,
        transferId: null,
        isSalesTaxable: false,
        isTaxDeductible: false,
        billId: null,
        debtId: null,
      },
    };

    let persistedState: FakeState = structuredClone(initialState);

    (db.select as Mock).mockReturnValue({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => {
            if (table === transactions) {
              return [persistedState.transaction];
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
        select: () => ({
          from: (table: unknown) => ({
            where: () => ({
              limit: async () => {
                if (table === accounts) {
                  return [stagedState.account];
                }
                return [];
              },
            }),
            then: undefined,
          }),
        }),
        update: (table: unknown) => ({
          set: (updates: Record<string, unknown>) => ({
            where: async () => {
              if (table === accounts) {
                accountUpdateCount += 1;
                if (accountUpdateCount === 2) {
                  throw new Error('simulated second account update failure');
                }
                stagedState.account.currentBalance = Number(updates.currentBalance ?? stagedState.account.currentBalance);
                stagedState.account.currentBalanceCents = Number(
                  updates.currentBalanceCents ?? stagedState.account.currentBalanceCents
                );
                return;
              }

              if (table === transactions) {
                stagedState.transaction.amount = Number(updates.amount ?? stagedState.transaction.amount);
                stagedState.transaction.amountCents = Number(
                  updates.amountCents ?? stagedState.transaction.amountCents
                );
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
      url: 'http://localhost/api/transactions/tx-1',
      headers: new Headers({ 'x-household-id': 'hh-1' }),
      json: async () => ({
        amount: 150,
      }),
    } as unknown as Request;

    const response = await PUT(request, { params: Promise.resolve({ id: 'tx-1' }) });
    expect(response.status).toBe(500);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(persistedState).toEqual(initialState);
  });
});
