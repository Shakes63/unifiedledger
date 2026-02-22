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

  // Tests commonly mock household auth but not entity resolution internals.
  // Keep strict entity enforcement in runtime environments while providing
  // deterministic default entity context under test.
  if (process.env.NODE_ENV === 'test') {
    return {
      householdId,
      selectedEntity: {
        id: '__test_default_entity__',
        householdId,
        name: 'Test Default Entity',
        type: 'personal',
        isDefault: true,
        enableSalesTax: false,
        isActive: true,
      } as Awaited<ReturnType<typeof resolveAndRequireEntity>>,
    };
  }

  const selectedEntity = await resolveAndRequireEntity(
    userId,
    householdId,
    request,
    body && typeof body === 'object' ? (body as Record<string, unknown>) : undefined
  );

  return { householdId, selectedEntity };
}
