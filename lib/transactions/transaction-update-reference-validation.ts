import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { accounts, budgetCategories, merchants, transactions } from '@/lib/db/schema';
import { requireAccountEntityAccess } from '@/lib/household/entities';

export async function validateUpdatedAccountReference({
  userId,
  householdId,
  selectedEntityId,
  currentAccountId,
  newAccountId,
}: {
  userId: string;
  householdId: string;
  selectedEntityId: string;
  currentAccountId: string;
  newAccountId: string;
}): Promise<Response | null> {
  if (newAccountId === currentAccountId) {
    return null;
  }

  const newAccount = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.id, newAccountId),
        eq(accounts.userId, userId),
        eq(accounts.householdId, householdId)
      )
    )
    .limit(1);

  if (newAccount.length === 0) {
    return Response.json({ error: 'Account not found' }, { status: 404 });
  }

  const newAccountEntity = await requireAccountEntityAccess(
    userId,
    householdId,
    newAccount[0].entityId
  );
  if (newAccountEntity.id !== selectedEntityId) {
    return Response.json(
      { error: 'Account does not belong to the selected entity' },
      { status: 403 }
    );
  }

  return null;
}

export async function validateUpdatedCategoryReference({
  userId,
  householdId,
  newCategoryId,
}: {
  userId: string;
  householdId: string;
  newCategoryId: string | null;
}): Promise<Response | null> {
  if (!newCategoryId) {
    return null;
  }

  const category = await db
    .select()
    .from(budgetCategories)
    .where(
      and(
        eq(budgetCategories.id, newCategoryId),
        eq(budgetCategories.userId, userId),
        eq(budgetCategories.householdId, householdId)
      )
    )
    .limit(1);

  if (category.length === 0) {
    return Response.json({ error: 'Category not found' }, { status: 404 });
  }

  return null;
}

export async function resolveSalesTaxabilityFromMerchantChange({
  transaction,
  newMerchantId,
}: {
  transaction: typeof transactions.$inferSelect;
  newMerchantId: string | null;
}): Promise<{
  newIsSalesTaxable: boolean;
  shouldDeleteSalesTaxRecord: boolean;
}> {
  let newIsSalesTaxable = transaction.isSalesTaxable;
  let shouldDeleteSalesTaxRecord = false;

  if (transaction.type !== 'income' || newMerchantId === transaction.merchantId || !newMerchantId) {
    return { newIsSalesTaxable, shouldDeleteSalesTaxRecord };
  }

  const merchantExemptCheck = await db
    .select({ isSalesTaxExempt: merchants.isSalesTaxExempt })
    .from(merchants)
    .where(eq(merchants.id, newMerchantId))
    .limit(1);
  const merchantIsSalesTaxExempt = merchantExemptCheck[0]?.isSalesTaxExempt || false;

  if (merchantIsSalesTaxExempt && transaction.isSalesTaxable) {
    newIsSalesTaxable = false;
    shouldDeleteSalesTaxRecord = true;
  }

  return {
    newIsSalesTaxable,
    shouldDeleteSalesTaxRecord,
  };
}
