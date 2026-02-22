import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { savingsGoals, transactions } from '@/lib/db/schema';

export function buildTransactionListConditions({
  householdId,
  selectedEntityId,
  selectedEntityIsDefault,
  accountId,
  shouldUseCombinedTransferFilter,
}: {
  householdId: string;
  selectedEntityId: string;
  selectedEntityIsDefault: boolean;
  accountId: string | null;
  shouldUseCombinedTransferFilter: boolean;
}) {
  const entityScope = selectedEntityIsDefault
    ? or(eq(transactions.entityId, selectedEntityId), isNull(transactions.entityId))
    : eq(transactions.entityId, selectedEntityId);

  return [
    eq(transactions.householdId, householdId),
    entityScope,
    ...(accountId ? [eq(transactions.accountId, accountId)] : []),
    ...(shouldUseCombinedTransferFilter ? [sql`${transactions.type} != 'transfer_in'`] : []),
  ];
}

export async function listTransactionsWithGoalInfo({
  listConditions,
  limit,
  offset,
}: {
  listConditions: ReturnType<typeof buildTransactionListConditions>;
  limit: number;
  offset: number;
}) {
  return db
    .select({
      id: transactions.id,
      userId: transactions.userId,
      householdId: transactions.householdId,
      accountId: transactions.accountId,
      categoryId: transactions.categoryId,
      merchantId: transactions.merchantId,
      debtId: transactions.debtId,
      savingsGoalId: transactions.savingsGoalId,
      date: transactions.date,
      amountCents: transactions.amountCents,
      description: transactions.description,
      notes: transactions.notes,
      type: transactions.type,
      transferId: transactions.transferId,
      transferGroupId: transactions.transferGroupId,
      pairedTransactionId: transactions.pairedTransactionId,
      transferSourceAccountId: transactions.transferSourceAccountId,
      transferDestinationAccountId: transactions.transferDestinationAccountId,
      isPending: transactions.isPending,
      isRefund: transactions.isRefund,
      isBalanceTransfer: transactions.isBalanceTransfer,
      isSplit: transactions.isSplit,
      isTaxDeductible: transactions.isTaxDeductible,
      taxDeductionType: transactions.taxDeductionType,
      isSalesTaxable: transactions.isSalesTaxable,
      offlineId: transactions.offlineId,
      syncStatus: transactions.syncStatus,
      syncedAt: transactions.syncedAt,
      syncAttempts: transactions.syncAttempts,
      syncError: transactions.syncError,
      createdAt: transactions.createdAt,
      updatedAt: transactions.updatedAt,
      savingsGoalName: savingsGoals.name,
      savingsGoalColor: savingsGoals.color,
    })
    .from(transactions)
    .leftJoin(savingsGoals, eq(transactions.savingsGoalId, savingsGoals.id))
    .where(and(...listConditions))
    .orderBy(desc(transactions.date))
    .limit(limit)
    .offset(offset);
}

export async function countTransactionsForList({
  listConditions,
}: {
  listConditions: ReturnType<typeof buildTransactionListConditions>;
}) {
  const countResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(transactions)
    .where(and(...listConditions));

  return countResult[0]?.count || 0;
}

