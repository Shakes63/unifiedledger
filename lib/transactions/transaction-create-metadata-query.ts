import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { budgetCategories, merchants, usageAnalytics } from '@/lib/db/schema';

export async function loadCreateMetadataUsageContext({
  userId,
  householdId,
  categoryId,
  merchantId,
}: {
  userId: string;
  householdId: string;
  categoryId?: string | null;
  merchantId?: string | null;
}): Promise<{
  categoryData: Array<typeof budgetCategories.$inferSelect>;
  merchantData: Array<typeof merchants.$inferSelect>;
  categoryAnalytics: Array<typeof usageAnalytics.$inferSelect>;
  merchantAnalytics: Array<typeof usageAnalytics.$inferSelect>;
}> {
  const [categoryData, merchantData, categoryAnalytics, merchantAnalytics] = await Promise.all([
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
    merchantId
      ? db
          .select()
          .from(merchants)
          .where(
            and(
              eq(merchants.id, merchantId),
              eq(merchants.householdId, householdId)
            )
          )
          .limit(1)
      : Promise.resolve([]),
    categoryId
      ? db
          .select()
          .from(usageAnalytics)
          .where(
            and(
              eq(usageAnalytics.userId, userId),
              eq(usageAnalytics.householdId, householdId),
              eq(usageAnalytics.itemType, 'category'),
              eq(usageAnalytics.itemId, categoryId)
            )
          )
          .limit(1)
      : Promise.resolve([]),
    merchantId
      ? db
          .select()
          .from(usageAnalytics)
          .where(
            and(
              eq(usageAnalytics.userId, userId),
              eq(usageAnalytics.householdId, householdId),
              eq(usageAnalytics.itemType, 'merchant'),
              eq(usageAnalytics.itemId, merchantId)
            )
          )
          .limit(1)
      : Promise.resolve([]),
  ]);

  return {
    categoryData,
    merchantData,
    categoryAnalytics,
    merchantAnalytics,
  };
}
