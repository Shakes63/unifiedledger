import Decimal from 'decimal.js';

export type MoneyLike = number | string | Decimal | null | undefined;

export function toMoneyCents(amount: MoneyLike): number | null {
  if (amount === null || amount === undefined) {
    return null;
  }

  return new Decimal(amount).times(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

export function fromMoneyCents(cents: number | string | bigint | null | undefined): number | null {
  if (cents === null || cents === undefined) {
    return null;
  }

  return new Decimal(cents.toString()).dividedBy(100).toNumber();
}

export function coalesceMoneyValue(
  amount: MoneyLike,
  amountCents: number | string | bigint | null | undefined
): number {
  const centsValue = fromMoneyCents(amountCents);
  if (centsValue !== null) {
    return centsValue;
  }
  if (amount === null || amount === undefined) {
    return 0;
  }
  return new Decimal(amount).toNumber();
}
