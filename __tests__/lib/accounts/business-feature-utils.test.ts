import { describe, expect, it } from 'vitest';
import { computeBusinessFeatureFlags } from '@/lib/accounts/business-feature-utils';

describe('computeBusinessFeatureFlags', () => {
  it('detects sales tax and tax deduction flags', () => {
    const result = computeBusinessFeatureFlags([
      { enableSalesTax: true, enableTaxDeductions: false },
      { enableSalesTax: false, enableTaxDeductions: true },
    ]);

    expect(result).toEqual({
      hasBusinessAccounts: true,
      hasSalesTaxAccounts: true,
      hasTaxDeductionAccounts: true,
    });
  });

  it('does not enable business features without explicit toggles', () => {
    const result = computeBusinessFeatureFlags([
      { enableSalesTax: null, enableTaxDeductions: null },
    ]);

    expect(result.hasBusinessAccounts).toBe(false);
    expect(result.hasSalesTaxAccounts).toBe(false);
    expect(result.hasTaxDeductionAccounts).toBe(false);
  });
});
