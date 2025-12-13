import { describe, it, expect } from 'vitest';
import { generateTaxPdfArrayBuffer, type TaxExportData } from '@/lib/tax/tax-pdf-export';

describe('lib/tax/tax-pdf-export', () => {
  it('generates a valid PDF ArrayBuffer', () => {
    const data: TaxExportData = {
      year: 2025,
      totalIncome: 100000,
      totalDeductions: 1234.56,
      businessDeductions: 1000,
      personalDeductions: 234.56,
      taxableIncome: 98765.44,
      estimatedQuarterlyPayment: 5000,
      estimatedAnnualTax: 20000,
      filterType: 'all',
      categories: [
        {
          categoryId: 'taxcat-1',
          categoryName: 'Office Expense',
          formType: 'schedule_c',
          lineNumber: '18',
          totalAmount: 1234.56,
          transactionCount: 3,
          isDeductible: true,
          deductionType: 'business',
        },
      ],
    };

    const buf = generateTaxPdfArrayBuffer(data, { generatedAt: new Date('2025-01-01T00:00:00Z') });
    const bytes = new Uint8Array(buf);

    // PDF files begin with "%PDF"
    expect(bytes[0]).toBe(0x25); // %
    expect(bytes[1]).toBe(0x50); // P
    expect(bytes[2]).toBe(0x44); // D
    expect(bytes[3]).toBe(0x46); // F
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });
});
