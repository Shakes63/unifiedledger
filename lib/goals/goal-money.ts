import { fromMoneyCents, toMoneyCents } from '@/lib/utils/money-cents';

/**
 * Integer-cents accessors for savings goals (RC-4). `currentAmountCents` is the
 * source of truth; the legacy float `currentAmount` is a derived display value
 * kept in sync in code. Reads fall back to the float for rows written before the
 * cents backfill.
 */
export function getGoalCurrentCents(goal: {
  currentAmountCents?: number | string | bigint | null;
  currentAmount?: number | null;
}): number {
  if (goal.currentAmountCents !== null && goal.currentAmountCents !== undefined) {
    return Number(goal.currentAmountCents);
  }
  return toMoneyCents(goal.currentAmount ?? 0) ?? 0;
}

/** Paired cents + derived float for a goal's current amount. */
export function buildGoalCurrentFields(currentAmountCents: number): {
  currentAmountCents: number;
  currentAmount: number;
} {
  return {
    currentAmountCents,
    currentAmount: fromMoneyCents(currentAmountCents) ?? 0,
  };
}
