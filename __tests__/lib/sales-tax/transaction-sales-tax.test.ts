/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { db } from '@/lib/db';
import { upsertSalesTaxSnapshot } from '@/lib/sales-tax/transaction-sales-tax';

function mockSelectLimit(rows: any[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

describe('lib/sales-tax/transaction-sales-tax upsertSalesTaxSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts snapshot record for taxable transaction with enabled settings', async () => {
    (db.select as any)
      .mockReturnValueOnce(
        mockSelectLimit([
          {
            defaultRate: 8.25,
            enableTracking: true,
            stateRate: 0,
            countyRate: 0,
            cityRate: 0,
            specialDistrictRate: 0,
            jurisdiction: 'TX',
            stateName: 'Texas',
            countyName: null,
            cityName: null,
            specialDistrictName: null,
          },
        ])
      )
      .mockReturnValueOnce(mockSelectLimit([]));

    const values = vi.fn().mockResolvedValue(undefined);
    (db.insert as any).mockReturnValue({ values });

    await upsertSalesTaxSnapshot({
      transactionId: 'tx-1',
      userId: 'u1',
      householdId: 'h1',
      accountId: 'a1',
      amountCents: 10000,
      date: '2026-01-15',
    });

    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: 'tx-1',
        taxableAmountCents: 10000,
        appliedRateBps: 825,
        taxAmountCents: 825,
        quarter: 1,
        taxYear: 2026,
      })
    );
  });

  it('updates existing snapshot instead of inserting duplicate', async () => {
    (db.select as any)
      .mockReturnValueOnce(
        mockSelectLimit([
          {
            defaultRate: 7.5,
            enableTracking: true,
            stateRate: 0,
            countyRate: 0,
            cityRate: 0,
            specialDistrictRate: 0,
            jurisdiction: null,
            stateName: null,
            countyName: null,
            cityName: null,
            specialDistrictName: null,
          },
        ])
      )
      .mockReturnValueOnce(mockSelectLimit([{ id: 'st-1' }]));

    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    (db.update as any).mockReturnValue({ set });

    await upsertSalesTaxSnapshot({
      transactionId: 'tx-1',
      userId: 'u1',
      householdId: 'h1',
      accountId: 'a2',
      amountCents: 20000,
      date: '2026-05-02',
    });

    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'a2',
        taxableAmountCents: 20000,
        appliedRateBps: 750,
        taxAmountCents: 1500,
        quarter: 2,
        taxYear: 2026,
      })
    );
  });

  it('deletes snapshot when tracking disabled', async () => {
    (db.select as any).mockReturnValueOnce(
      mockSelectLimit([
        {
          defaultRate: 8,
          enableTracking: false,
          stateRate: 0,
          countyRate: 0,
          cityRate: 0,
          specialDistrictRate: 0,
        },
      ])
    );
    const where = vi.fn().mockResolvedValue(undefined);
    (db.delete as any).mockReturnValue({ where });

    await upsertSalesTaxSnapshot({
      transactionId: 'tx-1',
      userId: 'u1',
      householdId: 'h1',
      accountId: 'a1',
      amountCents: 10000,
      date: '2026-01-15',
    });

    expect(db.delete).toHaveBeenCalledTimes(1);
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it('rounds taxAmountCents half-up on .5 boundaries', async () => {
    (db.select as any)
      .mockReturnValueOnce(
        mockSelectLimit([
          {
            defaultRate: 50,
            enableTracking: true,
            stateRate: 0,
            countyRate: 0,
            cityRate: 0,
            specialDistrictRate: 0,
            jurisdiction: null,
            stateName: null,
            countyName: null,
            cityName: null,
            specialDistrictName: null,
          },
        ])
      )
      .mockReturnValueOnce(mockSelectLimit([]));

    const values = vi.fn().mockResolvedValue(undefined);
    (db.insert as any).mockReturnValue({ values });

    await upsertSalesTaxSnapshot({
      transactionId: 'tx-round',
      userId: 'u1',
      householdId: 'h1',
      accountId: 'a1',
      amountCents: 1,
      date: '2026-01-01',
    });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        appliedRateBps: 5000,
        taxAmountCents: 1,
      })
    );
  });
});
