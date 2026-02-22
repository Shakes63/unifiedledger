import Decimal from 'decimal.js';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { db } from '@/lib/db';
import { merchants } from '@/lib/db/schema';

async function applyMerchantSpendUpdate({
  merchant,
  where,
  decimalAmount,
}: {
  merchant: typeof merchants.$inferSelect;
  where: ReturnType<typeof and>;
  decimalAmount: Decimal;
}): Promise<void> {
  const currentSpent = new Decimal(merchant.totalSpent || 0);
  const newSpent = currentSpent.plus(decimalAmount);
  const usageCount = merchant.usageCount || 0;
  const avgTransaction = newSpent.dividedBy(usageCount + 1);

  await db
    .update(merchants)
    .set({
      usageCount: usageCount + 1,
      lastUsedAt: new Date().toISOString(),
      totalSpent: newSpent.toNumber(),
      averageTransaction: avgTransaction.toNumber(),
    })
    .where(where);
}

export async function updateRepeatMerchantUsage({
  userId,
  householdId,
  finalMerchantId,
  finalDescription,
  appliedCategoryId,
  decimalAmount,
}: {
  userId: string;
  householdId: string;
  finalMerchantId: string | null;
  finalDescription: string;
  appliedCategoryId: string | null;
  decimalAmount: Decimal;
}): Promise<void> {
  if (finalMerchantId) {
    const merchantByIdWhere = and(
      eq(merchants.id, finalMerchantId),
      eq(merchants.userId, userId),
      eq(merchants.householdId, householdId)
    );
    const merchantById = await db.select().from(merchants).where(merchantByIdWhere).limit(1);
    if (merchantById.length > 0 && merchantById[0]) {
      await applyMerchantSpendUpdate({
        merchant: merchantById[0],
        where: merchantByIdWhere,
        decimalAmount,
      });
      return;
    }
  }

  const normalizedDescription = finalDescription.toLowerCase().trim();
  const merchantByNameWhere = and(
    eq(merchants.userId, userId),
    eq(merchants.householdId, householdId),
    eq(merchants.normalizedName, normalizedDescription)
  );
  const merchantByName = await db.select().from(merchants).where(merchantByNameWhere).limit(1);
  if (merchantByName.length > 0 && merchantByName[0]) {
    await applyMerchantSpendUpdate({
      merchant: merchantByName[0],
      where: merchantByNameWhere,
      decimalAmount,
    });
    return;
  }

  await db.insert(merchants).values({
    id: nanoid(),
    userId,
    householdId,
    name: finalDescription,
    normalizedName: normalizedDescription,
    categoryId: appliedCategoryId || null,
    usageCount: 1,
    lastUsedAt: new Date().toISOString(),
    totalSpent: decimalAmount.toNumber(),
    averageTransaction: decimalAmount.toNumber(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}
