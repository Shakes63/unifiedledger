/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/tax/export/pdf/route';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/tax/tax-utils', () => ({
  estimateQuarterlyTax: vi.fn(),
  getCurrentTaxYear: vi.fn(),
  getTaxYearSummary: vi.fn(),
}));

vi.mock('@/lib/tax/tax-pdf-export', () => ({
  generateTaxPdfArrayBuffer: vi.fn(),
  getTaxPdfFilename: vi.fn(),
}));

import { requireAuth } from '@/lib/auth-helpers';
import { estimateQuarterlyTax, getCurrentTaxYear, getTaxYearSummary } from '@/lib/tax/tax-utils';
import { generateTaxPdfArrayBuffer, getTaxPdfFilename } from '@/lib/tax/tax-pdf-export';

function createRequest(url: string): Request {
  return new Request(url, { method: 'GET' });
}

describe('GET /api/tax/export/pdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as any).mockResolvedValue({ userId: 'user-1' });
    (getCurrentTaxYear as any).mockReturnValue(2025);
    (estimateQuarterlyTax as any).mockReturnValue(5000);
    (getTaxPdfFilename as any).mockReturnValue('tax_deductions_2025.pdf');

    const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
    (generateTaxPdfArrayBuffer as any).mockReturnValue(pdfHeader.buffer);

    (getTaxYearSummary as any).mockResolvedValue({
      year: 2025,
      totalIncome: 1,
      totalDeductions: 2,
      businessDeductions: 0,
      personalDeductions: 0,
      taxableIncome: 0,
      byCategory: [{ categoryId: 'c1' }],
    });
  });

  it('returns 401 when unauthorized', async () => {
    (requireAuth as any).mockRejectedValue(new Error('Unauthorized'));

    const res = await GET(createRequest('http://localhost/api/tax/export/pdf?year=2025&type=all'));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 400 for invalid year', async () => {
    const res = await GET(createRequest('http://localhost/api/tax/export/pdf?year=1999&type=all'));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Invalid year');
  });

  it('returns 200 with application/pdf and filename header', async () => {
    const res = await GET(createRequest('http://localhost/api/tax/export/pdf?year=2025&type=all'));

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-disposition')).toContain('tax_deductions_2025.pdf');

    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    expect(bytes[0]).toBe(0x25);
    expect(bytes[1]).toBe(0x50);
    expect(bytes[2]).toBe(0x44);
    expect(bytes[3]).toBe(0x46);
  });

  it('returns 400 when there is no tax data to export', async () => {
    (getTaxYearSummary as any).mockResolvedValue({
      year: 2025,
      totalIncome: 0,
      totalDeductions: 0,
      businessDeductions: 0,
      personalDeductions: 0,
      taxableIncome: 0,
      byCategory: [],
    });

    const res = await GET(createRequest('http://localhost/api/tax/export/pdf?year=2025&type=all'));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('No tax data available to export');
  });
});
