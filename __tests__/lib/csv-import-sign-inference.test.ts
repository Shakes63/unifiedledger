/**
 * Sign and type inference for CSV imports — the layer that produced six of the
 * nine criticals in the 2026-08-08 bug hunt, and which had no tests at all.
 *
 * Why this matters: confirm applies `computeBalanceDeltaCents(type, amountCents)`
 * faithfully. If the type or the sign is wrong the balance moves the WRONG WAY,
 * so every mistake here costs 2x the transaction amount.
 *
 * OWNER DECISION (2026-08-08): a single amount column is interpreted PER FILE —
 * if the column contains any negative value the file is "signed"
 * (negative = expense, positive = income); if it contains none, it is an
 * unsigned expense list and everything stays an expense.
 */
import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import {
  applyMappings,
  autoDetectMappings,
  detectAmountColumnIsSigned,
  type ColumnMapping,
} from '@/lib/csv-import';

const DATE = 'MM/DD/YYYY';

const map = (pairs: Array<[string, string]>): ColumnMapping[] =>
  pairs.map(([csvColumn, appField]) => ({ csvColumn, appField }) as ColumnMapping);

const amountOf = (t: { amount?: Decimal | number | string }) =>
  t.amount instanceof Decimal ? t.amount.toNumber() : Number(t.amount);

describe('detectAmountColumnIsSigned', () => {
  const mappings = map([
    ['Date', 'date'],
    ['Description', 'description'],
    ['Amount', 'amount'],
  ]);

  it('is signed when any amount is negative', () => {
    const rows = [
      { Date: '01/05/2026', Description: 'GROCERY', Amount: '-45.00' },
      { Date: '01/06/2026', Description: 'PAYROLL', Amount: '2000.00' },
    ];
    expect(detectAmountColumnIsSigned(rows, mappings)).toBe(true);
  });

  it('is unsigned when every amount is positive (an expense list)', () => {
    const rows = [
      { Date: '01/05/2026', Description: 'GROCERY', Amount: '45.00' },
      { Date: '01/06/2026', Description: 'GAS', Amount: '30.00' },
    ];
    expect(detectAmountColumnIsSigned(rows, mappings)).toBe(false);
  });

  it('recognises parenthesised negatives as signed', () => {
    const rows = [{ Date: '01/05/2026', Description: 'GROCERY', Amount: '(45.00)' }];
    expect(detectAmountColumnIsSigned(rows, mappings)).toBe(true);
  });

  it('ignores unparseable and blank cells rather than throwing', () => {
    const rows = [
      { Date: '01/05/2026', Description: 'A', Amount: '' },
      { Date: '01/06/2026', Description: 'B', Amount: 'n/a' },
      { Date: '01/07/2026', Description: 'C', Amount: '-1.00' },
    ];
    expect(detectAmountColumnIsSigned(rows, mappings)).toBe(true);
  });

  it('is unsigned when there is no amount column to inspect', () => {
    const rows = [{ Date: '01/05/2026', Description: 'A', Withdrawal: '45.00' }];
    expect(detectAmountColumnIsSigned(rows, map([['Withdrawal', 'withdrawal']]))).toBe(false);
  });
});

