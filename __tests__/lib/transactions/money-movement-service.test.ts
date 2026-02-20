import { describe, expect, it } from 'vitest';

import {
  getAccountBalanceCents,
  getTransactionAmountCents,
  getTransferAmountCents,
  getTransferFeesCents,
} from '@/lib/transactions/money-movement-service';

describe('money-movement-service strict cents contract', () => {
  it('reads cents fields when present', () => {
    expect(getAccountBalanceCents({ currentBalanceCents: 12345 })).toBe(12345);
    expect(getTransactionAmountCents({ amountCents: -6789 })).toBe(-6789);
    expect(getTransferAmountCents({ amountCents: 2500 })).toBe(2500);
    expect(getTransferFeesCents({ feesCents: 25 })).toBe(25);
  });

  it('throws when required cents fields are missing', () => {
    expect(() => getAccountBalanceCents({ currentBalanceCents: null })).toThrow(
      'Account balance cents is required'
    );
    expect(() => getTransactionAmountCents({ amountCents: null })).toThrow(
      'Transaction amount cents is required'
    );
    expect(() => getTransferAmountCents({ amountCents: null })).toThrow(
      'Transfer amount cents is required'
    );
    expect(() => getTransferFeesCents({ feesCents: null })).toThrow(
      'Transfer fees cents is required'
    );
  });
});
