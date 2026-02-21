import { describe, expect, it } from 'vitest';
import { computeBusinessFeatureFlags } from '@/lib/accounts/business-feature-utils';

describe('computeBusinessFeatureFlags', () => {
  it('detects sales tax and tax deduction flags', () => {
    const result = computeBusinessFeatureFlags([
      { isBusinessAccount: false, enableSalesTax: true, enableTaxDeductions: false },
      { isBusinessAccount: false, enableSalesTax: false, enableTaxDeductions: true },
    ]);

    expect(result).toEqual({
      hasBusinessAccounts: true,
      hasSalesTaxAccounts: true,
      hasTaxDeductionAccounts: true,
    });
  });

  it('supports backward compatibility from legacy business-account flag', () => {
    const result = computeBusinessFeatureFlags([
      { isBusinessAccount: true, enableSalesTax: null, enableTaxDeductions: null },
    ]);

    expect(result.hasBusinessAccounts).toBe(true);
    expect(result.hasSalesTaxAccounts).toBe(true);
    expect(result.hasTaxDeductionAccounts).toBe(true);
  });
});
