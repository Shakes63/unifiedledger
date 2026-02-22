import { apiDebugLog } from '@/lib/api/route-helpers';

interface LogTransactionCreatePerformanceParams {
  startTime: number;
  type: string;
  appliedCategoryId?: string | null;
  finalMerchantId?: string | null;
  linkedBillId?: string | null;
  linkedDebtId?: string | null;
  appliedRuleId?: string | null;
}

export function logTransactionCreatePerformance({
  startTime,
  type,
  appliedCategoryId,
  finalMerchantId,
  linkedBillId,
  linkedDebtId,
  appliedRuleId,
}: LogTransactionCreatePerformanceParams): void {
  const duration = performance.now() - startTime;
  apiDebugLog(`transactions:create`, `Transaction created in ${duration.toFixed(2)}ms`, {
    type,
    hasCategory: Boolean(appliedCategoryId),
    hasMerchant: Boolean(finalMerchantId),
    hasBill: Boolean(linkedBillId),
    hasDebt: Boolean(linkedDebtId),
    hasRules: Boolean(appliedRuleId),
    isTransfer: type === 'transfer',
  });
}
