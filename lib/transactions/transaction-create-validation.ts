import { and, eq } from 'drizzle-orm';

import { requireAccountEntityAccess } from '@/lib/household/entities';
import { db } from '@/lib/db';
import { accounts, budgetCategories } from '@/lib/db/schema';

type CreateType = 'income' | 'expense' | 'transfer' | 'transfer_in' | 'transfer_out' | string;

export function mapCreateTransactionValidationError(error: unknown): Response | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const message = error.message;
  if (message === 'Account not found') {
    return Response.json({ error: message }, { status: 404 });
  }
  if (message === 'Destination account not found') {
    return Response.json({ error: message }, { status: 404 });
  }
  if (message === 'Category not found') {
    return Response.json({ error: message }, { status: 404 });
  }
  if (message === 'Account does not belong to the selected entity') {
    return Response.json({ error: message }, { status: 403 });
  }

  return null;
}

export async function loadCreateTransactionResources({
  userId,
  householdId,
  accountId,
  toAccountId,
  categoryId,
  type,
  selectedEntityId,
}: {
  userId: string;
  householdId: string;
  accountId: string;
  toAccountId?: string;
  categoryId?: string;
  type: CreateType;
  selectedEntityId: string;
}) {
  const [accountResult, toAccountResult, categoryResult] = await Promise.all([
    db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.id, accountId),
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId)
        )
      )
      .limit(1),
    type === 'transfer' && toAccountId
      ? db
          .select()
          .from(accounts)
          .where(
            and(
              eq(accounts.id, toAccountId),
              eq(accounts.userId, userId),
              eq(accounts.householdId, householdId)
            )
          )
          .limit(1)
      : Promise.resolve([]),
    categoryId
      ? db
          .select()
          .from(budgetCategories)
          .where(
            and(
              eq(budgetCategories.id, categoryId),
              eq(budgetCategories.userId, userId),
              eq(budgetCategories.householdId, householdId)
            )
          )
          .limit(1)
      : Promise.resolve([]),
  ]);

  if (accountResult.length === 0) {
    throw new Error('Account not found');
  }
  const account = accountResult[0];
  const sourceAccountEntity = await requireAccountEntityAccess(userId, householdId, account.entityId);

  let toAccount: typeof accounts.$inferSelect | null = null;
  if (type === 'transfer' && toAccountId) {
    if (toAccountResult.length === 0) {
      throw new Error('Destination account not found');
    }
    toAccount = toAccountResult[0];
    await requireAccountEntityAccess(userId, householdId, toAccount.entityId);
  }

  if (type !== 'transfer' && sourceAccountEntity.id !== selectedEntityId) {
    throw new Error('Account does not belong to the selected entity');
  }

  if (categoryId && categoryResult.length === 0) {
    throw new Error('Category not found');
  }

  return {
    account,
    toAccount,
    category: categoryResult[0] ?? null,
  };
}

