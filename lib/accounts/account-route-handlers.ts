import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { handleRouteError } from '@/lib/api/route-helpers';
import { resolveAndRequireEntity } from '@/lib/api/entity-auth';
import { db } from '@/lib/db';
import { accounts } from '@/lib/db/schema';
import { AccountLifecycleError, createAccountWithLifecycleEffects } from '@/lib/accounts/account-lifecycle-service';

export const dynamic = 'force-dynamic';

export async function handleListAccounts(request: Request) {
  try {
    const { userId } = await requireAuth();
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);

    if (!householdId) {
      return Response.json({ error: 'Household ID is required' }, { status: 400 });
    }

    const entity = await resolveAndRequireEntity(userId, householdId, request);
    const entityScope = entity.isDefault
      ? or(eq(accounts.entityId, entity.id), isNull(accounts.entityId))
      : eq(accounts.entityId, entity.id);

    const userAccounts = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.householdId, householdId),
          entityScope
        )
      )
      .orderBy(desc(accounts.usageCount), accounts.sortOrder);

    return Response.json(userAccounts);
  } catch (error) {
    return handleRouteError(error, {
      defaultError: 'Internal server error',
      logLabel: 'Account fetch error:',
    });
  }
}

export async function handleCreateAccount(request: Request) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const householdId = getHouseholdIdFromRequest(request, body);
    await requireHouseholdAuth(userId, householdId);

    if (!householdId) {
      return Response.json({ error: 'Household ID is required' }, { status: 400 });
    }

    const entity = await resolveAndRequireEntity(userId, householdId, request, body);

    const result = await createAccountWithLifecycleEffects({
      userId,
      householdId,
      entityId: entity.id,
      body,
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AccountLifecycleError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return handleRouteError(error, {
      defaultError: 'Internal server error',
      logLabel: 'Account creation error:',
    });
  }
}
