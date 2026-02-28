export interface BusinessFeatureAccount {
  enableSalesTax: boolean | null;
  enableTaxDeductions: boolean | null;
}

export function computeBusinessFeatureFlags(accounts: BusinessFeatureAccount[]) {
  const hasSalesTaxAccounts = accounts.some((acc) => acc.enableSalesTax === true);
  const hasTaxDeductionAccounts = accounts.some((acc) => acc.enableTaxDeductions === true);
  return {
    hasBusinessAccounts: hasSalesTaxAccounts || hasTaxDeductionAccounts,
    hasSalesTaxAccounts,
    hasTaxDeductionAccounts,
  };
}
