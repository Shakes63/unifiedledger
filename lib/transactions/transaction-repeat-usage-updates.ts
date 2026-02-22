import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { db } from '@/lib/db';
import { budgetCategories, transactionTemplates, usageAnalytics } from '@/lib/db/schema';

export async function updateRepeatTemplateUsage({
  templateId,
  tmplUsageCount,
}: {
  templateId: string;
  tmplUsageCount: number | null;
}): Promise<void> {
  await db
    .update(transactionTemplates)
    .set({
      usageCount: (tmplUsageCount || 0) + 1,
      lastUsedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(transactionTemplates.id, templateId));
}

export async function updateRepeatCategoryUsage({
  userId,
  householdId,
  appliedCategoryId,
}: {
  userId: string;
  householdId: string;
  appliedCategoryId: string | null;
}): Promise<void> {
  if (!appliedCategoryId) {
    return;
  }

  const category = await db
    .select()
    .from(budgetCategories)
    .where(
      and(
        eq(budgetCategories.id, appliedCategoryId),
        eq(budgetCategories.userId, userId),
        eq(budgetCategories.householdId, householdId)
      )
    )
    .limit(1);

  if (category.length === 0) {
    return;
  }

  await db
    .update(budgetCategories)
    .set({
      lastUsedAt: new Date().toISOString(),
      usageCount: (category[0].usageCount || 0) + 1,
    })
    .where(
      and(
        eq(budgetCategories.id, appliedCategoryId),
        eq(budgetCategories.userId, userId),
        eq(budgetCategories.householdId, householdId)
      )
    );

  const existingAnalytics = await db
    .select()
    .from(usageAnalytics)
    .where(
      and(
        eq(usageAnalytics.userId, userId),
        eq(usageAnalytics.householdId, householdId),
        eq(usageAnalytics.itemType, 'category'),
        eq(usageAnalytics.itemId, appliedCategoryId)
      )
    )
    .limit(1);

  if (existingAnalytics.length > 0 && existingAnalytics[0]) {
    await db
      .update(usageAnalytics)
      .set({
        usageCount: (existingAnalytics[0].usageCount || 0) + 1,
        lastUsedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(usageAnalytics.userId, userId),
          eq(usageAnalytics.householdId, householdId),
          eq(usageAnalytics.itemType, 'category'),
          eq(usageAnalytics.itemId, appliedCategoryId)
        )
      );
    return;
  }

  await db.insert(usageAnalytics).values({
    id: nanoid(),
    userId,
    householdId,
    itemType: 'category',
    itemId: appliedCategoryId,
    usageCount: 1,
    lastUsedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });
}
