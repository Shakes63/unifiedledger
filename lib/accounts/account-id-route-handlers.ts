import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { handleRouteError } from '@/lib/api/route-helpers';
import { resolveAndRequireEntity } from '@/lib/api/entity-auth';
import {
  AccountLifecycleError,
  deleteAccountWithLifecycleEffects,
  updateAccountWithLifecycleEffects,
} from '@/lib/accounts/account-lifecycle-service';

export const dynamic = 'force-dynamic';

export async function handleUpdateAccountById(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const householdId = getHouseholdIdFromRequest(request, body);
    await requireHouseholdAuth(userId, householdId);

    if (!householdId) {
      return Response.json({ error: 'Household ID is required' }, { status: 400 });
    }

    const entity = await resolveAndRequireEntity(userId, householdId, request, body);

    const result = await updateAccountWithLifecycleEffects({
      id,
      userId,
      householdId,
      entityId: entity.id,
      allowLegacyUnscoped: entity.isDefault,
      body,
    });

    return Response.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof AccountLifecycleError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return handleRouteError(error, {
      defaultError: 'Internal server error',
      logLabel: 'Account update error:',
    });
  }
}

export async function handleDeleteAccountById(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { id } = await params;

    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);

    if (!householdId) {
      return Response.json({ error: 'Household ID is required' }, { status: 400 });
    }

    const entity = await resolveAndRequireEntity(userId, householdId, request);

    const result = await deleteAccountWithLifecycleEffects({
      id,
      userId,
      householdId,
      entityId: entity.id,
      allowLegacyUnscoped: entity.isDefault,
    });

    return Response.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof AccountLifecycleError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return handleRouteError(error, {
      defaultError: 'Internal server error',
      logLabel: 'Account deletion error:',
    });
  }
}
