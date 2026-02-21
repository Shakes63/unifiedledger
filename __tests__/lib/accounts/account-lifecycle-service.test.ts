import { describe, expect, it } from 'vitest';
import { resolveCreditProfileForAccountType } from '@/lib/accounts/account-lifecycle-service';

const existingCreditProfile = {
  interestRate: 24.99,
  minimumPaymentPercent: 2,
  minimumPaymentFloor: 35,
  statementDueDate: '15',
  annualFee: 95,
  annualFeeMonth: 8,
  autoCreatePaymentBill: true,
  includeInPayoffStrategy: true,
  isSecured: true,
  securedAsset: 'Vehicle',
  drawPeriodEndDate: '2030-01-01',
  repaymentPeriodEndDate: '2035-01-01',
  interestType: 'variable',
  primeRateMargin: 3.5,
};

describe('resolveCreditProfileForAccountType', () => {
  it('clears credit and line-of-credit metadata when switching to non-credit account type', () => {
    const resolved = resolveCreditProfileForAccountType({
      accountType: 'checking',
      existing: existingCreditProfile,
      updates: {},
      calculatedMinimumPayment: 40,
    });

    expect(resolved).toEqual({
      interestRate: null,
      minimumPaymentPercent: null,
      minimumPaymentFloor: null,
      minimumPaymentAmount: null,
      statementDueDate: null,
      annualFee: null,
      annualFeeMonth: null,
      autoCreatePaymentBill: true,
      includeInPayoffStrategy: false,
      isSecured: false,
      securedAsset: null,
      drawPeriodEndDate: null,
      repaymentPeriodEndDate: null,
      interestType: 'fixed',
      primeRateMargin: null,
    });
  });

  it('keeps line-of-credit fields editable only for line_of_credit accounts', () => {
    const resolved = resolveCreditProfileForAccountType({
      accountType: 'line_of_credit',
      existing: existingCreditProfile,
      updates: {
        isSecured: false,
        securedAsset: '',
        interestType: 'fixed',
      },
      calculatedMinimumPayment: 55,
    });

    expect(resolved.isSecured).toBe(false);
    expect(resolved.securedAsset).toBe(null);
    expect(resolved.interestType).toBe('fixed');
    expect(resolved.minimumPaymentAmount).toBe(55);
    expect(resolved.annualFee).toBe(95);
  });
});
