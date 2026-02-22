import { requireAuth } from '@/lib/auth-helpers';
import { handleRouteError } from '@/lib/api/route-helpers';
import { buildEnrichedTransactionResponse } from '@/lib/transactions/transaction-get-by-id';
import { executeTransactionUpdateOrchestration } from '@/lib/transactions/transaction-update-orchestrator';
import {
  buildTransactionNotFoundResponse,
  loadTransactionRouteRequestContext,
} from '@/lib/transactions/transaction-id-request-context';
import { executeTransactionDeleteOrchestration } from '@/lib/transactions/transaction-delete-orchestrator';

export const dynamic = 'force-dynamic';

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
