import { describe, it, expect } from 'vitest';
import {
  calculateUtilization,
  getUtilizationLevel,
  calculateCreditStats,
  calculatePaymentToTarget,
  type CreditCardData,
} from '@/lib/debts/credit-utilization-utils';

describe('lib/debts/credit-utilization-utils', () => {
  describe('calculateUtilization', () => {
    it('returns 0 for zero limit', () => {
      expect(calculateUtilization(500, 0)).toBe(0);
    });

    it('returns 0 for null/undefined limit', () => {
      expect(calculateUtilization(500, null as unknown as number)).toBe(0);
    });

    it('returns 0 for negative balance (credit on account)', () => {
      expect(calculateUtilization(-100, 5000)).toBe(0);
    });

    it('calculates 10% boundary correctly', () => {
      expect(calculateUtilization(500, 5000)).toBe(10);
    });

    it('calculates 30% boundary correctly', () => {
      expect(calculateUtilization(1500, 5000)).toBe(30);
    });

    it('calculates 50% boundary correctly', () => {
      expect(calculateUtilization(2500, 5000)).toBe(50);
    });

    it('calculates 75% boundary correctly', () => {
      expect(calculateUtilization(3750, 5000)).toBe(75);
    });

    it('handles over 100% utilization', () => {
      expect(calculateUtilization(6000, 5000)).toBe(120);
    });

    it('uses Decimal.js for precision (avoids float artifacts)', () => {
      // 1 / 3 * 100 = 33.333... should round to 33.3, not a float artifact
      const result = calculateUtilization(1, 3);
      expect(result).toBe(33.3);
    });

    it('handles very small balance on large limit', () => {
      const result = calculateUtilization(0.01, 100000);
      expect(result).toBe(0);
    });
  });

  describe('getUtilizationLevel', () => {
    it('returns excellent for 0%', () => {
      expect(getUtilizationLevel(0)).toBe('excellent');
    });

    it('returns excellent for negative', () => {
      expect(getUtilizationLevel(-5)).toBe('excellent');
    });

    it('returns excellent for 10%', () => {
      expect(getUtilizationLevel(10)).toBe('excellent');
    });

    it('returns good for 10.1%', () => {
      expect(getUtilizationLevel(10.1)).toBe('good');
    });

    it('returns good for 30%', () => {
      expect(getUtilizationLevel(30)).toBe('good');
    });

    it('returns fair for 30.1%', () => {
      expect(getUtilizationLevel(30.1)).toBe('fair');
    });

    it('returns fair for 50%', () => {
      expect(getUtilizationLevel(50)).toBe('fair');
    });

    it('returns poor for 50.1%', () => {
      expect(getUtilizationLevel(50.1)).toBe('poor');
    });

    it('returns poor for 75%', () => {
      expect(getUtilizationLevel(75)).toBe('poor');
    });

    it('returns critical for 75.1%', () => {
      expect(getUtilizationLevel(75.1)).toBe('critical');
    });
  });

  describe('calculateCreditStats', () => {
    it('handles empty cards array', () => {
      const stats = calculateCreditStats([]);
      expect(stats.totalLimit).toBe(0);
      expect(stats.totalUsed).toBe(0);
      expect(stats.overallUtilization).toBe(0);
    });

    it('filters out cards without credit limits', () => {
      const cards: CreditCardData[] = [
        { id: '1', name: 'Card A', balance: 100, limit: 0 },
        { id: '2', name: 'Card B', balance: 200, limit: 1000 },
      ];
      const stats = calculateCreditStats(cards);
      expect(stats.cards.length).toBe(1);
      expect(stats.cards[0].id).toBe('2');
    });

    it('calculates multi-card accumulation with Decimal.js precision', () => {
      const cards: CreditCardData[] = [
        { id: '1', name: 'Card A', balance: 333.33, limit: 1000 },
        { id: '2', name: 'Card B', balance: 333.33, limit: 1000 },
        { id: '3', name: 'Card C', balance: 333.34, limit: 1000 },
      ];
      const stats = calculateCreditStats(cards);
      // With Decimal.js: 333.33 + 333.33 + 333.34 = 1000.00 exactly
      expect(stats.totalUsed).toBe(1000);
      expect(stats.totalLimit).toBe(3000);
      expect(stats.totalAvailable).toBe(2000);
    });

    it('counts cards over threshold', () => {
      const cards: CreditCardData[] = [
        { id: '1', name: 'Card A', balance: 100, limit: 1000 },  // 10%
        { id: '2', name: 'Card B', balance: 400, limit: 1000 },  // 40% over 30%
        { id: '3', name: 'Card C', balance: 800, limit: 1000 },  // 80% over 30%
      ];
      const stats = calculateCreditStats(cards, 30);
      expect(stats.cardsOverThreshold).toBe(2);
    });

    it('sorts cards by utilization (highest first)', () => {
      const cards: CreditCardData[] = [
        { id: '1', name: 'Low', balance: 100, limit: 1000 },
        { id: '2', name: 'High', balance: 900, limit: 1000 },
        { id: '3', name: 'Mid', balance: 500, limit: 1000 },
      ];
      const stats = calculateCreditStats(cards);
      expect(stats.cards[0].name).toBe('High');
      expect(stats.cards[1].name).toBe('Mid');
      expect(stats.cards[2].name).toBe('Low');
    });

    it('calculates available correctly with Decimal.js', () => {
      const cards: CreditCardData[] = [
        { id: '1', name: 'Card', balance: 1999.99, limit: 5000 },
      ];
      const stats = calculateCreditStats(cards);
      expect(stats.totalAvailable).toBe(3000.01);
    });
  });

  describe('calculatePaymentToTarget', () => {
    it('returns 0 for zero limit', () => {
      expect(calculatePaymentToTarget(1000, 0)).toBe(0);
    });

    it('returns 0 when already below target', () => {
      expect(calculatePaymentToTarget(200, 1000, 30)).toBe(0); // 20% < 30%
    });

    it('calculates payment needed to reach 30% utilization', () => {
      // Balance: 500, Limit: 1000, Target: 30%
      // Target balance: 300, Need to pay: 200
      const payment = calculatePaymentToTarget(500, 1000, 30);
      expect(payment).toBe(200);
    });

    it('uses Decimal.js for precise target balance calculation', () => {
      // Balance: 333, Limit: 1000, Target: 30%
      // Target balance: 300, Need to pay: 33
      const payment = calculatePaymentToTarget(333, 1000, 30);
      expect(payment).toBe(33);
    });

    it('rounds up to nearest dollar', () => {
      // Balance: 501, Limit: 1000, Target: 30%
      // Target balance: 300, Need to pay: 201
      const payment = calculatePaymentToTarget(501, 1000, 30);
      expect(payment).toBe(201);
    });

    it('handles fractional target balance with ceiling', () => {
      // Balance: 400, Limit: 999, Target: 30%
      // Target balance: 299.7, Need to pay: 100.3 -> ceil to 101
      const payment = calculatePaymentToTarget(400, 999, 30);
      expect(payment).toBe(101);
    });
  });
});
