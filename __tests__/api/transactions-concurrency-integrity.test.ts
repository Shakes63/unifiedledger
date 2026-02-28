import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import util from 'node:util';

import { POST } from '@/app/api/transactions/route';

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
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { accounts, transactions, usageAnalytics } from '@/lib/db/schema';

interface FakeAccount {
  id: string;
  currentBalance: number;
  currentBalanceCents: number;
  usageCount: number;
  type: string;
}

interface FakeTransaction {
  id: string;
  accountId: string;
  type: 'transfer_out' | 'transfer_in';
  amount: number;
  amountCents: number;
  transferId: string;
  transferGroupId?: string;
  pairedTransactionId?: string;
  transferSourceAccountId: string;
  transferDestinationAccountId: string;
}

interface FakeState {
  accounts: Record<string, FakeAccount>;
  transactions: FakeTransaction[];
}

function extractAccountIdFromWhere(whereArg: unknown): string | null {
  const whereStr = util.inspect(whereArg, { depth: 8, colors: false });
  if (whereStr.includes('acc-source')) return 'acc-source';
  if (whereStr.includes('acc-dest')) return 'acc-dest';
  return null;
}

describe('POST /api/transactions concurrency integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as Mock).mockResolvedValue({ userId: 'user-1' });
    (getHouseholdIdFromRequest as Mock).mockReturnValue('hh-1');
    (requireHouseholdAuth as Mock).mockResolvedValue({ householdId: 'hh-1', userId: 'user-1' });
  });

  it('keeps balances and transfer linkage consistent when concurrent writes hit the same accounts and one fails', async () => {
    let persistedState: FakeState = {
      accounts: {
        'acc-source': { id: 'acc-source', currentBalance: 1000, currentBalanceCents: 100000, usageCount: 1, type: 'checking' },
        'acc-dest': { id: 'acc-dest', currentBalance: 500, currentBalanceCents: 50000, usageCount: 2, type: 'savings' },
      },
      transactions: [],
    };

    (db.select as Mock).mockReturnValue({
      from: (table: unknown) => ({
        where: (whereArg: unknown) => ({
          limit: async () => {
            if (table === accounts) {
              const accountId = extractAccountIdFromWhere(whereArg);
              if (!accountId) return [];
              return [persistedState.accounts[accountId]];
            }
            if (table === usageAnalytics) {
              return [];
            }
            return [];
          },
        }),
      }),
    });

    (db.insert as Mock).mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });

    (db.update as Mock).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    let transactionAttempt = 0;
    let txLock = Promise.resolve();

    (db.transaction as Mock).mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) => {
        const run = async () => {
          transactionAttempt += 1;
          const thisAttempt = transactionAttempt;
          const stagedState: FakeState = structuredClone(persistedState);

          const tx = {
            insert: (table: unknown) => ({
              values: async (values: Record<string, unknown>) => {
                if (table === transactions) {
                  stagedState.transactions.push({
                    id: String(values.id),
                    accountId: String(values.accountId),
                    type: values.type as FakeTransaction['type'],
                    amount: Number(values.amount),
                    amountCents: Number(values.amountCents),
                    transferId: String(values.transferId),
                    transferGroupId: values.transferGroupId ? String(values.transferGroupId) : undefined,
                    pairedTransactionId: values.pairedTransactionId ? String(values.pairedTransactionId) : undefined,
                    transferSourceAccountId: String(values.transferSourceAccountId),
                    transferDestinationAccountId: String(values.transferDestinationAccountId),
                  });
                }
              },
            }),
            update: (table: unknown) => ({
              set: (updates: Record<string, unknown>) => ({
                where: async (whereArg: unknown) => {
                  if (table === accounts) {
                    const accountId = extractAccountIdFromWhere(whereArg);
                    if (!accountId) return;
                    stagedState.accounts[accountId].currentBalance = Number(
                      updates.currentBalance ?? stagedState.accounts[accountId].currentBalance
                    );
                    stagedState.accounts[accountId].currentBalanceCents = Number(
                      updates.currentBalanceCents ?? stagedState.accounts[accountId].currentBalanceCents
                    );
                    stagedState.accounts[accountId].usageCount = Number(
                      updates.usageCount ?? stagedState.accounts[accountId].usageCount
                    );
                  }
                },
              }),
            }),
            select: () => ({
              from: (table: unknown) => ({
                where: (whereArg: unknown) => ({
                  limit: async () => {
                    if (table === accounts) {
                      const accountId = extractAccountIdFromWhere(whereArg);
                      if (!accountId) return [];
                      return [stagedState.accounts[accountId]];
                    }
                    if (table === usageAnalytics) {
                      return [];
                    }
                    return [];
                  },
                }),
              }),
            }),
          };

          await callback(tx);

          // Simulate one concurrent transfer failing after staged writes.
          if (thisAttempt === 2) {
            throw new Error('simulated concurrent transfer failure');
          }

          persistedState = stagedState;
          return undefined;
        };

        const queued = txLock.then(run, run);
        txLock = queued.then(
          () => undefined,
          () => undefined
        );
        return queued;
      }
    );

    const firstRequest = POST({
      url: 'http://localhost/api/transactions',
      headers: new Headers({ 'x-household-id': 'hh-1' }),
      json: async () => ({
        accountId: 'acc-source',
        toAccountId: 'acc-dest',
        date: '2026-02-19',
        amount: 100,
        description: 'Concurrent transfer 1',
        type: 'transfer',
      }),
    } as unknown as Request);

    const secondRequest = POST({
      url: 'http://localhost/api/transactions',
      headers: new Headers({ 'x-household-id': 'hh-1' }),
      json: async () => ({
        accountId: 'acc-source',
        toAccountId: 'acc-dest',
        date: '2026-02-19',
        amount: 50,
        description: 'Concurrent transfer 2',
        type: 'transfer',
      }),
    } as unknown as Request);

    const [firstResponse, secondResponse] = await Promise.all([firstRequest, secondRequest]);

    const statuses = [firstResponse.status, secondResponse.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 500]);

    // Exactly one transfer pair should persist.
    expect(persistedState.transactions).toHaveLength(2);
    const transferOut = persistedState.transactions.find((row) => row.type === 'transfer_out');
    const transferIn = persistedState.transactions.find((row) => row.type === 'transfer_in');
    expect(transferOut).toBeTruthy();
    expect(transferIn).toBeTruthy();
    expect(transferOut?.transferGroupId).toBeTruthy();
    expect(transferIn?.transferGroupId).toBe(transferOut?.transferGroupId);
    expect(transferOut?.pairedTransactionId).toBe(transferIn?.id);
    expect(transferIn?.pairedTransactionId).toBe(transferOut?.id);

    // No drift: balances reflect only one committed transfer (100).
    expect(persistedState.accounts['acc-source'].currentBalance).toBe(900);
    expect(persistedState.accounts['acc-dest'].currentBalance).toBe(600);
  });

  it('keeps balances consistent with 3 concurrent writes when middle write fails', async () => {
    let persistedState: FakeState = {
      accounts: {
        'acc-source': { id: 'acc-source', currentBalance: 1000, currentBalanceCents: 100000, usageCount: 1, type: 'checking' },
        'acc-dest': { id: 'acc-dest', currentBalance: 500, currentBalanceCents: 50000, usageCount: 2, type: 'savings' },
      },
      transactions: [],
    };

    (db.select as Mock).mockReturnValue({
      from: (table: unknown) => ({
        where: (whereArg: unknown) => ({
          limit: async () => {
            if (table === accounts) {
              const accountId = extractAccountIdFromWhere(whereArg);
              if (!accountId) return [];
              return [persistedState.accounts[accountId]];
            }
            if (table === usageAnalytics) {
              return [];
            }
            return [];
          },
        }),
      }),
    });

    (db.insert as Mock).mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });

    (db.update as Mock).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    let transactionAttempt = 0;
    let txLock = Promise.resolve();

    (db.transaction as Mock).mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) => {
        const run = async () => {
          transactionAttempt += 1;
          const thisAttempt = transactionAttempt;
          const stagedState: FakeState = structuredClone(persistedState);

          const tx = {
            insert: (table: unknown) => ({
              values: async (values: Record<string, unknown>) => {
                if (table === transactions) {
                  stagedState.transactions.push({
                    id: String(values.id),
                    accountId: String(values.accountId),
                    type: values.type as FakeTransaction['type'],
                    amount: Number(values.amount),
                    amountCents: Number(values.amountCents),
                    transferId: String(values.transferId),
                    transferGroupId: values.transferGroupId ? String(values.transferGroupId) : undefined,
                    pairedTransactionId: values.pairedTransactionId ? String(values.pairedTransactionId) : undefined,
                    transferSourceAccountId: String(values.transferSourceAccountId),
                    transferDestinationAccountId: String(values.transferDestinationAccountId),
                  });
                }
              },
            }),
            update: (table: unknown) => ({
              set: (updates: Record<string, unknown>) => ({
                where: async (whereArg: unknown) => {
                  if (table === accounts) {
                    const accountId = extractAccountIdFromWhere(whereArg);
                    if (!accountId) return;
                    stagedState.accounts[accountId].currentBalance = Number(
                      updates.currentBalance ?? stagedState.accounts[accountId].currentBalance
                    );
                    stagedState.accounts[accountId].currentBalanceCents = Number(
                      updates.currentBalanceCents ?? stagedState.accounts[accountId].currentBalanceCents
                    );
                    stagedState.accounts[accountId].usageCount = Number(
                      updates.usageCount ?? stagedState.accounts[accountId].usageCount
                    );
                  }
                },
              }),
            }),
            select: () => ({
              from: (table: unknown) => ({
                where: (whereArg: unknown) => ({
                  limit: async () => {
                    if (table === accounts) {
                      const accountId = extractAccountIdFromWhere(whereArg);
                      if (!accountId) return [];
                      return [stagedState.accounts[accountId]];
                    }
                    if (table === usageAnalytics) {
                      return [];
                    }
                    return [];
                  },
                }),
              }),
            }),
          };

          await callback(tx);

          if (thisAttempt === 2) {
            throw new Error('simulated concurrent transfer failure');
          }

          persistedState = stagedState;
          return undefined;
        };

        const queued = txLock.then(run, run);
        txLock = queued.then(
          () => undefined,
          () => undefined
        );
        return queued;
      }
    );

    const firstRequest = POST({
      url: 'http://localhost/api/transactions',
      headers: new Headers({ 'x-household-id': 'hh-1' }),
      json: async () => ({
        accountId: 'acc-source',
        toAccountId: 'acc-dest',
        date: '2026-02-19',
        amount: 100,
        description: 'Concurrent transfer 1',
        type: 'transfer',
      }),
    } as unknown as Request);

    const secondRequest = POST({
      url: 'http://localhost/api/transactions',
      headers: new Headers({ 'x-household-id': 'hh-1' }),
      json: async () => ({
        accountId: 'acc-source',
        toAccountId: 'acc-dest',
        date: '2026-02-19',
        amount: 50,
        description: 'Concurrent transfer 2',
        type: 'transfer',
      }),
    } as unknown as Request);

    const thirdRequest = POST({
      url: 'http://localhost/api/transactions',
      headers: new Headers({ 'x-household-id': 'hh-1' }),
      json: async () => ({
        accountId: 'acc-source',
        toAccountId: 'acc-dest',
        date: '2026-02-19',
        amount: 25,
        description: 'Concurrent transfer 3',
        type: 'transfer',
      }),
    } as unknown as Request);

    const responses = await Promise.all([firstRequest, secondRequest, thirdRequest]);
    const statuses = responses.map((response) => response.status).sort((a, b) => a - b);

    expect(statuses).toEqual([201, 201, 500]);
    expect(persistedState.transactions).toHaveLength(4);
    expect(persistedState.accounts['acc-source'].currentBalance).toBe(875);
    expect(persistedState.accounts['acc-dest'].currentBalance).toBe(625);
  });
});
