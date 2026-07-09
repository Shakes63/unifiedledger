/**
 * Route handlers for /api/transactions: list (GET) and create (POST) orchestration.
 *
 * Consolidated from single-use shim files during the post-audit cleanup;
 * behavior is unchanged.
 */
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { savingsGoals, transactions } from '@/lib/db/schema';
import Decimal from 'decimal.js';
import { getCombinedTransferViewPreference } from '@/lib/preferences/transfer-view-preference';
import { requireAuth } from '@/lib/auth-helpers';
import { handleRouteError } from '@/lib/api/route-helpers';
import { parsePagination } from '@/lib/api/pagination';
import {
  type CreateTransactionBody,
  validateCreateTransactionBody,
} from '@/lib/transactions/transaction-create-request';
import { resolveTransactionRouteContext } from '@/lib/transactions/transaction-route-context';
import {
  executeCreateTransactionOrchestration,
} from '@/lib/transactions/transaction-create-orchestrator';

// ---------------------------------------------------------------------------
// from transaction-list-query.ts
// ---------------------------------------------------------------------------
function buildTransactionListConditions({
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

async function listTransactionsWithGoalInfo({
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

async function countTransactionsForList({
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

// ---------------------------------------------------------------------------
// from transaction-list-orchestrator.ts
// ---------------------------------------------------------------------------
async function executeListTransactionsOrchestration({
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

// ---------------------------------------------------------------------------
// from transaction-route-handlers.ts
// ---------------------------------------------------------------------------
// Sales tax now handled as boolean flag on transaction, no separate records needed

export async function handleCreateTransaction(request: Request) {
  // OPTIMIZATION: Performance monitoring (Task 8)
  const startTime = performance.now();

  try {
    const { userId } = await requireAuth();

    const body = (await request.json()) as CreateTransactionBody;

    const { householdId, selectedEntity } = await resolveTransactionRouteContext({
      request,
      userId,
      body,
    });

    const validationError = validateCreateTransactionBody(body);
    if (validationError) {
      return validationError;
    }

    return await executeCreateTransactionOrchestration({
      userId,
      householdId,
      selectedEntityId: selectedEntity.id,
      body,
      startTime,
    });
  } catch (error) {
    return handleRouteError(error, {
      defaultError: 'Internal server error',
      logLabel: 'Transaction creation error:',
      householdIdRequiredMessage: 'Household ID is required. Please select a household.',
    });
  }
}

export async function handleListTransactions(request: Request) {
  try {
    const { userId } = await requireAuth();

    const { householdId, selectedEntity } = await resolveTransactionRouteContext({
      request,
      userId,
    });

    const url = new URL(request.url);
    // Clamped pagination (L-SEC-12): `?limit=abc` no longer yields .limit(NaN).
    const { limit, offset } = parsePagination(url.searchParams);
    const accountId = url.searchParams.get('accountId');

    return await executeListTransactionsOrchestration({
      userId,
      householdId,
      selectedEntityId: selectedEntity.id,
      selectedEntityIsDefault: selectedEntity.isDefault,
      accountId,
      limit,
      offset,
    });
  } catch (error) {
    return handleRouteError(error, {
      defaultError: 'Internal server error',
      logLabel: 'Transaction fetch error:',
      householdIdRequiredMessage: 'Household ID is required. Please select a household.',
    });
  }
}
