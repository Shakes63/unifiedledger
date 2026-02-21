import { handleRouteError } from '@/lib/api/route-helpers';
import { requireAuth } from '@/lib/auth-helpers';
import {
  hasPermission as hasHouseholdPermission,
  isMemberOfHousehold,
  type HouseholdPermission,
} from '@/lib/household/permissions';

interface HouseholdRouteErrorOptions {
  defaultError: string;
  logLabel: string;
}

export async function requireActiveHouseholdMember(householdId: string) {
  const { userId } = await requireAuth();
  const isMember = await isMemberOfHousehold(householdId, userId);
  if (!isMember) {
    throw new Error('Not a member of this household');
  }

  return {
    userId,
  };
}

export async function requireHouseholdPermission(
  householdId: string,
  userId: string,
  permission: HouseholdPermission,
  deniedMessage = 'Not authorized to perform this action'
) {
  const allowed = await hasHouseholdPermission(householdId, userId, permission);
  if (!allowed) {
    throw new Error(deniedMessage);
  }
}

export function handleHouseholdRouteError(
  error: unknown,
  { defaultError, logLabel }: HouseholdRouteErrorOptions
) {
  if (
    error instanceof Error &&
    (error.message === 'Unauthorized: Not a member of this household' ||
      error.message === 'Not a member of this household')
  ) {
    return Response.json({ error: 'Not a member of this household' }, { status: 403 });
  }

  if (error instanceof Error && error.message.startsWith('Not authorized')) {
    return Response.json({ error: error.message }, { status: 403 });
  }

  if (
    error instanceof Error &&
    error.message.startsWith('Only household owners and admins can')
  ) {
    return Response.json({ error: error.message }, { status: 403 });
  }

  if (error instanceof Error && error.message === 'Member does not belong to this household') {
    return Response.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof Error && error.message === 'Member not found') {
    return Response.json({ error: error.message }, { status: 404 });
  }

  return handleRouteError(error, {
    defaultError,
    logLabel,
  });
}
