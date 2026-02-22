import { requireAuth } from '@/lib/auth-helpers';
import { handleRouteError } from '@/lib/api/route-helpers';
import {
  type CreateTransactionBody,
  validateCreateTransactionBody,
} from '@/lib/transactions/transaction-create-request';
import { resolveTransactionRouteContext } from '@/lib/transactions/transaction-route-context';
import { executeCreateTransactionOrchestration } from '@/lib/transactions/transaction-create-orchestrator';
import { executeListTransactionsOrchestration } from '@/lib/transactions/transaction-list-orchestrator';
// Sales tax now handled as boolean flag on transaction, no separate records needed

export const dynamic = 'force-dynamic';

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
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
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
