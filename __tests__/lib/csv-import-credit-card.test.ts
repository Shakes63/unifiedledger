/**
 * Credit-card classification — findings P2, P3/M7, M4, M6.
 *
 * On a liability account the sign convention is positive-owed, so a
 * misclassified row moves the balance the wrong way by 2x the amount. These
 * cases are the literal descriptions the bug hunt proved were misread.
 */
import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import {
  applyCreditCardProcessing,
  detectCCTransactionType,
  type MappedTransaction,
} from '@/lib/csv-import';

const row = (overrides: Partial<MappedTransaction> = {}): MappedTransaction =>
  ({
    date: '2026-01-05',
    description: 'TEST',
    amount: new Decimal(50),
    type: 'expense',
    accountId: 'acct-1',
    ...overrides,
  }) as MappedTransaction;

const amountOf = (t: MappedTransaction) =>
  t.amount instanceof Decimal ? t.amount.toNumber() : Number(t.amount);

describe('detectCCTransactionType — merchant names are not transaction types (P3/M7)', () => {
  it.each([
    ['NAVY FEDERAL CREDIT UNION', 'purchase'],
    ['CREDIT KARMA', 'purchase'],
    ['BONUS BURGER GRILL', 'purchase'],
    ['REWARD SHOE STORE', 'purchase'],
    ['RALEIGH REFUNDS LLC', 'purchase'],
    ['PAYPAL *PAYMENTS INC', 'purchase'],
    ['CASINO ROYALE HOTEL', 'purchase'],
    ['IPARK PAYMENT NYC', 'purchase'],
  ])('classifies %s as %s', (description, expected) => {
    expect(detectCCTransactionType(description, 50)).toBe(expected);
  });

  it.each([
    ['PAYMENT - THANK YOU', 'payment'],
    ['AUTOPAY PAYMENT', 'payment'],
    ['ONLINE PAYMENT', 'payment'],
    ['AMAZON REFUND', 'refund'],
    ['MERCHANT RETURN', 'refund'],
    ['INTEREST CHARGE ON PURCHASES', 'interest'],
    ['ANNUAL FEE', 'fee'],
    ['CASH ADVANCE', 'cash_advance'],
    ['BALANCE TRANSFER', 'balance_transfer'],
    ['CASHBACK REWARD', 'reward'],
  ])('still recognises a genuine %s as %s', (description, expected) => {
    expect(detectCCTransactionType(description, 50)).toBe(expected);
  });
});

describe('applyCreditCardProcessing', () => {
  it('M4: a NEGATIVE payment reduces the card balance, not increases it', () => {
    // The Amex/Citi convention. This fell through both sign branches with its
    // sign intact, so paying $500 off the card ADDED $500 to the debt.
    const t = applyCreditCardProcessing(
      row({ description: 'PAYMENT THANK YOU', amount: new Decimal(-500) }),
      'credit_card'
    );
    expect(t.ccTransactionType).toBe('payment');
    expect(amountOf(t)).toBe(500);
    expect(amountOf(t)).toBeGreaterThan(0);
  });

  it('M4: the stored magnitude is always positive, under either convention', () => {
    for (const convention of ['standard', 'credit_card'] as const) {
      for (const amount of [-500, 500]) {
        const t = applyCreditCardProcessing(
          row({ description: 'PAYMENT THANK YOU', amount: new Decimal(amount) }),
          convention
        );
        expect(amountOf(t)).toBe(500);
      }
    }
  });

  it('P2: an authoritative Debit/Credit column is not overridden by the description', () => {
    // Capital One / Citi put the refund in a Credit column, which applyMappings
    // reads as income. Re-deriving the type from the description alone booked a
    // $4.50 refund as a $4.50 charge — a $9 swing.
    const t = applyCreditCardProcessing(
      row({ description: 'STARBUCKS STORE 1234', amount: new Decimal(4.5), type: 'income' }),
      'standard',
      undefined,
      { hasAuthoritativeDirection: true }
    );
    expect(t.type).toBe('income');
    expect(amountOf(t)).toBe(4.5);
  });

  it('P2: without an authoritative column, description-based detection still applies', () => {
    const t = applyCreditCardProcessing(
      row({ description: 'PAYMENT - THANK YOU', amount: new Decimal(500) }),
      'standard'
    );
    expect(t.ccTransactionType).toBe('payment');
    expect(t.type).toBe('transfer_in');
  });

  it('a plain purchase stays an expense', () => {
    const t = applyCreditCardProcessing(
      row({ description: 'GROCERY OUTLET', amount: new Decimal(45) }),
      'standard'
    );
    expect(t.ccTransactionType).toBe('purchase');
    expect(t.type).toBe('expense');
    expect(amountOf(t)).toBe(45);
  });

  it('M6: a balance transfer ONTO the card increases what is owed', () => {
    // transfer_in on a liability is a credit, so this reduced the balance owed
    // by $3,000 when it should have raised it.
    const t = applyCreditCardProcessing(
      row({ description: 'BALANCE TRANSFER FROM CHASE', amount: new Decimal(3000) }),
      'standard'
    );
    expect(t.ccTransactionType).toBe('balance_transfer');
    expect(t.isBalanceTransfer).toBe(true);
    // Money arriving as new debt on this card behaves like a purchase.
    expect(t.type).toBe('expense');
  });
});
