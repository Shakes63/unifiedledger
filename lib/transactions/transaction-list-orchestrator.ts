import Decimal from 'decimal.js';

import { getCombinedTransferViewPreference } from '@/lib/preferences/transfer-view-preference';
import {
  buildTransactionListConditions,
  countTransactionsForList,
  listTransactionsWithGoalInfo,
} from '@/lib/transactions/transaction-list-query';

export async function executeListTransactionsOrchestration({
  userId,
  householdId,
  selectedEntityId,
  selectedEntityIsDefault,
  accountId,
  limit,
  offset,
}: {
  userId: string;
  householdId: string;
  selectedEntityId: string;
  selectedEntityIsDefault: boolean;
  accountId: string | null;
  limit: number;
  offset: number;
}): Promise<Response> {
  const combinedTransferView = await getCombinedTransferViewPreference(userId, householdId);
  const shouldUseCombinedTransferFilter = combinedTransferView && !accountId;

  const listConditions = buildTransactionListConditions({
    householdId,
    selectedEntityId,
    selectedEntityIsDefault,
    accountId,
    shouldUseCombinedTransferFilter,
  });

  const userTransactionsWithGoals = await listTransactionsWithGoalInfo({
    listConditions,
    limit,
    offset,
  });
  const normalizedTransactions = userTransactionsWithGoals.map((transaction) => ({
    ...transaction,
    amount: new Decimal(transaction.amountCents ?? 0).div(100).toNumber(),
  }));

  const totalCount = await countTransactionsForList({ listConditions });

  return Response.json({
    data: normalizedTransactions,
    total: totalCount,
    limit,
    offset,
  });
}
