/**
 * Route handlers for /api/transactions/[id]: scoped load, GET/PUT/DELETE orchestration.
 *
 * Consolidated from single-use shim files during the post-audit cleanup;
 * behavior is unchanged.
 */
import { and, eq, isNull, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  transactions,
  accounts,
  billTemplates,
  budgetCategories,
  customFieldValues,
  customFields,
  debts,
  merchants,
  tags,
  transactionTags,
} from '@/lib/db/schema';
import { resolveTransactionRouteContext } from '@/lib/transactions/transaction-route-context';
import { requireAuth } from '@/lib/auth-helpers';
import { handleRouteError } from '@/lib/api/route-helpers';
import {
  executeTransactionUpdateOrchestration,
} from '@/lib/transactions/transaction-update-orchestrator';
import {
  executeTransactionDeleteOrchestration,
} from '@/lib/transactions/transaction-delete-orchestrator';

// ---------------------------------------------------------------------------
// from transaction-scoped-load.ts
// ---------------------------------------------------------------------------
function buildEntityScopedTransactionFilter({
  id,
  userId,
  householdId,
  selectedEntityId,
  selectedEntityIsDefault,
}: {
  id: string;
  userId: string;
  householdId: string;
  selectedEntityId: string;
  selectedEntityIsDefault: boolean;
}) {
  const entityScope = selectedEntityIsDefault
    ? or(eq(transactions.entityId, selectedEntityId), isNull(transactions.entityId))
    : eq(transactions.entityId, selectedEntityId);

  return and(
    eq(transactions.id, id),
    eq(transactions.userId, userId),
    eq(transactions.householdId, householdId),
    entityScope
  );
}

