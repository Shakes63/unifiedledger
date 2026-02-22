import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { db } from '@/lib/db';
import { usageAnalytics } from '@/lib/db/schema';

export async function trackTransferPairUsage({
  userId,
  householdId,
  fromAccountId,
  toAccountId,
}: {
  userId: string;
  householdId: string;
  fromAccountId: string;
  toAccountId: string;
}) {
  const existingAnalytics = await db
    .select()
    .from(usageAnalytics)
    .where(
      and(
        eq(usageAnalytics.userId, userId),
        eq(usageAnalytics.householdId, householdId),
        eq(usageAnalytics.itemType, 'transfer_pair'),
        eq(usageAnalytics.itemId, fromAccountId),
        eq(usageAnalytics.itemSecondaryId, toAccountId)
      )
    )
    .limit(1);

  if (existingAnalytics.length > 0) {
    await db
      .update(usageAnalytics)
      .set({
        usageCount: (existingAnalytics[0].usageCount || 0) + 1,
        lastUsedAt: new Date().toISOString(),
      })
      .where(eq(usageAnalytics.id, existingAnalytics[0].id));
    return;
  }

  await db.insert(usageAnalytics).values({
    id: nanoid(),
    userId,
    householdId,
    itemType: 'transfer_pair',
    itemId: fromAccountId,
    itemSecondaryId: toAccountId,
    usageCount: 1,
    lastUsedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });
}

