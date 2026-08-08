import type { savingsGoals } from '@/lib/db/schema';

/**
 * Runtime guards for the savings-goal enum columns.
 *
 * Drizzle's `text({ enum: [...] })` is a TYPESCRIPT-only refinement — it emits no
 * CHECK constraint, so an unvalidated body value reaches the column verbatim
 * (bug-hunt finding SEC3). An out-of-enum `status` is worse than cosmetic: both
 * the contribution detector and the milestone sweep filter on `status = 'active'`,
 * so the goal silently vanishes from them while every TypeScript read site still
 * believes the field is one of the four literals.
 *
 * These live here rather than in a route so POST and PUT can't drift apart.
 */
export type SavingsGoalStatus = NonNullable<typeof savingsGoals.$inferSelect['status']>;
export type SavingsGoalCategory = NonNullable<typeof savingsGoals.$inferSelect['category']>;

export const SAVINGS_GOAL_STATUSES: readonly SavingsGoalStatus[] = [
  'active',
  'completed',
  'paused',
  'cancelled',
] as const;

export const SAVINGS_GOAL_CATEGORIES: readonly SavingsGoalCategory[] = [
  'emergency_fund',
  'vacation',
  'purchase',
  'education',
  'home',
  'vehicle',
  'retirement',
  'debt_payoff',
  'other',
] as const;

export function isSavingsGoalStatus(value: string): value is SavingsGoalStatus {
  return (SAVINGS_GOAL_STATUSES as readonly string[]).includes(value);
}

export function isSavingsGoalCategory(value: string): value is SavingsGoalCategory {
  return (SAVINGS_GOAL_CATEGORIES as readonly string[]).includes(value);
}
