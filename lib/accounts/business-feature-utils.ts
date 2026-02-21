export interface BusinessFeatureAccount {
  isBusinessAccount: boolean | null;
  enableSalesTax: boolean | null;
  enableTaxDeductions: boolean | null;
}

export function computeBusinessFeatureFlags(accounts: BusinessFeatureAccount[]) {
  const hasSalesTaxAccounts = accounts.some(
    (acc) => acc.enableSalesTax === true || (acc.isBusinessAccount === true && acc.enableSalesTax !== false)
  );
  const hasTaxDeductionAccounts = accounts.some(
    (acc) => acc.enableTaxDeductions === true || (acc.isBusinessAccount === true && acc.enableTaxDeductions !== false)
  );
  return {
    hasBusinessAccounts: hasSalesTaxAccounts || hasTaxDeductionAccounts,
    hasSalesTaxAccounts,
    hasTaxDeductionAccounts,
  };
}
