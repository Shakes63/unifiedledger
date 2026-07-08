import Decimal from 'decimal.js';

export function centsToAmount(cents: number): number {
  return new Decimal(cents).dividedBy(100).toNumber();
}

export type MovementTransactionType =
  | 'income'
  | 'expense'
  | 'transfer_in'
  | 'transfer_out';

const LIABILITY_ACCOUNT_TYPES = new Set(['credit', 'line_of_credit']);

/**
 * True for accounts whose stored balance represents money OWED (a liability),
 * not an asset. For these, a positive balance means debt. Credit cards and lines
 * of credit are liabilities; everything else is an asset.
 */
export function isLiabilityAccountType(accountType: string | null | undefined): boolean {
  return LIABILITY_ACCOUNT_TYPES.has(String(accountType));
}

/**
 * The signed delta (in cents) to apply to an account's STORED balance for a
 * transaction of the given type and amount, accounting for whether the account
 * is an asset or a liability (audit finding C-MATH-1).
 *
 * Asset accounts (checking/savings/cash/...): a positive balance is money you
 * have. expense / transfer_out decrease it; income / transfer_in increase it.
 *
 * Liability accounts (credit / line_of_credit): a positive balance is money you
 * OWE. A charge (expense / transfer_out) INCREASES what you owe; a payment or
 * refund (income / transfer_in) DECREASES it — the mirror of an asset. The
 * previous engine used the asset rule for every account, so a credit-card charge
 * drove the balance negative and the UI mislabelled the debt as an overpayment.
 */
export function computeBalanceDeltaCents({
  accountType,
  transactionType,
  amountCents,
}: {
  accountType: string | null | undefined;
  transactionType: MovementTransactionType;
  amountCents: number;
}): number {
  const isDebit = transactionType === 'expense' || transactionType === 'transfer_out';
  const assetDelta = isDebit ? -amountCents : amountCents;
  return isLiabilityAccountType(accountType) ? -assetDelta : assetDelta;
}

export function buildAccountBalanceFields(balanceCents: number) {
  return {
    currentBalance: centsToAmount(balanceCents),
    currentBalanceCents: balanceCents,
  };
}

export function buildTransactionAmountFields(amountCents: number) {
  return {
    amount: centsToAmount(amountCents),
    amountCents,
  };
}

export function buildTransferMoneyFields(amountCents: number, feesCents: number) {
  return {
    amount: centsToAmount(amountCents),
    amountCents,
    fees: centsToAmount(feesCents),
    feesCents,
  };
}
