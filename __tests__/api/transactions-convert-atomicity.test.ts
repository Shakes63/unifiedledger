import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { POST } from '@/app/api/transactions/[id]/convert-to-transfer/route';

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
    transaction: vi.fn(),
  },
}));

import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { accounts, transactions } from '@/lib/db/schema';

interface FakeAccount {
  id: string;
  currentBalance: number;
  currentBalanceCents: number;
  userId: string;
  householdId: string;
  name: string;
}

interface FakeTransaction {
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
}

interface FakeState {
  accounts: {
    source: FakeAccount;
    target: FakeAccount;
  };
  transactions: {
    original: FakeTransaction;
    paired: FakeTransaction[];
  };
}

describe('POST /api/transactions/[id]/convert-to-transfer atomicity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as Mock).mockResolvedValue({ userId: 'user-1' });
    (getHouseholdIdFromRequest as Mock).mockReturnValue('hh-1');
    (requireHouseholdAuth as Mock).mockResolvedValue({ userId: 'user-1', householdId: 'hh-1' });
  });

  it('rolls back conversion writes when balance updates fail mid-transaction', async () => {
    const initialState: FakeState = {
      accounts: {
        source: {
          id: 'acc-source',
          currentBalance: 1000,
          currentBalanceCents: 100000,
          userId: 'user-1',
          householdId: 'hh-1',
          name: 'Checking',
        },
        target: {
          id: 'acc-target',
          currentBalance: 400,
          currentBalanceCents: 40000,
          userId: 'user-1',
          householdId: 'hh-1',
          name: 'Savings',
        },
      },
      transactions: {
        original: {
          id: 'tx-original',
          userId: 'user-1',
          householdId: 'hh-1',
          accountId: 'acc-source',
          amount: 120,
          amountCents: 12000,
          type: 'expense',
          date: '2026-02-01',
          description: 'Move money',
          notes: null,
          isPending: false,
        },
        paired: [],
      },
    };

    let persistedState: FakeState = structuredClone(initialState);
    let preTxSelectCall = 0;

    (db.select as Mock).mockReturnValue({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => {
            if (table === transactions) {
              preTxSelectCall += 1;
              if (preTxSelectCall === 1) {
                return [persistedState.transactions.original];
              }
            }

            if (table === accounts) {
              preTxSelectCall += 1;
              if (preTxSelectCall === 2) {
                return [persistedState.accounts.target];
              }
              if (preTxSelectCall === 3) {
                return [persistedState.accounts.source];
              }
            }

            return [];
          },
        }),
      }),
    });

    (db.transaction as Mock).mockImplementation(async (callback: (tx: unknown) => Promise<void>) => {
      const stagedState: FakeState = structuredClone(persistedState);
      let txAccountSelectCall = 0;
      let txAccountUpdateCall = 0;

      const tx = {
        select: () => ({
          from: (table: unknown) => ({
            where: () => ({
              limit: async () => {
                if (table === accounts) {
                  txAccountSelectCall += 1;
                  if (txAccountSelectCall === 1) {
                    return [stagedState.accounts.source];
                  }
                  return [stagedState.accounts.target];
                }
                return [];
              },
            }),
          }),
        }),
        insert: (table: unknown) => ({
          values: async (values: Record<string, unknown>) => {
            if (table === transactions) {
              stagedState.transactions.paired.push(values as unknown as FakeTransaction);
            }
          },
        }),
        update: (table: unknown) => ({
          set: (updates: Record<string, unknown>) => ({
            where: async () => {
              if (table === transactions) {
                stagedState.transactions.original.type = updates.type as FakeTransaction['type'] ?? stagedState.transactions.original.type;
                return;
              }

              if (table === accounts) {
                txAccountUpdateCall += 1;
                if (txAccountUpdateCall === 1) {
                  throw new Error('simulated final target account update failure');
                }

                stagedState.accounts.target.currentBalance = Number(
                  updates.currentBalance ?? stagedState.accounts.target.currentBalance
                );
                stagedState.accounts.target.currentBalanceCents = Number(
                  updates.currentBalanceCents ?? stagedState.accounts.target.currentBalanceCents
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
      url: 'http://localhost/api/transactions/tx-original/convert-to-transfer',
      headers: new Headers({ 'x-household-id': 'hh-1' }),
      json: async () => ({
        targetAccountId: 'acc-target',
      }),
    } as unknown as Request;

    const response = await POST(request, { params: Promise.resolve({ id: 'tx-original' }) });
    expect(response.status).toBe(500);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(persistedState).toEqual(initialState);
  });

  it('rolls back conversion writes when paired transfer insert fails', async () => {
    const initialState: FakeState = {
      accounts: {
        source: {
          id: 'acc-source',
          currentBalance: 1000,
          currentBalanceCents: 100000,
          userId: 'user-1',
          householdId: 'hh-1',
          name: 'Checking',
        },
        target: {
          id: 'acc-target',
          currentBalance: 400,
          currentBalanceCents: 40000,
          userId: 'user-1',
          householdId: 'hh-1',
          name: 'Savings',
        },
      },
      transactions: {
        original: {
          id: 'tx-original',
          userId: 'user-1',
          householdId: 'hh-1',
          accountId: 'acc-source',
          amount: 120,
          amountCents: 12000,
          type: 'expense',
          date: '2026-02-01',
          description: 'Move money',
          notes: null,
          isPending: false,
        },
        paired: [],
      },
    };

    let persistedState: FakeState = structuredClone(initialState);
    let preTxSelectCall = 0;

    (db.select as Mock).mockReturnValue({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => {
            if (table === transactions) {
              preTxSelectCall += 1;
              if (preTxSelectCall === 1) {
                return [persistedState.transactions.original];
              }
            }

            if (table === accounts) {
              preTxSelectCall += 1;
              if (preTxSelectCall === 2) {
                return [persistedState.accounts.target];
              }
              if (preTxSelectCall === 3) {
                return [persistedState.accounts.source];
              }
            }

            return [];
          },
        }),
      }),
    });

    (db.transaction as Mock).mockImplementation(async (callback: (tx: unknown) => Promise<void>) => {
      const stagedState: FakeState = structuredClone(persistedState);
      let txAccountSelectCall = 0;

      const tx = {
        select: () => ({
          from: (table: unknown) => ({
            where: () => ({
              limit: async () => {
                if (table === accounts) {
                  txAccountSelectCall += 1;
                  if (txAccountSelectCall === 1) {
                    return [stagedState.accounts.source];
                  }
                  return [stagedState.accounts.target];
                }
                return [];
              },
            }),
          }),
        }),
        insert: (table: unknown) => ({
          values: async (values: Record<string, unknown>) => {
            if (table === transactions) {
              throw new Error(`simulated paired insert failure for ${String(values.id)}`);
            }
          },
        }),
        update: (table: unknown) => ({
          set: (updates: Record<string, unknown>) => ({
            where: async () => {
              if (table === transactions) {
                stagedState.transactions.original.type = updates.type as FakeTransaction['type'] ?? stagedState.transactions.original.type;
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
      url: 'http://localhost/api/transactions/tx-original/convert-to-transfer',
      headers: new Headers({ 'x-household-id': 'hh-1' }),
      json: async () => ({
        targetAccountId: 'acc-target',
      }),
    } as unknown as Request;

    const response = await POST(request, { params: Promise.resolve({ id: 'tx-original' }) });
    expect(response.status).toBe(500);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(persistedState).toEqual(initialState);
  });
});
