import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET as GET_VARIABLE_BILLS } from '@/app/api/budgets/bills/variable/route';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/api/household-auth', () => ({
  getAndVerifyHousehold: vi.fn(),
}));

vi.mock('@/lib/bills-v2/service', () => ({
  listBillTemplates: vi.fn(),
  listOccurrences: vi.fn(),
}));

import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { listBillTemplates, listOccurrences } from '@/lib/bills-v2/service';

describe('GET /api/budgets/bills/variable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
      userId: 'user_1',
    });
    (getAndVerifyHousehold as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
      householdId: 'hh_1',
    });
  });

  it('aggregates multiple monthly occurrences for variable recurring bills', async () => {
    (listBillTemplates as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
      data: [
        {
          id: 'tmpl_1',
          name: 'Electric Bill',
          recurrenceType: 'weekly',
          defaultAmountCents: 2500,
          isVariableAmount: true,
          billType: 'expense',
          isActive: true,
        },
      ],
      total: 1,
      limit: 5000,
      offset: 0,
    });

    (listOccurrences as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
      data: [
        {
          occurrence: {
            id: 'occ_1',
            templateId: 'tmpl_1',
            dueDate: '2026-01-05',
            status: 'paid',
            amountDueCents: 1000,
            amountPaidCents: 1000,
            actualAmountCents: 1000,
            paidDate: '2026-01-05',
          },
        },
        {
          occurrence: {
            id: 'occ_2',
            templateId: 'tmpl_1',
            dueDate: '2026-01-12',
            status: 'paid',
            amountDueCents: 2000,
            amountPaidCents: 2000,
            actualAmountCents: 2000,
            paidDate: '2026-01-12',
          },
        },
        {
          occurrence: {
            id: 'occ_3',
            templateId: 'tmpl_1',
            dueDate: '2026-01-19',
            status: 'paid',
            amountDueCents: 3000,
            amountPaidCents: 3000,
            actualAmountCents: 3000,
            paidDate: '2026-01-19',
          },
        },
        {
          occurrence: {
            id: 'occ_4',
            templateId: 'tmpl_1',
            dueDate: '2026-01-26',
            status: 'paid',
            amountDueCents: 4000,
            amountPaidCents: 4000,
            actualAmountCents: 4000,
            paidDate: '2026-01-26',
          },
        },
      ],
      summary: {},
      total: 4,
      limit: 10000,
      offset: 0,
    });

    const request = {
      headers: new Headers(),
      url: 'https://example.com/api/budgets/bills/variable?month=2026-01',
    } as unknown as Request;

    const response = await GET_VARIABLE_BILLS(request);
    expect(response.status).toBe(200);

    const json = (await response.json()) as {
      month: string;
      summary: { totalExpected: number; totalActual: number; billCount: number };
      bills: Array<{
        id: string;
        currentMonth: { expectedAmount: number; actualAmount: number | null; status: string };
        historicalAverages: { allTime: number | null };
        monthlyBreakdown: Array<{ month: string; expected: number; actual: number | null }>;
      }>;
    };

    expect(json.month).toBe('2026-01');
    expect(json.summary.billCount).toBe(1);
    expect(json.summary.totalExpected).toBe(100);
    expect(json.summary.totalActual).toBe(100);
    expect(json.bills[0].currentMonth.expectedAmount).toBe(100);
    expect(json.bills[0].currentMonth.actualAmount).toBe(100);
    expect(json.bills[0].currentMonth.status).toBe('paid');
    expect(json.bills[0].historicalAverages.allTime).toBe(100);
    expect(json.bills[0].monthlyBreakdown.find((entry) => entry.month === '2026-01')).toEqual({
      month: '2026-01',
      expected: 100,
      actual: 100,
      variance: 0,
      status: 'paid',
    });

    expect(listBillTemplates).toHaveBeenCalledWith({
      householdId: 'hh_1',
      isActive: true,
      billType: 'expense',
      limit: 5000,
      offset: 0,
    });
  });

  it('returns empty response when there are no variable expense bill templates', async () => {
    (listBillTemplates as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
      data: [],
      total: 0,
      limit: 5000,
      offset: 0,
    });
    (listOccurrences as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
      data: [],
      summary: {},
      total: 0,
      limit: 10000,
      offset: 0,
    });

    const request = {
      headers: new Headers(),
      url: 'https://example.com/api/budgets/bills/variable?month=2026-02',
    } as unknown as Request;

    const response = await GET_VARIABLE_BILLS(request);
    expect(response.status).toBe(200);

    const json = (await response.json()) as {
      summary: { billCount: number; totalExpected: number; totalActual: number };
      bills: unknown[];
    };

    expect(json.summary.billCount).toBe(0);
    expect(json.summary.totalExpected).toBe(0);
    expect(json.summary.totalActual).toBe(0);
    expect(json.bills).toEqual([]);
  });
});
