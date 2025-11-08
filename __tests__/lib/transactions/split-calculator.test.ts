import { describe, it, expect } from "vitest";
import {
  validateSplits,
  calculateSplitAmounts,
  getRemainingForNewSplit,
  calculateSplitMetrics,
  SplitEntry,
} from "@/lib/transactions/split-calculator";

describe("Split Calculator - Financial Precision Tests", () => {
  describe("validateSplits", () => {
    it("should reject empty splits array", () => {
      const result = validateSplits([], 100);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("At least one split is required");
    });

    describe("Amount-based splits", () => {
      it("should validate correct amount splits", () => {
        const splits: SplitEntry[] = [
          { amount: 50, isPercentage: false },
          { amount: 50, isPercentage: false },
        ];
        const result = validateSplits(splits, 100);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.totalAmount).toBe(100);
      });

      it("should validate with Decimal precision (no floating point errors)", () => {
        // This is critical for financial calculations
        const splits: SplitEntry[] = [
          { amount: 33.33, isPercentage: false },
          { amount: 33.33, isPercentage: false },
          { amount: 33.34, isPercentage: false },
        ];
        const result = validateSplits(splits, 100);
        expect(result.valid).toBe(true);
        expect(result.totalAmount).toBe(100);
      });

      it("should reject amount splits that don't sum to transaction amount", () => {
        const splits: SplitEntry[] = [
          { amount: 50, isPercentage: false },
          { amount: 40, isPercentage: false },
        ];
        const result = validateSplits(splits, 100);
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain("must sum to $100.00");
      });

      it("should allow 0.01 tolerance for floating point errors", () => {
        const splits: SplitEntry[] = [
          { amount: 50.005, isPercentage: false },
          { amount: 50.004, isPercentage: false },
        ];
        const result = validateSplits(splits, 100.009);
        // Should be valid within tolerance
        expect(result.valid).toBe(true);
      });

      it("should reject amounts exceeding tolerance", () => {
        const splits: SplitEntry[] = [
          { amount: 50, isPercentage: false },
          { amount: 50.02, isPercentage: false },
        ];
        const result = validateSplits(splits, 100);
        expect(result.valid).toBe(false);
      });

      it("should handle zero amount", () => {
        const splits: SplitEntry[] = [
          { amount: 0, isPercentage: false },
          { amount: 100, isPercentage: false },
        ];
        const result = validateSplits(splits, 100);
        expect(result.valid).toBe(true);
      });

      it("should handle large amounts", () => {
        const splits: SplitEntry[] = [
          { amount: 500000.50, isPercentage: false },
          { amount: 500000.50, isPercentage: false },
        ];
        const result = validateSplits(splits, 1000001);
        expect(result.valid).toBe(true);
      });
    });

    describe("Percentage-based splits", () => {
      it("should validate correct percentage splits", () => {
        const splits: SplitEntry[] = [
          { percentage: 50, isPercentage: true },
          { percentage: 50, isPercentage: true },
        ];
        const result = validateSplits(splits, 100);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.totalPercentage).toBe(100);
      });

      it("should validate percentage splits that sum to 100%", () => {
        const splits: SplitEntry[] = [
          { percentage: 33.33, isPercentage: true },
          { percentage: 33.33, isPercentage: true },
          { percentage: 33.34, isPercentage: true },
        ];
        const result = validateSplits(splits, 100);
        expect(result.valid).toBe(true);
      });

      it("should reject percentage splits that don't sum to 100%", () => {
        const splits: SplitEntry[] = [
          { percentage: 50, isPercentage: true },
          { percentage: 40, isPercentage: true },
        ];
        const result = validateSplits(splits, 100);
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain("100%");
      });

      it("should allow 0.01% tolerance for floating point", () => {
        const splits: SplitEntry[] = [
          { percentage: 50.005, isPercentage: true },
          { percentage: 50.004, isPercentage: true },
        ];
        const result = validateSplits(splits, 100);
        expect(result.valid).toBe(true);
      });

      it("should reject percentages exceeding tolerance", () => {
        const splits: SplitEntry[] = [
          { percentage: 50, isPercentage: true },
          { percentage: 50.02, isPercentage: true },
        ];
        const result = validateSplits(splits, 100);
        expect(result.valid).toBe(false);
      });

      it("should handle edge case: 0% and 100%", () => {
        const splits: SplitEntry[] = [
          { percentage: 0, isPercentage: true },
          { percentage: 100, isPercentage: true },
        ];
        const result = validateSplits(splits, 100);
        expect(result.valid).toBe(true);
      });
    });

    describe("Mixed splits (error case)", () => {
      it("should reject mixed percentage and amount splits", () => {
        const splits: SplitEntry[] = [
          { percentage: 50, isPercentage: true },
          { amount: 50, isPercentage: false },
        ];
        const result = validateSplits(splits, 100);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          "Cannot mix percentage and amount splits"
        );
      });
    });
  });

  describe("calculateSplitAmounts", () => {
    it("should return amount splits unchanged", () => {
      const splits: SplitEntry[] = [
        { amount: 30, isPercentage: false },
        { amount: 70, isPercentage: false },
      ];
      const result = calculateSplitAmounts(splits, 100);
      expect(result).toEqual([
        { id: 0, amount: 30 },
        { id: 1, amount: 70 },
      ]);
    });

    it("should calculate percentage splits with Decimal precision", () => {
      const splits: SplitEntry[] = [
        { percentage: 33.33, isPercentage: true },
        { percentage: 33.33, isPercentage: true },
        { percentage: 33.34, isPercentage: true },
      ];
      const result = calculateSplitAmounts(splits, 100);

      // Total should be 100.00
      const total = result.reduce((sum, s) => sum + s.amount, 0);
      expect(Math.abs(total - 100) < 0.01).toBe(true);

      // Each amount should be reasonable
      expect(result[0].amount).toBeCloseTo(33.33, 2);
      expect(result[1].amount).toBeCloseTo(33.33, 2);
      expect(result[2].amount).toBeCloseTo(33.34, 2);
    });

    it("should handle single split at 100%", () => {
      const splits: SplitEntry[] = [
        { percentage: 100, isPercentage: true },
      ];
      const result = calculateSplitAmounts(splits, 100);
      expect(result[0].amount).toBe(100);
    });

    it("should handle large transaction amounts", () => {
      const splits: SplitEntry[] = [
        { percentage: 50, isPercentage: true },
        { percentage: 50, isPercentage: true },
      ];
      const result = calculateSplitAmounts(splits, 1000000);
      expect(result[0].amount).toBe(500000);
      expect(result[1].amount).toBe(500000);
    });

    it("should handle decimal percentages", () => {
      const splits: SplitEntry[] = [
        { percentage: 33.3333, isPercentage: true },
        { percentage: 66.6667, isPercentage: true },
      ];
      const result = calculateSplitAmounts(splits, 100);
      const total = result.reduce((sum, s) => sum + s.amount, 0);
      expect(Math.abs(total - 100) < 0.01).toBe(true);
    });

    it("should handle zero percentage (edge case)", () => {
      const splits: SplitEntry[] = [
        { percentage: 0, isPercentage: true },
        { percentage: 100, isPercentage: true },
      ];
      const result = calculateSplitAmounts(splits, 100);
      expect(result[0].amount).toBe(0);
      expect(result[1].amount).toBe(100);
    });

    it("should handle missing amount/percentage values", () => {
      const splits: SplitEntry[] = [
        { isPercentage: false }, // amount is undefined
        { amount: 100, isPercentage: false },
      ];
      const result = calculateSplitAmounts(splits, 100);
      expect(result[0].amount).toBe(0);
      expect(result[1].amount).toBe(100);
    });
  });

  describe("getRemainingForNewSplit", () => {
    describe("Amount-based remaining", () => {
      it("should calculate remaining amount correctly", () => {
        const splits: SplitEntry[] = [
          { amount: 30, isPercentage: false },
        ];
        const remaining = getRemainingForNewSplit(splits, 100, false);
        expect(remaining).toBe(70);
      });

      it("should return 0 when fully allocated", () => {
        const splits: SplitEntry[] = [
          { amount: 100, isPercentage: false },
        ];
        const remaining = getRemainingForNewSplit(splits, 100, false);
        expect(remaining).toBe(0);
      });

      it("should handle multiple existing splits", () => {
        const splits: SplitEntry[] = [
          { amount: 25, isPercentage: false },
          { amount: 25, isPercentage: false },
          { amount: 25, isPercentage: false },
        ];
        const remaining = getRemainingForNewSplit(splits, 100, false);
        expect(remaining).toBe(25);
      });

      it("should not go negative (return 0 for over-allocated)", () => {
        const splits: SplitEntry[] = [
          { amount: 120, isPercentage: false },
        ];
        const remaining = getRemainingForNewSplit(splits, 100, false);
        expect(remaining).toBe(0);
      });

      it("should handle Decimal precision", () => {
        const splits: SplitEntry[] = [
          { amount: 33.33, isPercentage: false },
          { amount: 33.33, isPercentage: false },
        ];
        const remaining = getRemainingForNewSplit(splits, 100, false);
        expect(remaining).toBeCloseTo(33.34, 2);
      });
    });

    describe("Percentage-based remaining", () => {
      it("should calculate remaining percentage correctly", () => {
        const splits: SplitEntry[] = [
          { percentage: 30, isPercentage: true },
        ];
        const remaining = getRemainingForNewSplit(splits, 100, true);
        expect(remaining).toBe(70);
      });

      it("should return 0 when fully allocated (100%)", () => {
        const splits: SplitEntry[] = [
          { percentage: 100, isPercentage: true },
        ];
        const remaining = getRemainingForNewSplit(splits, 100, true);
        expect(remaining).toBe(0);
      });

      it("should not go negative for over-allocation", () => {
        const splits: SplitEntry[] = [
          { percentage: 120, isPercentage: true },
        ];
        const remaining = getRemainingForNewSplit(splits, 100, true);
        expect(remaining).toBe(0);
      });

      it("should handle decimal percentages", () => {
        const splits: SplitEntry[] = [
          { percentage: 33.3333, isPercentage: true },
        ];
        const remaining = getRemainingForNewSplit(splits, 100, true);
        expect(remaining).toBeCloseTo(66.6667, 4);
      });
    });
  });

  describe("calculateSplitMetrics", () => {
    describe("Percentage input", () => {
      it("should convert percentage to amount", () => {
        const split: SplitEntry = { percentage: 50, isPercentage: true };
        const metrics = calculateSplitMetrics(split, 100);
        expect(metrics.percentage).toBe(50);
        expect(metrics.amount).toBe(50);
      });

      it("should handle decimal percentages with precision", () => {
        const split: SplitEntry = {
          percentage: 33.333333,
          isPercentage: true,
        };
        const metrics = calculateSplitMetrics(split, 100);
        expect(metrics.percentage).toBe(33.333333);
        expect(metrics.amount).toBeCloseTo(33.333333, 5);
      });

      it("should handle large amounts", () => {
        const split: SplitEntry = { percentage: 25, isPercentage: true };
        const metrics = calculateSplitMetrics(split, 1000000);
        expect(metrics.percentage).toBe(25);
        expect(metrics.amount).toBe(250000);
      });

      it("should handle zero percentage", () => {
        const split: SplitEntry = { percentage: 0, isPercentage: true };
        const metrics = calculateSplitMetrics(split, 100);
        expect(metrics.percentage).toBe(0);
        expect(metrics.amount).toBe(0);
      });

      it("should handle 100% split", () => {
        const split: SplitEntry = { percentage: 100, isPercentage: true };
        const metrics = calculateSplitMetrics(split, 100);
        expect(metrics.percentage).toBe(100);
        expect(metrics.amount).toBe(100);
      });
    });

    describe("Amount input", () => {
      it("should convert amount to percentage", () => {
        const split: SplitEntry = { amount: 50, isPercentage: false };
        const metrics = calculateSplitMetrics(split, 100);
        expect(metrics.amount).toBe(50);
        expect(metrics.percentage).toBe(50);
      });

      it("should handle decimal amounts with precision", () => {
        const split: SplitEntry = {
          amount: 33.333333,
          isPercentage: false,
        };
        const metrics = calculateSplitMetrics(split, 100);
        expect(metrics.amount).toBe(33.333333);
        expect(metrics.percentage).toBeCloseTo(33.333333, 5);
      });

      it("should handle large amounts", () => {
        const split: SplitEntry = { amount: 250000, isPercentage: false };
        const metrics = calculateSplitMetrics(split, 1000000);
        expect(metrics.amount).toBe(250000);
        expect(metrics.percentage).toBe(25);
      });

      it("should handle zero amount", () => {
        const split: SplitEntry = { amount: 0, isPercentage: false };
        const metrics = calculateSplitMetrics(split, 100);
        expect(metrics.amount).toBe(0);
        expect(metrics.percentage).toBe(0);
      });

      it("should handle amount equal to transaction total", () => {
        const split: SplitEntry = { amount: 100, isPercentage: false };
        const metrics = calculateSplitMetrics(split, 100);
        expect(metrics.amount).toBe(100);
        expect(metrics.percentage).toBe(100);
      });
    });

    describe("Edge cases with missing values", () => {
      it("should handle undefined percentage", () => {
        const split: SplitEntry = { isPercentage: true };
        const metrics = calculateSplitMetrics(split, 100);
        expect(metrics.percentage).toBe(0);
        expect(metrics.amount).toBe(0);
      });

      it("should handle undefined amount", () => {
        const split: SplitEntry = { isPercentage: false };
        const metrics = calculateSplitMetrics(split, 100);
        expect(metrics.amount).toBe(0);
        expect(metrics.percentage).toBe(0);
      });
    });
  });

  describe("Integration: Complete split workflows", () => {
    it("should handle 3-way split with percentage validation and calculation", () => {
      const splits: SplitEntry[] = [
        { percentage: 33.33, isPercentage: true },
        { percentage: 33.33, isPercentage: true },
        { percentage: 33.34, isPercentage: true },
      ];
      const transactionAmount = 99.99;

      // Validate
      const validation = validateSplits(splits, transactionAmount);
      expect(validation.valid).toBe(true);

      // Calculate amounts
      const amounts = calculateSplitAmounts(splits, transactionAmount);
      const total = amounts.reduce((sum, a) => sum + a.amount, 0);
      expect(Math.abs(total - transactionAmount) < 0.01).toBe(true);

      // Check remaining
      const remaining = getRemainingForNewSplit(splits, transactionAmount, true);
      expect(remaining).toBeCloseTo(0, 1);
    });

    it("should handle amount-based split with remainder", () => {
      const splits: SplitEntry[] = [
        { amount: 33.33, isPercentage: false },
        { amount: 33.33, isPercentage: false },
      ];
      const transactionAmount = 100;

      const validation = validateSplits(splits, transactionAmount);
      expect(validation.valid).toBe(false);

      // Calculate remaining to properly allocate
      const remaining = getRemainingForNewSplit(splits, transactionAmount, false);
      expect(remaining).toBeCloseTo(33.34, 2);

      // Now add the remainder
      const updatedSplits: SplitEntry[] = [
        ...splits,
        { amount: remaining, isPercentage: false },
      ];
      const updatedValidation = validateSplits(updatedSplits, transactionAmount);
      expect(updatedValidation.valid).toBe(true);
    });

    it("should maintain precision across multiple operations", () => {
      const transactionAmount = 1000000;
      const splits: SplitEntry[] = [
        { percentage: 33.333333, isPercentage: true },
        { percentage: 33.333333, isPercentage: true },
        { percentage: 33.333334, isPercentage: true },
      ];

      // Validate
      const validation = validateSplits(splits, transactionAmount);
      expect(validation.valid).toBe(true);

      // Calculate amounts
      const amounts = calculateSplitAmounts(splits, transactionAmount);

      // Convert back to percentages
      const backToPercentages = amounts.map((a) => ({
        percentage: (a.amount / transactionAmount) * 100,
        isPercentage: true,
      }));

      // Should still be valid
      const revalidation = validateSplits(
        backToPercentages as SplitEntry[],
        transactionAmount
      );
      expect(revalidation.valid).toBe(true);
    });
  });
});
