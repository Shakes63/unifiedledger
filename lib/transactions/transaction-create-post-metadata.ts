/**
 * Post-create metadata updates: category/merchant usage analytics and the
 * rule-execution log entry. Best-effort — failures are logged, never fail the
 * transaction that already committed.
 *
 * Consolidated from 4 single-use shim files (metadata-query / metadata-writes /
 * metadata-usage / post-metadata) during the post-audit cleanup; behavior is
 * unchanged.
 */
import Decimal from 'decimal.js';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { db } from '@/lib/db';
import { budgetCategories, merchants, usageAnalytics } from '@/lib/db/schema';
import { logCreateRuleExecution } from '@/lib/transactions/transaction-create-rules';

// ---------------------------------------------------------------------------
// Usage-analytics context + writes
// ---------------------------------------------------------------------------

async function loadCreateMetadataUsageContext({
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

function buildCreateMetadataUsageWrites({
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

async function updateCreateCategoryAndMerchantUsage({
  userId,
  householdId,
  categoryId,
  finalMerchantId,
  decimalAmount,
}: {
  userId: string;
  householdId: string;
  categoryId?: string | null;
  finalMerchantId?: string | null;
  decimalAmount: Decimal;
}): Promise<void> {
  if (!categoryId && !finalMerchantId) {
    return;
  }

  const { categoryData, merchantData, categoryAnalytics, merchantAnalytics } =
    await loadCreateMetadataUsageContext({
      userId,
      householdId,
      categoryId,
      merchantId: finalMerchantId,
    });
  const nowIso = new Date().toISOString();
  const usageUpdates = buildCreateMetadataUsageWrites({
    userId,
    householdId,
    categoryId,
    merchantId: finalMerchantId,
    decimalAmount,
    nowIso,
    categoryData,
    merchantData,
    categoryAnalytics,
    merchantAnalytics,
  });

  if (usageUpdates.length > 0) {
    await Promise.all(usageUpdates);
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function runTransactionCreateMetadataUpdates({
  userId,
  householdId,
  transactionId,
  categoryId,
  finalMerchantId,
  decimalAmount,
  appliedRuleId,
  appliedCategoryId,
  appliedActions,
}: {
  userId: string;
  householdId: string;
  transactionId: string;
  categoryId?: string | null;
  finalMerchantId?: string | null;
  decimalAmount: Decimal;
  appliedRuleId?: string | null;
  appliedCategoryId?: string | null;
  appliedActions: unknown[];
}): Promise<void> {
  try {
    await updateCreateCategoryAndMerchantUsage({
      userId,
      householdId,
      categoryId,
      finalMerchantId,
      decimalAmount,
    });
  } catch (error) {
    console.error('Error updating usage analytics:', error);
  }

  try {
    await logCreateRuleExecution({
      userId,
      householdId,
      transactionId,
      appliedRuleId,
      appliedCategoryId,
      appliedActions,
    });
  } catch (error) {
    console.error('Error logging rule execution:', error);
  }
}
