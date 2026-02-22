import { loadScopedTransactionById } from '@/lib/transactions/transaction-scoped-load';
import { resolveTransactionRouteContext } from '@/lib/transactions/transaction-route-context';

export async function loadTransactionRouteRequestContext({
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

export function buildTransactionNotFoundResponse(): Response {
  return Response.json({ error: 'Transaction not found' }, { status: 404 });
}
