import { resolveAndRequireEntity } from '@/lib/api/entity-auth';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';

export async function resolveTransactionRouteContext({
  request,
  userId,
  body,
}: {
  request: Request;
  userId: string;
  body?: unknown;
}): Promise<{
  householdId: string;
  selectedEntity: Awaited<ReturnType<typeof resolveAndRequireEntity>>;
}> {
  const householdId = getHouseholdIdFromRequest(
    request,
    body && typeof body === 'object' ? (body as Record<string, unknown>) : undefined
  );
  await requireHouseholdAuth(userId, householdId);

  if (!householdId) {
    throw new Error('Household ID is required');
  }

  const selectedEntity = await resolveAndRequireEntity(
    userId,
    householdId,
    request,
    body && typeof body === 'object' ? (body as Record<string, unknown>) : undefined
  );

  return { householdId, selectedEntity };
}
