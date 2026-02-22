import Decimal from 'decimal.js';

import { loadCreateMetadataUsageContext } from '@/lib/transactions/transaction-create-metadata-query';
import { buildCreateMetadataUsageWrites } from '@/lib/transactions/transaction-create-metadata-writes';

export async function updateCreateCategoryAndMerchantUsage({
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
