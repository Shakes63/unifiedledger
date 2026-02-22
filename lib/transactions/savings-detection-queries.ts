import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { accounts, savingsGoals } from '@/lib/db/schema';

export async function getDestinationAccount({
  destinationAccountId,
  householdId,
}: {
  destinationAccountId: string;
  householdId: string;
}): Promise<{
  id: string;
  name: string;
  type: string;
} | null> {
  const [destinationAccount] = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      type: accounts.type,
    })
    .from(accounts)
    .where(
      and(eq(accounts.id, destinationAccountId), eq(accounts.householdId, householdId))
    );

  return destinationAccount ?? null;
}

export async function getActiveGoalsForAccount({
  accountId,
  householdId,
}: {
  accountId: string;
  householdId: string;
}): Promise<
  Array<{
    id: string;
    name: string;
    targetAmount: number;
    currentAmount: number | null;
    color: string | null;
    accountId: string | null;
  }>
> {
  return db
    .select({
      id: savingsGoals.id,
      name: savingsGoals.name,
      targetAmount: savingsGoals.targetAmount,
      currentAmount: savingsGoals.currentAmount,
      color: savingsGoals.color,
      accountId: savingsGoals.accountId,
    })
    .from(savingsGoals)
    .where(
      and(
        eq(savingsGoals.accountId, accountId),
        eq(savingsGoals.householdId, householdId),
        eq(savingsGoals.status, 'active')
      )
    );
}

export async function hasAnyActiveGoalsForAccount({
  accountId,
  householdId,
}: {
  accountId: string;
  householdId: string;
}): Promise<boolean> {
  const goals = await db
    .select({ id: savingsGoals.id })
    .from(savingsGoals)
    .where(
      and(
        eq(savingsGoals.accountId, accountId),
        eq(savingsGoals.householdId, householdId),
        eq(savingsGoals.status, 'active')
      )
    )
    .limit(1);

  return goals.length > 0;
}
