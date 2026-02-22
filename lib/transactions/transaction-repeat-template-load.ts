import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { accounts, merchants, transactionTemplates } from '@/lib/db/schema';

export async function loadRepeatTemplateAndAccount({
  userId,
  householdId,
  templateId,
}: {
  userId: string;
  householdId: string;
  templateId: string;
}): Promise<{
  template: typeof transactionTemplates.$inferSelect | null;
  account: typeof accounts.$inferSelect | null;
}> {
  const templateRows = await db
    .select()
    .from(transactionTemplates)
    .where(and(eq(transactionTemplates.id, templateId), eq(transactionTemplates.userId, userId)))
    .limit(1);

  if (templateRows.length === 0) {
    return { template: null, account: null };
  }

  const template = templateRows[0];
  const accountRows = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.id, template.accountId),
        eq(accounts.userId, userId),
        eq(accounts.householdId, householdId)
      )
    )
    .limit(1);

  return { template, account: accountRows[0] ?? null };
}

export async function validateRepeatRuleMerchant({
  userId,
  householdId,
  finalMerchantId,
}: {
  userId: string;
  householdId: string;
  finalMerchantId: string | null;
}): Promise<string | null> {
  if (!finalMerchantId) {
    return null;
  }

  const merchantExists = await db
    .select()
    .from(merchants)
    .where(
      and(
        eq(merchants.id, finalMerchantId),
        eq(merchants.userId, userId),
        eq(merchants.householdId, householdId)
      )
    )
    .limit(1);

  if (merchantExists.length === 0) {
    console.warn('Rule set merchantId but merchant not found; ignoring merchant mutation');
    return null;
  }

  return finalMerchantId;
}
