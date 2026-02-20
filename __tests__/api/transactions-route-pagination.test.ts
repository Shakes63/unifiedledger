import util from 'node:util';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { GET } from '@/app/api/transactions/route';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/api/household-auth', () => ({
  getHouseholdIdFromRequest: vi.fn(),
  requireHouseholdAuth: vi.fn(),
}));

vi.mock('@/lib/preferences/transfer-view-preference', () => ({
  getCombinedTransferViewPreference: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { getCombinedTransferViewPreference } from '@/lib/preferences/transfer-view-preference';
import { db } from '@/lib/db';

describe('GET /api/transactions pagination and filter correctness', () => {
  const userId = 'user-1';
  const householdId = 'hh-1';

  beforeEach(() => {
    vi.clearAllMocks();

    (requireAuth as Mock).mockResolvedValue({ userId });
    (getHouseholdIdFromRequest as Mock).mockReturnValue(householdId);
    (requireHouseholdAuth as Mock).mockResolvedValue({ householdId, userId });
  });

  it('applies accountId to both list and count query criteria', async () => {
    (getCombinedTransferViewPreference as Mock).mockResolvedValue(false);

    (db.select as Mock)
      .mockImplementationOnce(() => ({
        from: () => ({
          leftJoin: () => ({
            where: (whereArg: unknown) => ({
              orderBy: () => ({
                limit: () => ({
                  offset: async () => {
                    const whereText = util.inspect(whereArg, { depth: 8, colors: false });
                    if (whereText.includes('acc-1')) {
                      return [{ id: 'tx-1', accountId: 'acc-1', type: 'expense', date: '2026-01-02' }];
                    }
                    return [
                      { id: 'tx-1', accountId: 'acc-1', type: 'expense', date: '2026-01-02' },
                      { id: 'tx-2', accountId: 'acc-2', type: 'income', date: '2026-01-01' },
                    ];
                  },
                }),
              }),
            }),
          }),
        }),
      }))
      .mockImplementationOnce(() => ({
        from: () => ({
          where: async (whereArg: unknown) => {
            const whereText = util.inspect(whereArg, { depth: 8, colors: false });
            return [{ count: whereText.includes('acc-1') ? 1 : 2 }];
          },
        }),
      }));

    const response = await GET(new Request('http://localhost/api/transactions?limit=50&offset=0&accountId=acc-1'));
    expect(response.status).toBe(200);

    const payload = await response.json() as {
      data: Array<{ accountId: string }>;
      total: number;
    };

    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]?.accountId).toBe('acc-1');
    expect(payload.total).toBe(1);
  });

  it('filters transfer_in in SQL before pagination for combined transfer view', async () => {
    (getCombinedTransferViewPreference as Mock).mockResolvedValue(true);

    (db.select as Mock)
      .mockImplementationOnce(() => ({
        from: () => ({
          leftJoin: () => ({
            where: (whereArg: unknown) => ({
              orderBy: () => ({
                limit: () => ({
                  offset: async () => {
                    const whereText = util.inspect(whereArg, { depth: 8, colors: false });
                    if (whereText.includes('transfer_in')) {
                      return [
                        { id: 'tx-out', type: 'transfer_out', date: '2026-01-05' },
                        { id: 'tx-exp', type: 'expense', date: '2026-01-03' },
                      ];
                    }

                    return [
                      { id: 'tx-out', type: 'transfer_out', date: '2026-01-05' },
                      { id: 'tx-in', type: 'transfer_in', date: '2026-01-04' },
                    ];
                  },
                }),
              }),
            }),
          }),
        }),
      }))
      .mockImplementationOnce(() => ({
        from: () => ({
          where: async () => [{ count: 3 }],
        }),
      }));

    const response = await GET(new Request('http://localhost/api/transactions?limit=2&offset=0'));
    expect(response.status).toBe(200);

    const payload = await response.json() as {
      data: Array<{ id: string; type: string }>;
      total: number;
    };

    expect(payload.data.map((tx) => tx.id)).toEqual(['tx-out', 'tx-exp']);
    expect(payload.data).toHaveLength(2);
    expect(payload.total).toBe(3);
  });
});
