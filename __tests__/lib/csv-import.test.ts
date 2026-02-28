import { describe, it, expect } from 'vitest';
import { parseAmount, parseDate, autoDetectMappings } from '@/lib/csv-import';
import Decimal from 'decimal.js';

describe('lib/csv-import', () => {
  describe('parseAmount', () => {
    it('parses simple dollar amount', () => {
      const result = parseAmount('100.50');
      expect(result.toNumber()).toBe(100.5);
    });

    it('parses amount with dollar sign', () => {
      const result = parseAmount('$1,234.56');
      expect(result.toNumber()).toBe(1234.56);
    });

    it('parses amount with euro sign', () => {
      const result = parseAmount('€500.00');
      expect(result.toNumber()).toBe(500);
    });

    it('parses amount with pound sign', () => {
      const result = parseAmount('£99.99');
      expect(result.toNumber()).toBe(99.99);
    });

    it('parses amount with yen sign', () => {
      const result = parseAmount('¥1000');
      expect(result.toNumber()).toBe(1000);
    });

    it('parses parentheses as negative (accounting format)', () => {
      const result = parseAmount('(500.00)');
      expect(result.toNumber()).toBe(-500);
    });

    it('parses negative with dollar sign and parentheses', () => {
      const result = parseAmount('($1,234.56)');
      expect(result.toNumber()).toBe(-1234.56);
    });

    it('parses $0.00', () => {
      const result = parseAmount('$0.00');
      expect(result.toNumber()).toBe(0);
    });

    it('parses large amounts with commas', () => {
      const result = parseAmount('$999,999.99');
      expect(result.toNumber()).toBe(999999.99);
    });

    it('parses negative amounts', () => {
      const result = parseAmount('-50.25');
      expect(result.toNumber()).toBe(-50.25);
    });

    it('returns Decimal instance for precision', () => {
      const result = parseAmount('0.1');
      expect(result).toBeInstanceOf(Decimal);
      // Verify no float precision issue
      expect(result.plus(parseAmount('0.2')).toNumber()).toBe(0.3);
    });

    it('throws on empty string', () => {
      expect(() => parseAmount('')).toThrow('Amount is required');
    });

    it('throws on invalid amount', () => {
      expect(() => parseAmount('not a number')).toThrow();
    });

    it('handles whitespace', () => {
      const result = parseAmount('  $100.00  ');
      expect(result.toNumber()).toBe(100);
    });
  });

  describe('parseDate', () => {
    it('parses MM/DD/YYYY format', () => {
      const result = parseDate('01/15/2025', 'MM/DD/YYYY');
      expect(result).toBe('2025-01-15');
    });

    it('parses DD/MM/YYYY format', () => {
      const result = parseDate('15/01/2025', 'DD/MM/YYYY');
      expect(result).toBe('2025-01-15');
    });

    it('parses YYYY-MM-DD format (ISO)', () => {
      const result = parseDate('2025-01-15', 'YYYY-MM-DD');
      expect(result).toBe('2025-01-15');
    });

    it('parses MM-DD-YYYY format', () => {
      const result = parseDate('01-15-2025', 'MM-DD-YYYY');
      expect(result).toBe('2025-01-15');
    });

    it('throws on empty date', () => {
      expect(() => parseDate('', 'MM/DD/YYYY')).toThrow('Date is required');
    });

    it('parses ISO date string directly', () => {
      const result = parseDate('2025-03-25', 'YYYY-MM-DD');
      expect(result).toBe('2025-03-25');
    });

    it('rejects dates that do not match the configured format', () => {
      expect(() => parseDate('March 15, 2025', 'MM/DD/YYYY')).toThrow(
        'Invalid date format for MM/DD/YYYY: March 15, 2025'
      );
    });
  });

  describe('autoDetectMappings', () => {
    it('detects common bank CSV headers', () => {
      const headers = ['Date', 'Description', 'Amount', 'Category'];
      const mappings = autoDetectMappings(headers);

      expect(mappings.find(m => m.appField === 'date')?.csvColumn).toBe('Date');
      expect(mappings.find(m => m.appField === 'description')?.csvColumn).toBe('Description');
      expect(mappings.find(m => m.appField === 'amount')?.csvColumn).toBe('Amount');
      expect(mappings.find(m => m.appField === 'category')?.csvColumn).toBe('Category');
    });

    it('detects dual-column (withdrawal/deposit) format', () => {
      const headers = ['Date', 'Description', 'Withdrawal', 'Deposit'];
      const mappings = autoDetectMappings(headers);

      expect(mappings.find(m => m.appField === 'withdrawal')).toBeDefined();
      expect(mappings.find(m => m.appField === 'deposit')).toBeDefined();
    });

    it('prefers withdrawal/deposit over generic amount', () => {
      const headers = ['Date', 'Description', 'Withdrawal', 'Deposit', 'Amount'];
      const mappings = autoDetectMappings(headers);

      // Amount should be skipped when withdrawal/deposit are present
      expect(mappings.find(m => m.appField === 'amount')).toBeUndefined();
      expect(mappings.find(m => m.appField === 'withdrawal')).toBeDefined();
    });

    it('detects transaction date variations', () => {
      const headers = ['Transaction Date', 'Memo', 'Total'];
      const mappings = autoDetectMappings(headers);

      expect(mappings.find(m => m.appField === 'date')?.csvColumn).toBe('Transaction Date');
    });

    it('detects credit card specific fields when enabled', () => {
      // Use 'Card Type' which matches cc_transaction_type regex (/card\s*type/i)
      // but not the category regex (/category|type|class|cat/i) because
      // the category pattern iterates first per header - but 'Card Type' ALSO
      // matches /type/. The pattern iteration is per header, field order matters.
      // Since category appears before cc_transaction_type and 'Card Type' matches /type/,
      // it maps to category first. Instead test with 'Credit Limit' or 'Statement Balance'.
      const headers = ['Date', 'Description', 'Amount', 'Statement Balance'];
      const mappings = autoDetectMappings(headers, true);

      expect(mappings.find(m => m.appField === 'statement_balance')).toBeDefined();
    });

    it('skips credit card fields for bank accounts', () => {
      const headers = ['Date', 'Description', 'Amount', 'Statement Balance'];
      const mappings = autoDetectMappings(headers, false);

      expect(mappings.find(m => m.appField === 'statement_balance')).toBeUndefined();
    });
  });
});
