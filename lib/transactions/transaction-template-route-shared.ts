import { and, eq } from 'drizzle-orm';

import { handleRouteError } from '@/lib/api/route-helpers';
import { db } from '@/lib/db';
import { accounts, budgetCategories, transactionTemplates } from '@/lib/db/schema';

export function mapTemplateRouteError(error: unknown, logLabel: string): Response {
  return handleRouteError(error, {
    defaultError: 'Internal server error',
    logLabel,
  });
}

export async function findUserTemplate(userId: string, templateId: string) {
  const template = await db
    .select()
    .from(transactionTemplates)
    .where(and(eq(transactionTemplates.id, templateId), eq(transactionTemplates.userId, userId)))
    .limit(1);

  return template[0] ?? null;
}

export async function validateTemplateLinksInHousehold(
  userId: string,
  householdId: string,
  accountId?: string,
  categoryId?: string
): Promise<Response | null> {
  if (accountId) {
    const account = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.id, accountId),
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId)
        )
      )
      .limit(1);

    if (account.length === 0) {
      return Response.json({ error: 'Account not found in household' }, { status: 404 });
    }
  }

  if (categoryId) {
    const category = await db
      .select({ id: budgetCategories.id })
      .from(budgetCategories)
      .where(
        and(
          eq(budgetCategories.id, categoryId),
          eq(budgetCategories.userId, userId),
          eq(budgetCategories.householdId, householdId)
        )
      )
      .limit(1);

    if (category.length === 0) {
      return Response.json({ error: 'Category not found in household' }, { status: 404 });
    }
  }

  return null;
}
