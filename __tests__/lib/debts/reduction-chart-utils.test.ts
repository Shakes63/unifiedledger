import { describe, it, expect } from 'vitest';
import {
  calculateBalanceAtDate,
  aggregateHistoricalBalances,
  calculateSummary,
  mergeHistoricalAndProjection,
  type DebtWithPayments,
  type ChartDataPoint,
} from '@/lib/debts/reduction-chart-utils';

function baseDebt(overrides: Partial<DebtWithPayments> = {}): DebtWithPayments {
  return {
    id: 'debt-1',
    name: 'Credit Card',
    originalAmount: 5000,
    remainingBalance: 3000,
    startDate: '2024-06-01',
    status: 'active',
    payments: [],
    ...overrides,
  };
}

describe('lib/debts/reduction-chart-utils', () => {
  describe('calculateBalanceAtDate', () => {
    it('returns original amount with no payments', () => {
      const debt = baseDebt({ originalAmount: 5000, payments: [] });
      const balance = calculateBalanceAtDate(debt, new Date('2025-01-31'));
      expect(balance).toBe(5000);
    });

    it('reduces balance by payment principal', () => {
      const debt = baseDebt({
        originalAmount: 5000,
        payments: [
          { paymentDate: '2025-01-15', principalAmount: 1000 },
        ],
      });
      const balance = calculateBalanceAtDate(debt, new Date('2025-01-31'));
      expect(balance).toBe(4000);
    });

    it('only counts payments before target date', () => {
      const debt = baseDebt({
        originalAmount: 5000,
        payments: [
          { paymentDate: '2025-01-15', principalAmount: 1000 },
          { paymentDate: '2025-02-15', principalAmount: 1000 },
        ],
      });
      const balance = calculateBalanceAtDate(debt, new Date('2025-01-31'));
      expect(balance).toBe(4000); // Only the Jan payment counts
    });

    it('never returns negative balance', () => {
      const debt = baseDebt({
        originalAmount: 100,
        payments: [
          { paymentDate: '2025-01-01', principalAmount: 200 }, // Overpaid
        ],
      });
      const balance = calculateBalanceAtDate(debt, new Date('2025-01-31'));
      expect(balance).toBe(0);
    });
  });

  describe('aggregateHistoricalBalances - Decimal.js accumulation', () => {
    it('accumulates balances across debts precisely', () => {
      const debts: DebtWithPayments[] = [
        baseDebt({ id: 'd1', originalAmount: 333.33, payments: [] }),
        baseDebt({ id: 'd2', originalAmount: 333.33, payments: [] }),
        baseDebt({ id: 'd3', originalAmount: 333.34, payments: [] }),
      ];
      const from = new Date('2025-01-01');
      const to = new Date('2025-01-31');
      const result = aggregateHistoricalBalances(debts, from, to);

      // With Decimal.js: 333.33 + 333.33 + 333.34 = 1000.00 exactly
      // Without Decimal.js: might get 999.9999999999999 or 1000.0000000000001
      expect(result[0].actualTotal).toBe(1000);
    });

    it('handles zero debts', () => {
      const result = aggregateHistoricalBalances([], new Date('2025-01-01'), new Date('2025-01-31'));
      expect(result[0].actualTotal).toBe(0);
    });
  });

  describe('calculateSummary - Decimal.js precision', () => {
    it('calculates summary with precise totals', () => {
      const debts: DebtWithPayments[] = [
        baseDebt({ id: 'd1', originalAmount: 1000.01, remainingBalance: 500.01 }),
        baseDebt({ id: 'd2', originalAmount: 2000.02, remainingBalance: 1000.02 }),
      ];
      const chartData: ChartDataPoint[] = [];
      const summary = calculateSummary(debts, chartData);

      expect(summary.totalOriginalDebt).toBe(3000.03);
      expect(summary.totalCurrentDebt).toBe(1500.03);
      expect(summary.totalPaid).toBe(1500);
    });

    it('calculates percentage complete with Decimal.js', () => {
      const debts: DebtWithPayments[] = [
        baseDebt({ originalAmount: 3000, remainingBalance: 1000 }),
      ];
      const summary = calculateSummary(debts, []);

      // 2000 / 3000 * 100 = 66.666... -> 66.67
      expect(summary.percentageComplete).toBe(66.67);
    });

    it('handles zero original debt', () => {
      const debts: DebtWithPayments[] = [
        baseDebt({ originalAmount: 0, remainingBalance: 0 }),
      ];
      const summary = calculateSummary(debts, []);

      expect(summary.totalOriginalDebt).toBe(0);
      expect(summary.percentageComplete).toBe(0);
    });

    it('finds debt-free date from chart data', () => {
      const chartData: ChartDataPoint[] = [
        { month: '2025-01', monthDate: new Date(2025, 0, 1), projectedTotal: 1000, actualTotal: 1000, byDebt: {} },
        { month: '2025-06', monthDate: new Date(2025, 5, 1), projectedTotal: 0, actualTotal: 0, byDebt: {} },
      ];
      const summary = calculateSummary([baseDebt()], chartData);

      expect(summary.debtFreeDate).toBe('2025-06-01');
    });

    it('returns null debt-free date when never reaching zero', () => {
      const chartData: ChartDataPoint[] = [
        { month: '2025-01', monthDate: new Date('2025-01-01'), projectedTotal: 5000, actualTotal: 5000, byDebt: {} },
      ];
      const summary = calculateSummary([baseDebt()], chartData);

      expect(summary.debtFreeDate).toBeNull();
    });

    it('handles multi-debt Decimal accumulation without float drift', () => {
      // Create debts that would cause float accumulation errors
      const debts: DebtWithPayments[] = Array.from({ length: 10 }, (_, i) => (
        baseDebt({ id: `d${i}`, originalAmount: 0.1, remainingBalance: 0.05 })
      ));
      const summary = calculateSummary(debts, []);

      // 10 * 0.1 = 1.0 exactly (float: 0.9999999999999999)
      expect(summary.totalOriginalDebt).toBe(1);
      // 10 * 0.05 = 0.5 exactly
      expect(summary.totalCurrentDebt).toBe(0.5);
      expect(summary.totalPaid).toBe(0.5);
    });
  });

  describe('mergeHistoricalAndProjection', () => {
    it('merges historical and projection correctly', () => {
      const historical: ChartDataPoint[] = [
        { month: '2025-01', monthDate: new Date('2025-01-01'), projectedTotal: 0, actualTotal: 5000, byDebt: {} },
      ];
      const projection = [
        { month: '2025-01', monthDate: new Date('2025-01-01'), totalDebt: 5000, byDebt: {} },
        { month: '2025-02', monthDate: new Date('2025-02-01'), totalDebt: 4500, byDebt: {} },
      ];
      const result = mergeHistoricalAndProjection(historical, projection);

      expect(result.length).toBe(2);
      expect(result[0].projectedTotal).toBe(5000);
      expect(result[1].projectedTotal).toBe(4500);
    });

    it('sorts result by date', () => {
      const historical: ChartDataPoint[] = [
        { month: '2025-02', monthDate: new Date('2025-02-01'), projectedTotal: 0, actualTotal: 4500, byDebt: {} },
        { month: '2025-01', monthDate: new Date('2025-01-01'), projectedTotal: 0, actualTotal: 5000, byDebt: {} },
      ];
      const result = mergeHistoricalAndProjection(historical, []);

      expect(result[0].month).toBe('2025-01');
      expect(result[1].month).toBe('2025-02');
    });
  });
});