async function loadScopedTransactionById({
  id,
  userId,
  householdId,
  selectedEntityId,
  selectedEntityIsDefault,
}: {
  id: string;
  userId: string;
  householdId: string;
  selectedEntityId: string;
  selectedEntityIsDefault: boolean;
}): Promise<typeof transactions.$inferSelect | null> {
  const rows = await db
    .select()
    .from(transactions)
    .where(
      buildEntityScopedTransactionFilter({
        id,
        userId,
        householdId,
        selectedEntityId,
        selectedEntityIsDefault,
      })
    )
    .limit(1);

  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// from transaction-id-request-context.ts
// ---------------------------------------------------------------------------
async function loadTransactionRouteRequestContext({
  request,
  userId,
  id,
  body,
}: {
  request: Request;
  userId: string;
  id: string;
  body?: Record<string, unknown>;
}): Promise<{
  householdId: string;
  selectedEntityId: string;
  selectedEntityIsDefault: boolean;
  transaction: Awaited<ReturnType<typeof loadScopedTransactionById>>;
}> {
  const { householdId, selectedEntity } = await resolveTransactionRouteContext({
    request,
    userId,
    body,
  });

  const transaction = await loadScopedTransactionById({
    id,
    userId,
    householdId,
    selectedEntityId: selectedEntity.id,
    selectedEntityIsDefault: selectedEntity.isDefault,
  });

  return {
    householdId,
    selectedEntityId: selectedEntity.id,
    selectedEntityIsDefault: selectedEntity.isDefault,
    transaction,
  };
}

function buildTransactionNotFoundResponse(): Response {
  return Response.json({ error: 'Transaction not found' }, { status: 404 });
}

// ---------------------------------------------------------------------------
// from transaction-get-by-id.ts
// ---------------------------------------------------------------------------
async function buildEnrichedTransactionResponse(
  transactionId: string,
  txData: typeof transactions.$inferSelect
) {
  const [accountData, categoryData, merchantData, billData, debtData] = await Promise.all([
    txData.accountId
      ? db
          .select()
          .from(accounts)
          .where(
            and(
              eq(accounts.id, txData.accountId),
              eq(accounts.userId, txData.userId),
              eq(accounts.householdId, txData.householdId)
            )
          )
          .limit(1)
      : Promise.resolve([]),
    txData.categoryId
      ? db
          .select()
          .from(budgetCategories)
          .where(
            and(
              eq(budgetCategories.id, txData.categoryId),
              eq(budgetCategories.userId, txData.userId),
              eq(budgetCategories.householdId, txData.householdId)
            )
          )
          .limit(1)
      : Promise.resolve([]),
    txData.merchantId
      ? db
          .select()
          .from(merchants)
          .where(
            and(
              eq(merchants.id, txData.merchantId),
              eq(merchants.userId, txData.userId),
              eq(merchants.householdId, txData.householdId)
            )
          )
          .limit(1)
      : Promise.resolve([]),
    txData.billId
      ? db
          .select()
          .from(billTemplates)
          .where(
            and(
              eq(billTemplates.id, txData.billId),
              eq(billTemplates.createdByUserId, txData.userId),
              eq(billTemplates.householdId, txData.householdId)
            )
          )
          .limit(1)
      : Promise.resolve([]),
    txData.debtId
      ? db
          .select()
          .from(debts)
          .where(
            and(
              eq(debts.id, txData.debtId),
              eq(debts.userId, txData.userId),
              eq(debts.householdId, txData.householdId)
            )
          )
          .limit(1)
      : Promise.resolve([]),
  ]);

  const tagLinks = await db
    .select({
      tag: tags,
    })
    .from(transactionTags)
    .innerJoin(tags, eq(transactionTags.tagId, tags.id))
    .where(eq(transactionTags.transactionId, transactionId));

  const fieldValues = await db
    .select({
      field: customFields,
      value: customFieldValues,
    })
    .from(customFieldValues)
    .innerJoin(customFields, eq(customFieldValues.customFieldId, customFields.id))
    .where(eq(customFieldValues.transactionId, transactionId));

  return {
    ...txData,
    account: accountData[0] || null,
    category: categoryData[0] || null,
    merchant: merchantData[0] || null,
    bill: billData[0] || null,
    debt: debtData[0] || null,
    tags: tagLinks.map((t) => t.tag),
    customFields: fieldValues.map((cf) => ({
      field: cf.field,
      value: cf.value,
    })),
  };
}

// ---------------------------------------------------------------------------
// from transaction-id-route-handlers.ts
// ---------------------------------------------------------------------------
export async function handleGetTransactionById(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;

    const { transaction } = await loadTransactionRouteRequestContext({
      request,
      userId,
      id,
    });

    if (!transaction) {
      return buildTransactionNotFoundResponse();
    }

    const enrichedTransaction = await buildEnrichedTransactionResponse(id, transaction);

    return Response.json(enrichedTransaction);
  } catch (error) {
    return handleRouteError(error, {
      defaultError: 'Internal server error',
      logLabel: 'Transaction fetch error:',
    });
  }
}

export async function handleUpdateTransactionById(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const { householdId, selectedEntityId, transaction } = await loadTransactionRouteRequestContext({
      request,
      userId,
      id,
      body,
    });

    if (!transaction) {
      return buildTransactionNotFoundResponse();
    }

    return await executeTransactionUpdateOrchestration({
      id,
      userId,
      householdId,
      selectedEntityId,
      transaction,
      body,
    });
  } catch (error) {
    return handleRouteError(error, {
      defaultError: 'Internal server error',
      logLabel: 'Transaction update error:',
    });
  }
}

export async function handleDeleteTransactionById(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;

    const { householdId, transaction } = await loadTransactionRouteRequestContext({
      request,
      userId,
      id,
    });

    if (!transaction) {
      return buildTransactionNotFoundResponse();
    }

    return executeTransactionDeleteOrchestration({
      transactionId: id,
      userId,
      householdId,
      transaction,
    });
  } catch (error) {
    return handleRouteError(error, {
      defaultError: 'Internal server error',
      logLabel: 'Transaction delete error:',
    });
  }
}
