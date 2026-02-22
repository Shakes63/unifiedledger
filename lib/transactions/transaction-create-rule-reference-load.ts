import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { budgetCategories, merchants } from '@/lib/db/schema';

export async function loadRuleReferenceData({
  userId,
  householdId,
  merchantId,
  categoryId,
}: {
  userId: string;
  householdId: string;
  merchantId?: string | null;
  categoryId?: string | null;
}): Promise<{
  merchantInfo: { id: string; name: string } | null;
  categoryInfo: { id: string; name: string; type: string } | null;
}> {
  const [merchantResult, categoryResult] = await Promise.all([
    merchantId
      ? db
          .select()
          .from(merchants)
          .where(
            and(
              eq(merchants.id, merchantId),
              eq(merchants.userId, userId),
              eq(merchants.householdId, householdId)
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

  return {
    merchantInfo:
      merchantResult.length > 0
        ? {
            id: merchantResult[0].id,
            name: merchantResult[0].name,
          }
        : null,
    categoryInfo:
      categoryResult.length > 0
        ? {
            id: categoryResult[0].id,
            name: categoryResult[0].name,
            type: categoryResult[0].type,
          }
        : null,
  };
}
