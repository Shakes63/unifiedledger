import { describe, it, expect } from 'vitest';
import {
  calculateAutopayAmount,
  getAutopayDescription,
  validateAutopayConfiguration,
  type BillForAutopay,
  type LinkedAccountData,
  type PayingAccountData,
  type BillInstanceForAutopay,
} from '@/lib/bills/autopay-calculator';

function baseBill(overrides: Partial<BillForAutopay> = {}): BillForAutopay {
  return {
    id: 'bill-1',
    name: 'Test Bill',
    expectedAmount: 100,
    autopayAmountType: null,
    autopayFixedAmount: null,
    linkedAccountId: null,
    isDebt: false,
    ...overrides,
  };
}

function baseInstance(overrides: Partial<BillInstanceForAutopay> = {}): BillInstanceForAutopay {
  return {
    expectedAmount: 100,
    paidAmount: null,
    remainingAmount: null,
    ...overrides,
  };
}

function payingAccount(overrides: Partial<PayingAccountData> = {}): PayingAccountData {
  return {
    currentBalance: 1000,
    type: 'checking',
    ...overrides,
  };
}

describe('lib/bills/autopay-calculator', () => {
  describe('calculateAutopayAmount', () => {
    it('defaults to remaining expected amount when autopayAmountType is null', () => {
      const res = calculateAutopayAmount(
        baseBill({ autopayAmountType: null }),
        baseInstance({ expectedAmount: 120, paidAmount: 20 }),
        null,
        payingAccount({ currentBalance: 500 })
      );
      expect(res.amount).toBe(100);
      expect(res.amountSource).toBe('Expected Amount');
      expect(res.insufficientFunds).toBe(false);
    });

    it('fixed uses autopayFixedAmount when set', () => {
      const res = calculateAutopayAmount(
        baseBill({ autopayAmountType: 'fixed', autopayFixedAmount: 55.555 }),
        baseInstance({ expectedAmount: 100 }),
        null,
        payingAccount({ currentBalance: 500 })
      );
      expect(res.amount).toBe(55.56);
      expect(res.amountSource).toBe('Fixed Amount');
    });

    it('fixed falls back to instance expected amount when autopayFixedAmount is null', () => {
      const res = calculateAutopayAmount(
        baseBill({ autopayAmountType: 'fixed', autopayFixedAmount: null }),
        baseInstance({ expectedAmount: 77, paidAmount: 0 }),
        null,
        payingAccount({ currentBalance: 500 })
      );
      expect(res.amount).toBe(77);
    });

    it('minimum_payment uses linked account minimumPaymentAmount when present', () => {
      const linked: LinkedAccountData = {
        currentBalance: -2500,
        statementBalance: -2000,
        minimumPaymentAmount: 35,
        creditLimit: 10000,
      };
      const res = calculateAutopayAmount(
        baseBill({ autopayAmountType: 'minimum_payment', linkedAccountId: 'acc-1' }),
        baseInstance({ expectedAmount: 120, paidAmount: 10 }),
        linked,
        payingAccount({ currentBalance: 500 })
      );
      expect(res.amount).toBe(35);
      expect(res.amountSource).toBe('Minimum Payment');
      expect(res.minimumRequired).toBe(35);
    });

    it('minimum_payment falls back to remaining amount when linked account data missing', () => {
      const res = calculateAutopayAmount(
        baseBill({ autopayAmountType: 'minimum_payment', linkedAccountId: 'acc-1' }),
        baseInstance({ expectedAmount: 120, paidAmount: 10 }),
        null,
        payingAccount({ currentBalance: 500 })
      );
      expect(res.amount).toBe(110);
      expect(res.amountSource).toBe('Minimum Payment (Expected)');
    });

    it('statement_balance uses absolute statementBalance and keeps minimumRequired as minimumPaymentAmount if present', () => {
      const linked: LinkedAccountData = {
        currentBalance: -2500,
        statementBalance: -2000,
        minimumPaymentAmount: 40,
        creditLimit: 10000,
      };
      const res = calculateAutopayAmount(
        baseBill({ autopayAmountType: 'statement_balance', linkedAccountId: 'acc-1' }),
        baseInstance({ expectedAmount: 120 }),
        linked,
        payingAccount({ currentBalance: 5000 })
      );
      expect(res.amount).toBe(2000);
      expect(res.amountSource).toBe('Statement Balance');
      expect(res.minimumRequired).toBe(40);
    });

    it('full_balance uses absolute currentBalance and keeps minimumRequired as minimumPaymentAmount if present', () => {
      const linked: LinkedAccountData = {
        currentBalance: -123.456,
        statementBalance: -2000,
        minimumPaymentAmount: 25,
        creditLimit: 10000,
      };
      const res = calculateAutopayAmount(
        baseBill({ autopayAmountType: 'full_balance', linkedAccountId: 'acc-1' }),
        baseInstance({ expectedAmount: 120 }),
        linked,
        payingAccount({ currentBalance: 5000 })
      );
      expect(res.amount).toBe(123.46);
      expect(res.amountSource).toBe('Full Balance');
      expect(res.minimumRequired).toBe(25);
    });

    it('returns Nothing Owed when calculated amount is <= 0', () => {
      const linked: LinkedAccountData = {
        currentBalance: 50, // credit balance, abs() => 50 (positive) so not nothing owed; use 0
        statementBalance: 0,
        minimumPaymentAmount: 0,
        creditLimit: 10000,
      };
      const res = calculateAutopayAmount(
        baseBill({ autopayAmountType: 'statement_balance', linkedAccountId: 'acc-1' }),
        baseInstance({ expectedAmount: 100, remainingAmount: 0 }),
        linked,
        payingAccount({ currentBalance: 10 })
      );
      expect(res.amount).toBe(0);
      expect(res.amountSource).toContain('(Nothing Owed)');
      expect(res.insufficientFunds).toBe(false);
    });

    it('sets insufficientFunds=true when paying account balance is less than amount', () => {
      const res = calculateAutopayAmount(
        baseBill({ autopayAmountType: null }),
        baseInstance({ expectedAmount: 100 }),
        null,
        payingAccount({ currentBalance: 20 })
      );
      expect(res.amount).toBe(100);
      expect(res.insufficientFunds).toBe(true);
    });
  });

  describe('getAutopayDescription', () => {
    it('formats fixed amount and days before', () => {
      const desc = getAutopayDescription('fixed', 12.5, 2);
      expect(desc).toBe('$12.50 fixed 2 days before due');
    });

    it('formats on due date when daysBefore=0', () => {
      const desc = getAutopayDescription('minimum_payment', null, 0);
      expect(desc).toBe('Minimum payment on due date');
    });
  });

  describe('validateAutopayConfiguration', () => {
    it('returns error when autopay account missing', () => {
      const err = validateAutopayConfiguration(baseBill(), null);
      expect(err).toBe('No payment account configured for autopay');
    });

    it('returns error when fixed amount is invalid', () => {
      const err = validateAutopayConfiguration(
        baseBill({ autopayAmountType: 'fixed', autopayFixedAmount: 0 }),
        'acc-pay'
      );
      expect(err).toBe('Fixed autopay amount must be greater than zero');
    });

    it('returns null when configuration is valid', () => {
      const err = validateAutopayConfiguration(
        baseBill({ autopayAmountType: 'minimum_payment', linkedAccountId: 'acc-1' }),
        'acc-pay'
      );
      expect(err).toBeNull();
    });
  });
});


