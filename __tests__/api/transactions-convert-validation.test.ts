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
  },
}));

import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { accounts, transactions } from '@/lib/db/schema';

describe('POST /api/transactions/[id]/convert-to-transfer validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as Mock).mockResolvedValue({ userId: 'user-1' });
    (getHouseholdIdFromRequest as Mock).mockReturnValue('hh-1');
    (requireHouseholdAuth as Mock).mockResolvedValue({ userId: 'user-1', householdId: 'hh-1' });
  });

  it('returns 400 when targetAccountId is missing', async () => {
    const response = await POST(
      {
        url: 'http://localhost/api/transactions/tx-1/convert-to-transfer',
        headers: new Headers({ 'x-household-id': 'hh-1' }),
        json: async () => ({}),
      } as unknown as Request,
      { params: Promise.resolve({ id: 'tx-1' }) }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Target account ID is required' });
    expect(db.select).not.toHaveBeenCalled();
  });

  it('returns 400 when source and target account are the same', async () => {
    (db.select as Mock).mockReturnValue({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => {
            if (table === transactions) {
              return [{
                id: 'tx-1',
                userId: 'user-1',
                householdId: 'hh-1',
                accountId: 'acc-source',
                amount: 55,
                amountCents: 5500,
                type: 'expense',
                date: '2026-02-22',
                description: 'Same account transfer attempt',
                notes: null,
                isPending: false,
              }];
            }
            if (table === accounts) {
              return [{
                id: 'acc-source',
                userId: 'user-1',
                householdId: 'hh-1',
                currentBalance: 500,
                currentBalanceCents: 50000,
                name: 'Checking',
              }];
            }
            return [];
          },
        }),
      }),
    });

    const response = await POST(
      {
        url: 'http://localhost/api/transactions/tx-1/convert-to-transfer',
        headers: new Headers({ 'x-household-id': 'hh-1' }),
        json: async () => ({ targetAccountId: 'acc-source' }),
      } as unknown as Request,
      { params: Promise.resolve({ id: 'tx-1' }) }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Cannot transfer to the same account' });
  });

  it('returns 404 when scoped transaction is not found', async () => {
    (db.select as Mock).mockReturnValue({
      from: () => ({
        where: () => ({
          limit: async () => [],
        }),
      }),
    });

    const response = await POST(
      {
        url: 'http://localhost/api/transactions/missing/convert-to-transfer',
        headers: new Headers({ 'x-household-id': 'hh-1' }),
        json: async () => ({ targetAccountId: 'acc-target' }),
      } as unknown as Request,
      { params: Promise.resolve({ id: 'missing' }) }
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Transaction not found' });
  });
});
