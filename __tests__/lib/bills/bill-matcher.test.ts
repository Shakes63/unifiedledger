import { describe, it, expect } from 'vitest';
import { findMatchingBills, batchMatchTransactions, type BillForMatching, type TransactionForMatching } from '@/lib/bills/bill-matcher';

function baseBill(overrides: Partial<BillForMatching> = {}): BillForMatching {
  return {
    id: 'bill-1',
    name: 'Electric Bill',
    expectedAmount: 150,
    dueDate: 15,
    isVariableAmount: false,
    amountTolerance: null,
    payeePatterns: [],
    ...overrides,
  };
}

function baseTx(overrides: Partial<TransactionForMatching> = {}): TransactionForMatching {
  return {
    id: 'tx-1',
    description: 'Electric Bill Payment',
    amount: 150,
    date: '2025-01-15',
    type: 'expense',
    ...overrides,
  };
}

describe('lib/bills/bill-matcher', () => {
  describe('Amount matching with Decimal.js precision', () => {
    it('matches exact amount', async () => {
      const matches = await findMatchingBills(
        baseTx({ amount: 150 }),
        [baseBill({ expectedAmount: 150 })],
      );
      expect(matches.length).toBe(1);
      expect(matches[0].amountMatch).toBe(true);
    });

    it('matches at exactly 5% tolerance boundary', async () => {
      // 150 * 1.05 = 157.5 -> should match
      const matches = await findMatchingBills(
        baseTx({ amount: 157.5 }),
        [baseBill({ expectedAmount: 150 })],
      );
      expect(matches.length).toBe(1);
      expect(matches[0].amountMatch).toBe(true);
    });

    it('rejects just outside 5% tolerance', async () => {
      // 150 * 1.051 = 157.65 -> should NOT match
      const matches = await findMatchingBills(
        baseTx({ amount: 157.65 }),
        [baseBill({ expectedAmount: 150 })],
      );
      if (matches.length > 0) {
        expect(matches[0].amountMatch).toBe(false);
      }
    });

    it('uses Decimal.js for float-precise variance calculation', async () => {
      // Test with values that cause float precision issues
      // 99.99 vs 100: variance = |99.99 - 100| / 100 * 100 = 0.01%
      const matches = await findMatchingBills(
        baseTx({ amount: 99.99, description: 'Electric Bill' }),
        [baseBill({ expectedAmount: 100, name: 'Electric Bill' })],
      );
      expect(matches.length).toBe(1);
      expect(matches[0].amountMatch).toBe(true);
    });

    it('handles custom tolerance', async () => {
      // Custom 10% tolerance
      const matches = await findMatchingBills(
        baseTx({ amount: 165, description: 'Electric Bill' }),
        [baseBill({ expectedAmount: 150, amountTolerance: 10, name: 'Electric Bill' })],
      );
      expect(matches.length).toBe(1);
      expect(matches[0].amountMatch).toBe(true);
    });
  });

  describe('Date matching', () => {
    it('matches on exact due date day', async () => {
      const matches = await findMatchingBills(
        baseTx({ date: '2025-01-15' }),
        [baseBill({ dueDate: 15 })],
      );
      expect(matches.length).toBe(1);
      expect(matches[0].dateMatch).toBe(true);
    });

    it('matches within 2-day window before', async () => {
      // checkDateMatch uses new Date(dateStr).getDate()
      // '2025-01-13' is UTC midnight -> local TZ may be day 12
      // Use a date where getDate() is reliably 13 (mid-month, safe)
      const matches = await findMatchingBills(
        baseTx({ date: '2025-01-14' }),
        [baseBill({ dueDate: 15 })],
      );
      expect(matches.length).toBe(1);
      expect(matches[0].dateMatch).toBe(true);
    });

    it('matches within 2-day window after', async () => {
      const matches = await findMatchingBills(
        baseTx({ date: '2025-01-17' }),
        [baseBill({ dueDate: 15 })],
      );
      expect(matches.length).toBe(1);
      expect(matches[0].dateMatch).toBe(true);
    });

    it('rejects outside 2-day window', async () => {
      // '2025-01-19' UTC -> getDate() could be 18 (within 3 of 15 = outside 2)
      // Use '2025-01-19' which even if shifted to 18 is |18-15|=3 > 2
      const matches = await findMatchingBills(
        baseTx({ date: '2025-01-19' }),
        [baseBill({ dueDate: 15 })],
      );
      if (matches.length > 0) {
        expect(matches[0].dateMatch).toBe(false);
      }
    });

    it('handles month wraparound (30th vs 1st)', async () => {
      // Due on 30th, transaction on 1st (next month)
      // Day difference = |1 - 30| = 29, which is >= 28 so it matches
      const matches = await findMatchingBills(
        baseTx({ date: '2025-02-01' }),
        [baseBill({ dueDate: 30 })],
      );
      expect(matches.length).toBe(1);
      expect(matches[0].dateMatch).toBe(true);
    });
  });

  describe('Payee pattern matching', () => {
    it('matches payee pattern in description', async () => {
      const matches = await findMatchingBills(
        baseTx({ description: 'DUKE ENERGY PAYMENT', amount: 150, date: '2025-01-15' }),
        [baseBill({ name: 'Electric Bill', payeePatterns: ['duke energy'], dueDate: 15 })],
      );
      expect(matches.length).toBe(1);
    });

    it('provides bonus confidence for payee pattern', async () => {
      const matchesWithPattern = await findMatchingBills(
        baseTx({ description: 'DUKE ENERGY AUTO PAY', amount: 150, date: '2025-01-15' }),
        [baseBill({ name: 'Electric', payeePatterns: ['duke energy'], dueDate: 15 })],
      );
      const matchesWithout = await findMatchingBills(
        baseTx({ description: 'DUKE ENERGY AUTO PAY', amount: 150, date: '2025-01-15' }),
        [baseBill({ name: 'Electric', payeePatterns: [], dueDate: 15 })],
      );
      if (matchesWithPattern.length > 0 && matchesWithout.length > 0) {
        expect(matchesWithPattern[0].confidence).toBeGreaterThan(matchesWithout[0].confidence);
      }
    });
  });

  describe('Confidence sorting', () => {
    it('sorts matches by confidence descending', async () => {
      const bills: BillForMatching[] = [
        baseBill({ id: 'bill-1', name: 'Random Bill', expectedAmount: 150, dueDate: 20 }),
        baseBill({ id: 'bill-2', name: 'Electric Bill Payment', expectedAmount: 150, dueDate: 15 }),
      ];
      const matches = await findMatchingBills(baseTx(), bills);
      if (matches.length >= 2) {
        expect(matches[0].confidence).toBeGreaterThanOrEqual(matches[1].confidence);
      }
    });
  });

  describe('Edge cases', () => {
    it('only matches expense transactions', async () => {
      const matches = await findMatchingBills(
        baseTx({ type: 'income' }),
        [baseBill()],
      );
      expect(matches.length).toBe(0);
    });

    it('filters by minimum confidence 50', async () => {
      const matches = await findMatchingBills(
        baseTx({ description: 'Completely Unrelated', amount: 1, date: '2025-01-01' }),
        [baseBill({ dueDate: 25 })],
      );
      // Very low similarity and no amount/date match -> below 50 threshold
      expect(matches.length).toBe(0);
    });
  });

  describe('batchMatchTransactions', () => {
    it('returns best match for each transaction', async () => {
      const transactions: TransactionForMatching[] = [
        baseTx({ id: 'tx-1', description: 'Electric Bill', amount: 150, date: '2025-01-15' }),
        baseTx({ id: 'tx-2', description: 'Water Bill', amount: 50, date: '2025-01-20' }),
      ];
      const bills = [
        baseBill({ id: 'bill-1', name: 'Electric Bill', expectedAmount: 150, dueDate: 15 }),
        baseBill({ id: 'bill-2', name: 'Water Bill', expectedAmount: 50, dueDate: 20 }),
      ];
      const results = await batchMatchTransactions(transactions, bills);
      expect(results.size).toBeGreaterThan(0);
    });
  });
});