describe('applyMappings sign inference (M2/M3/P1)', () => {
  const mappings = map([
    ['Date', 'date'],
    ['Description', 'description'],
    ['Amount', 'amount'],
  ]);

  it('M2: in a signed file a positive amount is INCOME, not an expense', () => {
    // The headline bug: a $2,000 paycheck was typed 'expense', so confirm
    // applied a -200000 delta and the paycheck LOWERED the balance by $2,000.
    const t = applyMappings(
      { Date: '01/06/2026', Description: 'PAYROLL DEPOSIT', Amount: '2000.00' },
      mappings,
      DATE,
      'acct-1',
      { amountColumnIsSigned: true }
    );
    expect(t.type).toBe('income');
    expect(amountOf(t)).toBe(2000);
  });

  it('M2: in a signed file a negative amount is an expense with a positive magnitude', () => {
    const t = applyMappings(
      { Date: '01/05/2026', Description: 'GROCERY OUTLET', Amount: '-45.00' },
      mappings,
      DATE,
      'acct-1',
      { amountColumnIsSigned: true }
    );
    expect(t.type).toBe('expense');
    expect(amountOf(t)).toBe(45);
  });

  it('in an UNSIGNED file every row stays an expense (expense-list convention)', () => {
    const t = applyMappings(
      { Date: '01/05/2026', Description: 'GROCERY OUTLET', Amount: '45.00' },
      mappings,
      DATE,
      'acct-1',
      { amountColumnIsSigned: false }
    );
    expect(t.type).toBe('expense');
    expect(amountOf(t)).toBe(45);
  });

  it('M3/P1: a mapped type column no longer lets a negative amount through', () => {
    // The old code skipped normalization whenever a type/withdrawal/deposit
    // column was mapped, so amountCents went in NEGATIVE and the balance delta
    // inverted: a $45 purchase RAISED checking by $45.
    const withType = map([
      ['Date', 'date'],
      ['Description', 'description'],
      ['Type', 'type'],
      ['Amount', 'amount'],
    ]);
    const t = applyMappings(
      { Date: '01/05/2026', Description: 'GROCERY OUTLET', Type: 'DEBIT', Amount: '-45.00' },
      withType,
      DATE,
      'acct-1',
      { amountColumnIsSigned: true }
    );
    expect(t.type).toBe('expense');
    expect(amountOf(t)).toBe(45);
    expect(amountOf(t)).toBeGreaterThan(0);
  });

  it('M3/P1: a mapped type column keeps its own semantics for the TYPE', () => {
    const withType = map([
      ['Date', 'date'],
      ['Description', 'description'],
      ['Type', 'type'],
      ['Amount', 'amount'],
    ]);
    const t = applyMappings(
      { Date: '01/07/2026', Description: 'REFUND', Type: 'CREDIT', Amount: '-500.00' },
      withType,
      DATE,
      'acct-1',
      { amountColumnIsSigned: true }
    );
    // The mapped column says credit, so the row is income — but the magnitude
    // must still be positive so the delta is applied in the right direction.
    expect(t.type).toBe('income');
    expect(amountOf(t)).toBe(500);
  });

  it('the stored amount is never negative, whatever the input', () => {
    for (const raw of ['-45.00', '(45.00)', '45.00-', '45.00']) {
      const t = applyMappings(
        { Date: '01/05/2026', Description: 'X', Amount: raw },
        mappings,
        DATE,
        'acct-1',
        { amountColumnIsSigned: true }
      );
      expect(amountOf(t)).toBeGreaterThan(0);
    }
  });

  it('withdrawal/deposit dual columns keep working (this path was already correct)', () => {
    const dual = map([
      ['Date', 'date'],
      ['Description', 'description'],
      ['Withdrawal', 'withdrawal'],
      ['Deposit', 'deposit'],
    ]);
    const out = applyMappings(
      { Date: '01/05/2026', Description: 'GROCERY', Withdrawal: '45.00', Deposit: '' },
      dual,
      DATE,
      'acct-1'
    );
    expect(out.type).toBe('expense');
    expect(amountOf(out)).toBe(45);

    const inn = applyMappings(
      { Date: '01/06/2026', Description: 'PAYROLL', Withdrawal: '', Deposit: '2000.00' },
      dual,
      DATE,
      'acct-1'
    );
    expect(inn.type).toBe('income');
    expect(amountOf(inn)).toBe(2000);
  });
});

/**
 * Auto-detect column mapping — findings P7, P8, P9.
 * These headers are the exact shapes the hunt proved were mismapped.
 */
describe('autoDetectMappings (P7/P8/P9)', () => {
  const fieldFor = (headers: string[], column: string) =>
    autoDetectMappings(headers, false).find((m) => m.csvColumn === column)?.appField;

  it('P7: "Account Name" does not steal the description slot', () => {
    const headers = ['Account Name', 'Date', 'Description', 'Amount', 'Category'];
    expect(fieldFor(headers, 'Description')).toBe('description');
    expect(fieldFor(headers, 'Account Name')).not.toBe('description');
  });

  it('P8: a running-balance column is not mapped to amount', () => {
    const headers = ['Date', 'Description', 'Balance', 'Amount'];
    expect(fieldFor(headers, 'Amount')).toBe('amount');
    expect(fieldFor(headers, 'Balance')).not.toBe('amount');
  });

  it('P9: a bank Type column maps to type, not category', () => {
    const headers = ['Date', 'Description', 'Type', 'Amount'];
    expect(fieldFor(headers, 'Type')).toBe('type');
    expect(fieldFor(headers, 'Type')).not.toBe('category');
  });

  it('a real Category column still maps to category', () => {
    const headers = ['Date', 'Description', 'Category', 'Amount'];
    expect(fieldFor(headers, 'Category')).toBe('category');
  });

  it('"Transaction ID" and "Reference" are not descriptions', () => {
    const headers = ['Date', 'Transaction ID', 'Reference', 'Description', 'Amount'];
    expect(fieldFor(headers, 'Description')).toBe('description');
    expect(fieldFor(headers, 'Transaction ID')).not.toBe('description');
    expect(fieldFor(headers, 'Reference')).not.toBe('description');
  });
});
