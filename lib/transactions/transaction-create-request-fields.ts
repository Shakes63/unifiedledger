import type { CreateTransactionBody } from '@/lib/transactions/transaction-create-request';

export function normalizeCreateTransactionBody(body: CreateTransactionBody) {
  const {
    accountId,
    categoryId,
    merchantId,
    debtId,
    billInstanceId,
    date,
    amount,
    description,
    notes,
    type = 'expense',
    isPending = false,
    toAccountId,
    isSalesTaxable = false,
    offlineId,
    syncStatus = 'synced',
    savingsGoalId,
    goalContributions,
  } = body;

  return {
    accountId,
    categoryId,
    merchantId,
    debtId,
    billInstanceId,
    date,
    amount,
    description,
    notes,
    type,
    isPending,
    toAccountId,
    isSalesTaxable,
    offlineId,
    syncStatus,
    savingsGoalId,
    goalContributions,
  };
}
