import { describe, expect, it } from 'vitest';
import {
  computeBalanceDeltaCents,
  isLiabilityAccountType,
} from '@/lib/transactions/money-movement-fields';

/**
 * C-MATH-1: balance deltas must be liability-aware. On an asset account a positive
 * balance is money you have; on a credit/line_of_credit account a positive balance
 * is money you OWE, so charges and payments move it the opposite way.
 */
describe('computeBalanceDeltaCents (C-MATH-1)', () => {
  it('classifies liability account types', () => {
    expect(isLiabilityAccountType('credit')).toBe(true);
    expect(isLiabilityAccountType('line_of_credit')).toBe(true);
    expect(isLiabilityAccountType('checking')).toBe(false);
    expect(isLiabilityAccountType('savings')).toBe(false);
    expect(isLiabilityAccountType(null)).toBe(false);
  });

  it('asset account: expense/transfer_out decrease, income/transfer_in increase', () => {
    const asset = (transactionType: 'income' | 'expense' | 'transfer_in' | 'transfer_out') =>
      computeBalanceDeltaCents({ accountType: 'checking', transactionType, amountCents: 5000 });
    expect(asset('expense')).toBe(-5000);
    expect(asset('transfer_out')).toBe(-5000);
    expect(asset('income')).toBe(5000);
    expect(asset('transfer_in')).toBe(5000);
  });

  it('liability account: a charge increases what you owe, a payment decreases it', () => {
    const credit = (transactionType: 'income' | 'expense' | 'transfer_in' | 'transfer_out') =>
      computeBalanceDeltaCents({ accountType: 'credit', transactionType, amountCents: 5000 });
    // Charging the card (expense / cash-advance transfer_out) increases the debt.
    expect(credit('expense')).toBe(5000);
    expect(credit('transfer_out')).toBe(5000);
    // Paying or refunding the card (income / transfer_in) reduces the debt.
    expect(credit('income')).toBe(-5000);
    expect(credit('transfer_in')).toBe(-5000);
  });

  it('a credit charge then a payment nets to zero owed', () => {
    let owed = 0;
    owed += computeBalanceDeltaCents({ accountType: 'credit', transactionType: 'expense', amountCents: 5000 });
    expect(owed).toBe(5000); // owe $50 after the charge
    owed += computeBalanceDeltaCents({ accountType: 'credit', transactionType: 'transfer_in', amountCents: 5000 });
    expect(owed).toBe(0); // paid off
  });
});
