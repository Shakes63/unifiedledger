import { fromMoneyCents, toMoneyCents } from '@/lib/utils/money-cents';

/**
 * Integer-cents accessors for debt balances (RC-4 / H-DBG-10). `remainingBalanceCents`
 * is the source of truth; the legacy float `remainingBalance` is a derived display
 * value kept in sync in code. Reads fall back to the float for any row written
 * before the cents backfill.
 */
export function getDebtRemainingCents(debt: {
  remainingBalanceCents?: number | string | bigint | null;
  remainingBalance?: number | null;
}): number {
  if (debt.remainingBalanceCents !== null && debt.remainingBalanceCents !== undefined) {
    return Number(debt.remainingBalanceCents);
  }
  return toMoneyCents(debt.remainingBalance ?? 0) ?? 0;
}

/**
 * The paired columns to write for a debt balance: cents (authoritative) plus the
 * derived float (= cents / 100, exact to the cent so it never drifts).
 */
export function buildDebtBalanceFields(remainingBalanceCents: number): {
  remainingBalanceCents: number;
  remainingBalance: number;
} {
  return {
    remainingBalanceCents,
    remainingBalance: fromMoneyCents(remainingBalanceCents) ?? 0,
  };
}

/** The paired cents + float columns for a debt payment row. */
export function buildDebtPaymentAmountFields({
  amountCents,
  principalCents,
  interestCents,
}: {
  amountCents: number;
  principalCents: number;
  interestCents: number;
}): {
  amount: number;
  amountCents: number;
  principalAmount: number;
  principalCents: number;
  interestAmount: number;
  interestCents: number;
} {
  return {
    amount: fromMoneyCents(amountCents) ?? 0,
    amountCents,
    principalAmount: fromMoneyCents(principalCents) ?? 0,
    principalCents,
    interestAmount: fromMoneyCents(interestCents) ?? 0,
    interestCents,
  };
}
