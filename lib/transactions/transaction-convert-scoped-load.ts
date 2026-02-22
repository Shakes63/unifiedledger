import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { accounts, transactions } from '@/lib/db/schema';

export function validateConvertRequestInput({
  householdId,
  targetAccountId,
}: {
  householdId: string | null;
  targetAccountId?: string;
}): Response | null {
  if (!householdId) {
    return Response.json({ error: 'Household ID is required' }, { status: 400 });
  }

  if (!targetAccountId) {
    return Response.json({ error: 'Target account ID is required' }, { status: 400 });
  }

  return null;
}

export async function loadScopedTransaction({
  id,
  userId,
  householdId,
}: {
  id: string;
  userId: string;
  householdId: string;
}): Promise<typeof transactions.$inferSelect | null> {
  const rows = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.id, id),
        eq(transactions.userId, userId),
        eq(transactions.householdId, householdId)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function loadScopedAccount({
  accountId,
  userId,
  householdId,
}: {
  accountId: string;
  userId: string;
  householdId: string;
}): Promise<typeof accounts.$inferSelect | null> {
  const rows = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.id, accountId),
        eq(accounts.userId, userId),
        eq(accounts.householdId, householdId)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function loadConversionAccounts({
  sourceAccountId,
  targetAccountId,
  userId,
  householdId,
}: {
  sourceAccountId: string;
  targetAccountId: string;
  userId: string;
  householdId: string;
}): Promise<{
  sourceAccount: typeof accounts.$inferSelect | null;
  targetAccount: typeof accounts.$inferSelect | null;
}> {
  const [targetAccount, sourceAccount] = await Promise.all([
    loadScopedAccount({ accountId: targetAccountId, userId, householdId }),
    loadScopedAccount({ accountId: sourceAccountId, userId, householdId }),
  ]);

  return { sourceAccount, targetAccount };
}
