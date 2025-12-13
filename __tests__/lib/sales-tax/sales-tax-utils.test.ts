/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

import {
  calculateTaxAmount,
  calculateTaxBreakdown,
  getQuarterDates,
  getQuarterlyReport,
  type FullSalesTaxSettings,
} from '@/lib/sales-tax/sales-tax-utils';
import { db } from '@/lib/db';

function mockSelectLimit(rows: any[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

function mockSelectWhere(rows: any[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  };
}

describe('lib/sales-tax/sales-tax-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculateTaxAmount applies percent rate correctly', () => {
    expect(calculateTaxAmount(100, 8.25)).toBeCloseTo(8.25, 10);
    expect(calculateTaxAmount(19.99, 10)).toBeCloseTo(1.999, 10);
  });

  it('getQuarterDates returns correct date ranges and due dates', () => {
    const quarters = getQuarterDates(2025);
    expect(quarters).toHaveLength(4);
    expect(quarters[0]).toEqual({
      quarter: 1,
      startDate: '2025-01-01',
      endDate: '2025-03-31',
      dueDate: '2025-04-20',
    });
    expect(quarters[3].dueDate).toBe('2026-01-20');
  });

  it('calculateTaxBreakdown computes multi-jurisdiction totals', () => {
    const settings: FullSalesTaxSettings = {
      defaultRate: 0,
      jurisdiction: 'Test',
      fiscalYearStart: '01-01',
      filingFrequency: 'quarterly',
      enableTracking: true,
      stateRate: 4,
      countyRate: 1,
      cityRate: 0.5,
      specialDistrictRate: 0.25,
      stateName: 'StateName',
      countyName: 'CountyName',
      cityName: 'CityName',
      specialDistrictName: 'SpecialName',
    };

    const breakdown = calculateTaxBreakdown(100, settings);

    expect(breakdown.total.rate).toBeCloseTo(5.75, 10);
    expect(breakdown.state.amount).toBeCloseTo(4, 10);
    expect(breakdown.county.amount).toBeCloseTo(1, 10);
    expect(breakdown.city.amount).toBeCloseTo(0.5, 10);
    expect(breakdown.specialDistrict.amount).toBeCloseTo(0.25, 10);
    expect(breakdown.total.amount).toBeCloseTo(5.75, 10);

    expect(breakdown.state.name).toBe('StateName');
    expect(breakdown.county.name).toBe('CountyName');
    expect(breakdown.city.name).toBe('CityName');
    expect(breakdown.specialDistrict.name).toBe('SpecialName');
  });

  it('getQuarterlyReport aggregates taxable income transactions and returns taxRate as decimal', async () => {
    (db.select as any)
      // getUserSalesTaxRate -> salesTaxSettings
      .mockReturnValueOnce(mockSelectLimit([{ defaultRate: 8.25 }]))
      // taxableTransactions query
      .mockReturnValueOnce(
        mockSelectWhere([
          { id: 't1', amount: 10 },
          { id: 't2', amount: 20 },
        ])
      )
      // filingRecord
      .mockReturnValueOnce(mockSelectLimit([]));

    const report = await getQuarterlyReport('user-1', 2025, 1);

    expect(report.totalSales).toBe(30);
    expect(report.taxRate).toBeCloseTo(0.0825, 10);
    expect(report.totalTax).toBeCloseTo(30 * 0.0825, 10);
    expect(report.quarter).toBe(1);
    expect(report.year).toBe(2025);
  });

  it('getQuarterlyReport uses filing record status/balanceDue when present', async () => {
    (db.select as any)
      .mockReturnValueOnce(mockSelectLimit([{ defaultRate: 10 }]))
      .mockReturnValueOnce(mockSelectWhere([{ id: 't1', amount: 100 }]))
      .mockReturnValueOnce(
        mockSelectLimit([
          {
            submittedDate: '2025-02-01',
            status: 'accepted',
            balanceDue: 12.34,
          },
        ])
      );

    const report = await getQuarterlyReport('user-1', 2025, 1);

    expect(report.status).toBe('accepted');
    expect(report.submittedDate).toBe('2025-02-01');
    expect(report.balanceDue).toBe(12.34);
  });
});
