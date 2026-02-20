import { describe, it, expect } from 'vitest';
import {
  detectDuplicateTransactions,
  calculateSimilarity,
  detectDuplicatesEnhanced,
  extractVendorName,
  merchantNameInDescription,
} from '@/lib/duplicate-detection';

describe('lib/duplicate-detection', () => {
  describe('calculateSimilarity', () => {
    it('returns 1 for identical strings', () => {
      expect(calculateSimilarity('Walmart Purchase', 'Walmart Purchase')).toBe(1);
    });

    it('returns 1 for empty strings', () => {
      expect(calculateSimilarity('', '')).toBe(1);
    });

    it('is case-insensitive', () => {
      expect(calculateSimilarity('WALMART', 'walmart')).toBe(1);
    });
  });

  describe('detectDuplicateTransactions - Decimal.js amount comparison', () => {
    const baseTransactions = [
      { id: '1', description: 'Walmart Grocery', amount: 52.30, date: '2025-01-15', type: 'expense' },
      { id: '2', description: 'Amazon Purchase', amount: 100.00, date: '2025-01-14', type: 'expense' },
    ];

    it('detects exact amount match', () => {
      const matches = detectDuplicateTransactions(
        'Walmart Grocery',
        52.30,
        '2025-01-15',
        baseTransactions,
      );
      expect(matches.length).toBe(1);
      expect(matches[0].id).toBe('1');
    });

    it('detects amount within 5% threshold', () => {
      // 52.30 * 0.05 = 2.615, so 54.91 should be within threshold
      const matches = detectDuplicateTransactions(
        'Walmart Grocery',
        54.91,
        '2025-01-15',
        baseTransactions,
      );
      expect(matches.length).toBe(1);
    });

    it('rejects amount outside 5% threshold', () => {
      // 52.30 * 1.06 = 55.438, outside 5%
      const matches = detectDuplicateTransactions(
        'Walmart Grocery',
        55.50,
        '2025-01-15',
        baseTransactions,
      );
      expect(matches.length).toBe(0);
    });

    it('handles float-tricky values (0.1 + 0.2 style)', () => {
      // This tests the Decimal.js fix: 0.1 + 0.2 = 0.30000000000000004 in JS
      const txs = [
        { id: '1', description: 'Test Store', amount: 0.3, date: '2025-01-15', type: 'expense' },
      ];
      const matches = detectDuplicateTransactions(
        'Test Store',
        0.3,
        '2025-01-15',
        txs,
      );
      // Exact same amount should match (amountPercentDiff = 0)
      expect(matches.length).toBe(1);
    });

    it('handles large amounts with precision', () => {
      const txs = [
        { id: '1', description: 'Large Payment', amount: 999999.99, date: '2025-01-15', type: 'expense' },
      ];
      const matches = detectDuplicateTransactions(
        'Large Payment',
        999999.99,
        '2025-01-15',
        txs,
      );
      expect(matches.length).toBe(1);
    });

    it('handles zero amounts correctly', () => {
      const matches = detectDuplicateTransactions(
        'Zero Charge',
        0,
        '2025-01-15',
        baseTransactions,
        { minAmount: 0.01 },
      );
      // Amount < minAmount should return empty
      expect(matches.length).toBe(0);
    });

    it('respects date range filtering', () => {
      const matches = detectDuplicateTransactions(
        'Walmart Grocery',
        52.30,
        '2025-01-25', // 10 days later, outside 7-day default
        baseTransactions,
      );
      expect(matches.length).toBe(0);
    });
  });

  describe('extractVendorName', () => {
    it('extracts vendor before transaction IDs', () => {
      expect(extractVendorName('WALMART #1234 PURCHASE')).toBe('walmart');
    });

    it('returns normalized full string when no separator', () => {
      expect(extractVendorName('Target')).toBe('target');
    });

    it('handles empty string', () => {
      expect(extractVendorName('')).toBe('');
    });
  });

  describe('merchantNameInDescription', () => {
    it('finds merchant name in description', () => {
      expect(merchantNameInDescription('Walmart', 'WALMART SUPERCENTER #1234')).toBe(true);
    });

    it('rejects short merchant names (< 3 chars)', () => {
      expect(merchantNameInDescription('WM', 'WM SUPERCENTER')).toBe(false);
    });

    it('returns false for empty inputs', () => {
      expect(merchantNameInDescription('', 'description')).toBe(false);
      expect(merchantNameInDescription('merchant', '')).toBe(false);
    });
  });

  describe('detectDuplicatesEnhanced', () => {
    const existingTransactions = [
      {
        id: '1',
        description: 'WALMART SUPERCENTER #5432',
        amount: 45.67,
        date: '2025-01-15',
        type: 'expense',
        accountId: 'acc-1',
        accountName: 'Checking',
        merchantName: 'Walmart',
      },
    ];

    const merchants = [{ id: 'm1', name: 'Walmart' }];

    it('detects Levenshtein-based duplicates', () => {
      const matches = detectDuplicatesEnhanced(
        'WALMART SUPERCENTER #5432',
        45.67,
        '2025-01-15',
        'acc-1',
        existingTransactions,
        merchants,
      );
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].matchReason).toBe('levenshtein');
    });

    it('only matches within same account', () => {
      const matches = detectDuplicatesEnhanced(
        'WALMART SUPERCENTER #5432',
        45.67,
        '2025-01-15',
        'acc-2', // Different account
        existingTransactions,
        merchants,
      );
      expect(matches.length).toBe(0);
    });

    it('handles Decimal.js amount comparison for merchant matching', () => {
      const matches = detectDuplicatesEnhanced(
        'WALMART STORE #9999',
        45.67,
        '2025-01-15',
        'acc-1',
        existingTransactions,
        merchants,
        { dateRangeInDays: 1 },
      );
      // Should match via merchant name since same amount, same date, same account
      expect(matches.length).toBeGreaterThan(0);
    });
  });
});
