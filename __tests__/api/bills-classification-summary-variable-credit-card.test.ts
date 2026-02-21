import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET as GET_CLASSIFICATION_SUMMARY } from '@/app/api/bills-v2/classification-summary/route';

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

describe('GET /api/bills-v2/classification-summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses upcoming occurrence amounts for variable credit card payment bills when default amount is 0', async () => {
    (requireAuth as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
      userId: 'user_1',
    });

    (getAndVerifyHousehold as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
      householdId: 'hh_1',
    });

    (listBillTemplates as unknown as { mockResolvedValue: (value: unknown) => void }).mockResolvedValue({
      data: [
        {
          id: 'bill_cc_payment',
          householdId: 'hh_1',
          createdByUserId: 'user_1',
          name: 'Credit Card Payment',
          description: null,
          isActive: true,
          billType: 'expense',
          classification: 'loan_payment',
          classificationSubcategory: null,
          recurrenceType: 'monthly',
          recurrenceDueDay: 1,
          recurrenceDueWeekday: null,
          recurrenceSpecificDueDate: null,
          recurrenceStartMonth: null,
          defaultAmountCents: 0,
          isVariableAmount: true,
          amountToleranceBps: 500,
          categoryId: null,
          merchantId: null,
          paymentAccountId: null,
          linkedLiabilityAccountId: null,
          chargedToAccountId: null,
          autoMarkPaid: true,
          notes: null,
          debtEnabled: false,
          debtOriginalBalanceCents: null,
          debtRemainingBalanceCents: null,
          debtInterestAprBps: null,
          debtInterestType: null,
          debtStartDate: null,
          debtColor: null,
          includeInPayoffStrategy: true,
          interestTaxDeductible: false,
          interestTaxDeductionType: 'none',
          interestTaxDeductionLimitCents: null,
          budgetPeriodAssignment: null,
          splitAcrossPeriods: false,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
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
            templateId: 'bill_cc_payment',
            householdId: 'hh_1',
            dueDate: '2026-02-20',
            status: 'unpaid',
            amountDueCents: 12300,
            amountPaidCents: 0,
            amountRemainingCents: 12300,
            actualAmountCents: null,
            paidDate: null,
            lastTransactionId: null,
            daysLate: 0,
            lateFeeCents: 0,
            isManualOverride: false,
            budgetPeriodOverride: null,
            notes: null,
            createdAt: '2026-02-01T00:00:00.000Z',
            updatedAt: '2026-02-01T00:00:00.000Z',
          },
          template: {
            id: 'bill_cc_payment',
            householdId: 'hh_1',
            createdByUserId: 'user_1',
            name: 'Credit Card Payment',
            description: null,
            isActive: true,
            billType: 'expense',
            classification: 'loan_payment',
            classificationSubcategory: null,
            recurrenceType: 'monthly',
            recurrenceDueDay: 1,
            recurrenceDueWeekday: null,
            recurrenceSpecificDueDate: null,
            recurrenceStartMonth: null,
            defaultAmountCents: 0,
            isVariableAmount: true,
            amountToleranceBps: 500,
            categoryId: null,
            merchantId: null,
            paymentAccountId: null,
            linkedLiabilityAccountId: null,
            chargedToAccountId: null,
            autoMarkPaid: true,
            notes: null,
            debtEnabled: false,
            debtOriginalBalanceCents: null,
            debtRemainingBalanceCents: null,
            debtInterestAprBps: null,
            debtInterestType: null,
            debtStartDate: null,
            debtColor: null,
            includeInPayoffStrategy: true,
            interestTaxDeductible: false,
            interestTaxDeductionType: 'none',
            interestTaxDeductionLimitCents: null,
            budgetPeriodAssignment: null,
            splitAcrossPeriods: false,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          allocations: [],
        },
      ],
      summary: {
        overdueCount: 0,
        overdueAmountCents: 0,
        upcomingCount: 1,
        upcomingAmountCents: 12300,
        nextDueDate: '2026-02-20',
        paidThisPeriodCount: 0,
        paidThisPeriodAmountCents: 0,
      },
      total: 1,
      limit: 5000,
      offset: 0,
    });

    const request = {
      headers: new Headers(),
      url: 'https://example.com/api/bills-v2/classification-summary?householdId=hh_1',
    } as unknown as Request;

    const response = await GET_CLASSIFICATION_SUMMARY(request);
    expect(response.status).toBe(200);

    const json = (await response.json()) as {
      data: Array<{ classification: string; totalMonthly: number; count: number }>;
      totals: { totalMonthly: number; totalCount: number };
    };

    const loanPayment = json.data.find((item) => item.classification === 'loan_payment');
    expect(loanPayment).toBeTruthy();
    expect(loanPayment?.count).toBe(1);
    expect(loanPayment?.totalMonthly).toBeCloseTo(123, 5);
    expect(json.totals.totalMonthly).toBeCloseTo(123, 5);
    expect(json.totals.totalCount).toBe(1);
  });
});
