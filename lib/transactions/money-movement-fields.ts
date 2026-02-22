import Decimal from 'decimal.js';

export function centsToAmount(cents: number): number {
  return new Decimal(cents).dividedBy(100).toNumber();
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
