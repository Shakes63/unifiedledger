/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/sales-tax/quarterly/route';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/sales-tax/sales-tax-utils', () => ({
  getYearlyQuarterlyReports: vi.fn(),
  getQuarterlyReport: vi.fn(),
  getQuarterlyReportsByAccount: vi.fn(),
  getYearlyQuarterlyReportsByAccount: vi.fn(),
  updateQuarterlyFilingStatus: vi.fn(),
  getFullSalesTaxSettings: vi.fn(),
  calculateTaxBreakdown: vi.fn(),
}));

import { requireAuth } from '@/lib/auth-helpers';
import {
  getYearlyQuarterlyReports,
  getQuarterlyReport,
  getQuarterlyReportsByAccount,
  getYearlyQuarterlyReportsByAccount,
  getFullSalesTaxSettings,
  calculateTaxBreakdown,
} from '@/lib/sales-tax/sales-tax-utils';

function createNextRequest(url: string): any {
  return {
    nextUrl: new URL(url),
  };
}

describe('GET /api/sales-tax/quarterly', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as any).mockResolvedValue({ userId: 'user-1' });

    (getYearlyQuarterlyReports as any).mockResolvedValue([]);
    (getQuarterlyReport as any).mockResolvedValue({ year: 2025, quarter: 1, totalSales: 0 });
    (getQuarterlyReportsByAccount as any).mockResolvedValue([]);
    (getYearlyQuarterlyReportsByAccount as any).mockResolvedValue([]);
    (getFullSalesTaxSettings as any).mockResolvedValue(null);
    (calculateTaxBreakdown as any).mockReturnValue({
      state: { name: 'State', rate: 0, amount: 0 },
      county: { name: 'County', rate: 0, amount: 0 },
      city: { name: 'City', rate: 0, amount: 0 },
      specialDistrict: { name: 'Special', rate: 0, amount: 0 },
      total: { rate: 0, amount: 0 },
    });
  });

  it('returns 401 when unauthorized', async () => {
    (requireAuth as any).mockRejectedValue(new Error('Unauthorized'));

    const res = await GET(createNextRequest('http://localhost/api/sales-tax/quarterly?year=2025'));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 400 for invalid year', async () => {
    const res = await GET(createNextRequest('http://localhost/api/sales-tax/quarterly?year=1999'));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Invalid year');
  });

  it('returns 400 for invalid quarter', async () => {
    const res = await GET(createNextRequest('http://localhost/api/sales-tax/quarterly?year=2025&quarter=0'));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Invalid quarter');
  });

  it('returns grouped-by-account yearly summary when byAccount=true and no quarter', async () => {
    (getYearlyQuarterlyReportsByAccount as any).mockResolvedValue([
      {
        accountId: 'acc-1',
        accountName: 'Biz 1',
        quarters: [
          { year: 2025, quarter: 1, totalSales: 100, totalTax: 8, balanceDue: 8 },
          { year: 2025, quarter: 2, totalSales: 50, totalTax: 4, balanceDue: 4 },
        ],
      },
    ]);

    const res = await GET(
      createNextRequest('http://localhost/api/sales-tax/quarterly?year=2025&byAccount=true')
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.year).toBe(2025);
    expect(data.byAccount).toBe(true);
    expect(data.accounts).toHaveLength(1);
    expect(data.accounts[0]).toEqual({
      accountId: 'acc-1',
      accountName: 'Biz 1',
      totalSales: 150,
      totalTax: 12,
      totalDue: 12,
      quarters: expect.any(Array),
    });

    expect(getYearlyQuarterlyReportsByAccount).toHaveBeenCalledWith('user-1', 2025);
  });

  it('returns grouped-by-account specific quarter when byAccount=true and quarter is provided', async () => {
    (getQuarterlyReportsByAccount as any).mockResolvedValue([
      {
        accountId: 'acc-1',
        accountName: 'Biz 1',
        report: { year: 2025, quarter: 2, totalSales: 100, totalTax: 8, balanceDue: 8 },
      },
    ]);

    const res = await GET(
      createNextRequest('http://localhost/api/sales-tax/quarterly?year=2025&quarter=2&byAccount=true')
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      year: 2025,
      quarter: 2,
      byAccount: true,
      accounts: [
        {
          accountId: 'acc-1',
          accountName: 'Biz 1',
          report: { year: 2025, quarter: 2, totalSales: 100, totalTax: 8, balanceDue: 8 },
        },
      ],
    });

    expect(getQuarterlyReportsByAccount).toHaveBeenCalledWith('user-1', 2025, 2);
  });

  it('returns { report } when quarter is provided (and not byAccount)', async () => {
    (getQuarterlyReport as any).mockResolvedValue({ year: 2025, quarter: 3, totalSales: 123 });

    const res = await GET(createNextRequest('http://localhost/api/sales-tax/quarterly?year=2025&quarter=3'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ report: { year: 2025, quarter: 3, totalSales: 123 } });
    expect(getQuarterlyReport).toHaveBeenCalledWith('user-1', 2025, 3, undefined);
  });

  it('returns yearly summary with taxBreakdown and per-quarter breakdown when settings exist', async () => {
    (getYearlyQuarterlyReports as any).mockResolvedValue([
      { year: 2025, quarter: 1, totalSales: 100, totalTax: 8, balanceDue: 8 },
      { year: 2025, quarter: 2, totalSales: 50, totalTax: 4, balanceDue: 4 },
    ]);

    const settings = {
      defaultRate: 8,
      jurisdiction: 'Test',
      fiscalYearStart: '01-01',
      filingFrequency: 'quarterly',
      enableTracking: true,
      stateRate: 5,
      countyRate: 2,
      cityRate: 1,
      specialDistrictRate: 0,
      stateName: 'State',
      countyName: 'County',
      cityName: 'City',
      specialDistrictName: null,
    };

    (getFullSalesTaxSettings as any).mockResolvedValue(settings);

    (calculateTaxBreakdown as any).mockImplementation((saleAmount: number) => ({
      state: { name: 'State', rate: 5, amount: saleAmount * 0.05 },
      county: { name: 'County', rate: 2, amount: saleAmount * 0.02 },
      city: { name: 'City', rate: 1, amount: saleAmount * 0.01 },
      specialDistrict: { name: 'Special District', rate: 0, amount: 0 },
      total: { rate: 8, amount: saleAmount * 0.08 },
    }));

    const res = await GET(createNextRequest('http://localhost/api/sales-tax/quarterly?year=2025'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.year).toBe(2025);
    expect(data.totalSales).toBe(150);
    expect(data.totalTax).toBe(12);
    expect(data.totalDue).toBe(12);

    expect(data.taxBreakdown).toEqual({
      state: { name: 'State', rate: 5, amount: 150 * 0.05 },
      county: { name: 'County', rate: 2, amount: 150 * 0.02 },
      city: { name: 'City', rate: 1, amount: 150 * 0.01 },
      specialDistrict: { name: 'Special District', rate: 0, amount: 0 },
      total: { rate: 8, amount: 150 * 0.08 },
    });

    expect(Array.isArray(data.quarters)).toBe(true);
    expect(data.quarters[0].taxBreakdown.total.amount).toBeCloseTo(100 * 0.08, 10);
    expect(data.quarters[1].taxBreakdown.total.amount).toBeCloseTo(50 * 0.08, 10);

    expect(getYearlyQuarterlyReports).toHaveBeenCalledWith('user-1', 2025, undefined);
    expect(getFullSalesTaxSettings).toHaveBeenCalledWith('user-1');
    expect(calculateTaxBreakdown).toHaveBeenCalled();
  });

  it('passes accountId through to getQuarterlyReport/getYearlyQuarterlyReports', async () => {
    await GET(createNextRequest('http://localhost/api/sales-tax/quarterly?year=2025&quarter=1&accountId=acc-9'));
    expect(getQuarterlyReport).toHaveBeenCalledWith('user-1', 2025, 1, 'acc-9');

    await GET(createNextRequest('http://localhost/api/sales-tax/quarterly?year=2025&accountId=acc-9'));
    expect(getYearlyQuarterlyReports).toHaveBeenCalledWith('user-1', 2025, 'acc-9');
  });
});
