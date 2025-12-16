import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GET as GET_CLASSIFICATION_SUMMARY } from '@/app/api/bills/classification-summary/route';

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

function makeSelectResult<T>(rows: T[]) {
  return {
    from: () => ({
      innerJoin: () => ({
        where: () => Promise.resolve(rows),
      }),
      where: () => Promise.resolve(rows),
    }),
  };
}

describe('GET /api/bills/classification-summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses upcoming instance amounts for variable credit card payment bills when bill expectedAmount is 0 (regression)', async () => {
    (requireAuth as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      userId: 'user_1',
    });

    (getHouseholdIdFromRequest as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue('hh_1');
    (requireHouseholdAuth as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue(undefined);

    const activeBills = [
      {
        id: 'bill_cc_payment',
        expectedAmount: 0,
        frequency: 'monthly',
        billType: 'expense',
        billClassification: 'loan_payment',
        isVariableAmount: true,
      },
    ];

    const upcomingInstances = [
      {
        billId: 'bill_cc_payment',
        expectedAmount: 123,
      },
    ];

    const selectMock = db.select as unknown as {
      mockImplementationOnce: (fn: () => unknown) => unknown;
    };

    selectMock
      .mockImplementationOnce(() => makeSelectResult(activeBills))
      .mockImplementationOnce(() => makeSelectResult(upcomingInstances));

    const request = {
      headers: new Headers(),
      url: 'https://example.com/api/bills/classification-summary',
    } as unknown as Request;

    const response = await GET_CLASSIFICATION_SUMMARY(request as Request);
    expect(response.status).toBe(200);

    const json = (await response.json()) as {
      data: Array<{ classification: string; totalMonthly: number; count: number }>;
      totals: { totalMonthly: number; totalCount: number };
    };

    const loanPayment = json.data.find((i) => i.classification === 'loan_payment');
    expect(loanPayment).toBeTruthy();
    expect(loanPayment?.count).toBe(1);
    expect(loanPayment?.totalMonthly).toBeGreaterThan(0);
    expect(loanPayment?.totalMonthly).toBeCloseTo(123, 5);
    expect(json.totals.totalMonthly).toBeCloseTo(123, 5);
    expect(json.totals.totalCount).toBe(1);
  });
});


