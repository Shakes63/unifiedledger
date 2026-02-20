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

describe('POST /api/transactions/[id]/convert-to-transfer linkage fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as Mock).mockResolvedValue({ userId: 'user-1' });
    (getHouseholdIdFromRequest as Mock).mockReturnValue('hh-1');
    (requireHouseholdAuth as Mock).mockResolvedValue({ userId: 'user-1', householdId: 'hh-1' });
  });

  it('writes explicit transfer source/destination account fields and does not use merchantId for transfer metadata', async () => {
    const insertedTransactions: Array<Record<string, unknown>> = [];
    const transactionUpdates: Array<Record<string, unknown>> = [];
    let preTxSelectCall = 0;

    (db.select as Mock).mockReturnValue({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => {
            preTxSelectCall += 1;

            if (table === transactions && preTxSelectCall === 1) {
              return [{
                id: 'tx-original',
                userId: 'user-1',
                householdId: 'hh-1',
                accountId: 'acc-source',
                amount: 120,
                type: 'expense',
                date: '2026-02-18',
                description: 'Move money',
                notes: null,
                isPending: false,
              }];
            }

            if (table === accounts && preTxSelectCall === 2) {
              return [{
                id: 'acc-target',
                userId: 'user-1',
                householdId: 'hh-1',
                currentBalance: 400,
                name: 'Savings',
              }];
            }

            if (table === accounts && preTxSelectCall === 3) {
              return [{
                id: 'acc-source',
                userId: 'user-1',
                householdId: 'hh-1',
                currentBalance: 1000,
                name: 'Checking',
              }];
            }

            return [];
          },
        }),
      }),
    });

    (db.transaction as Mock).mockImplementation(async (callback: (tx: unknown) => Promise<void>) => {
      let txAccountSelectCall = 0;

      const tx = {
        select: () => ({
          from: (table: unknown) => ({
            where: () => ({
              limit: async () => {
                if (table === accounts) {
                  txAccountSelectCall += 1;
                  if (txAccountSelectCall === 1) {
                    return [{ id: 'acc-source', currentBalance: 1000 }];
                  }
                  return [{ id: 'acc-target', currentBalance: 400 }];
                }
                return [];
              },
            }),
          }),
        }),
        insert: (table: unknown) => ({
          values: async (values: Record<string, unknown>) => {
            if (table === transactions) {
              insertedTransactions.push(values);
            }
          },
        }),
        update: (table: unknown) => ({
          set: (updates: Record<string, unknown>) => ({
            where: async () => {
              if (table === transactions) {
                transactionUpdates.push(updates);
              }
            },
          }),
        }),
      };

      await callback(tx);
    });

    const request = {
      url: 'http://localhost/api/transactions/tx-original/convert-to-transfer',
      headers: new Headers({ 'x-household-id': 'hh-1' }),
      json: async () => ({
        targetAccountId: 'acc-target',
      }),
    } as unknown as Request;

    const response = await POST(request, { params: Promise.resolve({ id: 'tx-original' }) });

    expect(response.status).toBe(200);
    expect(insertedTransactions).toHaveLength(1);
    expect(insertedTransactions[0]).toEqual(
      expect.objectContaining({
        type: 'transfer_in',
        merchantId: null,
        transferSourceAccountId: 'acc-source',
        transferDestinationAccountId: 'acc-target',
      })
    );

    expect(transactionUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'transfer_out',
          merchantId: null,
          transferSourceAccountId: 'acc-source',
          transferDestinationAccountId: 'acc-target',
        }),
      ])
    );

    const merchantHackUpdates = transactionUpdates.filter(
      (update) => update.merchantId === 'acc-source' || update.merchantId === 'acc-target'
    );
    expect(merchantHackUpdates).toHaveLength(0);
  });
});
