import util from 'node:util';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { GET } from '@/app/api/transactions/search/route';

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
    insert: vi.fn(),
  },
}));

import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { getCombinedTransferViewPreference } from '@/lib/preferences/transfer-view-preference';
import { db } from '@/lib/db';

describe('GET /api/transactions/search pagination correctness', () => {
  const userId = 'user-1';
  const householdId = 'hh-1';

  beforeEach(() => {
    vi.clearAllMocks();

    (requireAuth as Mock).mockResolvedValue({ userId });
    (getHouseholdIdFromRequest as Mock).mockReturnValue(householdId);
    (requireHouseholdAuth as Mock).mockResolvedValue({ householdId, userId });
    (db.insert as Mock).mockReturnValue({
      values: async () => undefined,
    });
  });

  it('uses combined-transfer filtering in query so total/hasMore remain stable', async () => {
    (getCombinedTransferViewPreference as Mock).mockResolvedValue(true);

    (db.select as Mock)
      .mockImplementationOnce(() => ({
        from: () => ({
          where: async (whereArg: unknown) => {
            const whereText = util.inspect(whereArg, { depth: 8, colors: false });
            return [{ count: whereText.includes('transfer_in') ? 3 : 5 }];
          },
        }),
      }))
      .mockImplementationOnce(() => ({
        from: () => ({
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
      }));

    const response = await GET(new Request('http://localhost/api/transactions/search?limit=2&offset=0'));
    expect(response.status).toBe(200);

    const payload = await response.json() as {
      transactions: Array<{ id: string; type: string }>;
      pagination: { total: number; hasMore: boolean };
    };

    expect(payload.transactions.map((tx) => tx.id)).toEqual(['tx-out', 'tx-exp']);
    expect(payload.pagination.total).toBe(3);
    expect(payload.pagination.hasMore).toBe(true);
  });
});
