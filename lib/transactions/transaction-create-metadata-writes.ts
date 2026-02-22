import Decimal from 'decimal.js';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { db } from '@/lib/db';
import { budgetCategories, merchants, usageAnalytics } from '@/lib/db/schema';

export function buildCreateMetadataUsageWrites({
  userId,
  householdId,
  categoryId,
  merchantId,
  decimalAmount,
  nowIso,
  categoryData,
  merchantData,
  categoryAnalytics,
  merchantAnalytics,
}: {
  userId: string;
  householdId: string;
  categoryId?: string | null;
  merchantId?: string | null;
  decimalAmount: Decimal;
  nowIso: string;
  categoryData: Array<typeof budgetCategories.$inferSelect>;
  merchantData: Array<typeof merchants.$inferSelect>;
  categoryAnalytics: Array<typeof usageAnalytics.$inferSelect>;
  merchantAnalytics: Array<typeof usageAnalytics.$inferSelect>;
}): Array<Promise<unknown>> {
  const writes: Array<Promise<unknown>> = [];

  if (categoryId && categoryData.length > 0) {
    const category = categoryData[0];
    writes.push(
      db
        .update(budgetCategories)
        .set({
          lastUsedAt: nowIso,
          usageCount: (category.usageCount || 0) + 1,
        })
        .where(eq(budgetCategories.id, categoryId)),
      categoryAnalytics.length > 0
        ? db
            .update(usageAnalytics)
            .set({
              usageCount: (categoryAnalytics[0].usageCount || 0) + 1,
              lastUsedAt: nowIso,
            })
            .where(
              and(
                eq(usageAnalytics.userId, userId),
                eq(usageAnalytics.householdId, householdId),
                eq(usageAnalytics.itemType, 'category'),
                eq(usageAnalytics.itemId, categoryId)
              )
            )
        : db.insert(usageAnalytics).values({
            id: nanoid(),
            userId,
            householdId,
            itemType: 'category',
            itemId: categoryId,
            usageCount: 1,
            lastUsedAt: nowIso,
            createdAt: nowIso,
          })
    );
  }

  if (merchantId && merchantData.length > 0) {
    const merchant = merchantData[0];
    const currentSpent = new Decimal(merchant.totalSpent || 0);
    const newSpent = currentSpent.plus(decimalAmount);
    const usageCount = merchant.usageCount || 0;
    const avgTransaction = newSpent.dividedBy(usageCount + 1);

    writes.push(
      db
        .update(merchants)
        .set({
          usageCount: usageCount + 1,
          lastUsedAt: nowIso,
          totalSpent: newSpent.toNumber(),
          averageTransaction: avgTransaction.toNumber(),
        })
        .where(eq(merchants.id, merchantId)),
      merchantAnalytics.length > 0
        ? db
            .update(usageAnalytics)
            .set({
              usageCount: (merchantAnalytics[0].usageCount || 0) + 1,
              lastUsedAt: nowIso,
            })
            .where(
              and(
                eq(usageAnalytics.userId, userId),
                eq(usageAnalytics.householdId, householdId),
                eq(usageAnalytics.itemType, 'merchant'),
                eq(usageAnalytics.itemId, merchantId)
              )
            )
        : db.insert(usageAnalytics).values({
            id: nanoid(),
            userId,
            householdId,
            itemType: 'merchant',
            itemId: merchantId,
            usageCount: 1,
            lastUsedAt: nowIso,
            createdAt: nowIso,
          })
    );
  }

  return writes;
}
