import Decimal from 'decimal.js';

export type MoneyLike = number | string | Decimal | null | undefined;

/**
 * Thrown when a value that is supposed to represent money cannot be safely
 * converted to an integer number of cents (NaN, Infinity, or non-numeric input).
 *
 * Callers at API boundaries should catch this and return a 400 rather than
 * letting a corrupt amount reach the ledger. See audit finding H-VAL-1:
 * previously `toMoneyCents` returned NaN for garbage input and `"1e999"`
 * reached balances as Infinity, silently corrupting the shared ledger.
 */
export class InvalidMoneyError extends Error {
  constructor(value: unknown) {
    super(`Invalid monetary amount: ${String(value)}`);
    this.name = 'InvalidMoneyError';
  }
}

function toFiniteDecimal(amount: Exclude<MoneyLike, null | undefined>): Decimal {
  let dec: Decimal;
  try {
    dec = new Decimal(amount);
  } catch {
    // Decimal throws on non-numeric strings.
    throw new InvalidMoneyError(amount);
  }
  if (!dec.isFinite()) {
    // Catches NaN and ±Infinity (including string forms like "1e999").
    throw new InvalidMoneyError(amount);
  }
  return dec;
}

/**
 * Convert a money-like value to integer cents.
 *
 * Returns null only for null/undefined input. Throws {@link InvalidMoneyError}
 * for any non-finite or non-numeric value — it must never return NaN.
 */
export function toMoneyCents(amount: MoneyLike): number | null {
  if (amount === null || amount === undefined) {
    return null;
  }

  const cents = toFiniteDecimal(amount)
    .times(100)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();

  // decimal.js is arbitrary-precision, so a value like "1e999" is a finite
  // Decimal but overflows to Infinity (or a precision-lost value) once coerced
  // to a JS number. Reject anything that isn't a safe integer number of cents —
  // no legitimate personal-finance amount approaches ±$90 trillion.
  if (!Number.isSafeInteger(cents)) {
    throw new InvalidMoneyError(amount);
  }

  return cents;
}

/**
 * Convert a money-like value to integer cents, requiring a value.
 *
 * Never returns null and never returns NaN — throws {@link InvalidMoneyError}
 * on null/undefined/non-finite/non-numeric input. Use this at write paths that
 * move money so a bad amount fails loudly instead of corrupting a balance.
 */
export function assertMoneyCents(amount: MoneyLike): number {
  if (amount === null || amount === undefined) {
    throw new InvalidMoneyError(amount);
  }
  const cents = toMoneyCents(amount);
  // toMoneyCents only returns null for null/undefined, already handled above.
  if (cents === null || !Number.isFinite(cents)) {
    throw new InvalidMoneyError(amount);
  }
  return cents;
}

/**
 * Validate a value that is ALREADY in integer cents (e.g. an `amountCents` field
 * arriving from a request body) and return it as a safe integer number.
 *
 * Throws {@link InvalidMoneyError} for null/undefined, non-numeric, fractional,
 * or out-of-safe-range input. Unlike {@link assertMoneyCents}, this does NOT
 * multiply by 100 — use it where the caller already speaks cents.
 */
export function assertIntegerCents(cents: number | string | bigint | null | undefined): number {
  if (cents === null || cents === undefined) {
    throw new InvalidMoneyError(cents);
  }
  const value = typeof cents === 'number' ? cents : Number(cents);
  if (!Number.isSafeInteger(value)) {
    throw new InvalidMoneyError(cents);
  }
  return value;
}

export function fromMoneyCents(cents: number | string | bigint | null | undefined): number | null {
  if (cents === null || cents === undefined) {
    return null;
  }

  const dec = toFiniteDecimal(cents.toString());
  return dec.dividedBy(100).toNumber();
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
  return toFiniteDecimal(amount).toNumber();
}
