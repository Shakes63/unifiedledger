import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { householdMembers } from '@/lib/db/schema';
import {
  getEffectivePermissions,
  validatePermissionChange,
  type CustomPermissions,
} from '@/lib/household/permissions';
import {
  handleHouseholdRouteError,
  requireActiveHouseholdMember,
  requireHouseholdPermission,
} from '@/lib/household/route-guards';

async function getValidatedMemberForHousehold(memberId: string, householdId: string) {
  const member = await db
    .select()
    .from(householdMembers)
    .where(eq(householdMembers.id, memberId))
    .limit(1);

  if (member.length === 0 || member[0].isActive === false) {
    throw new Error('Member not found');
  }

  if (member[0].householdId !== householdId) {
    throw new Error('Member does not belong to this household');
  }

  return member[0];
}

export async function handleGetMemberPermissions(
  _request: Request,
  householdId: string,
  memberId: string
) {
  try {
    await requireActiveHouseholdMember(householdId);

    const member = await getValidatedMemberForHousehold(memberId, householdId);
    const permissions = await getEffectivePermissions(householdId, member.userId);

    return Response.json(permissions);
  } catch (error) {
    return handleHouseholdRouteError(error, {
      defaultError: 'Internal server error',
      logLabel: 'Error fetching member permissions:',
    });
  }
}

export async function handleUpdateMemberPermissions(
  request: Request,
  householdId: string,
  memberId: string
) {
  try {
    const { userId } = await requireActiveHouseholdMember(householdId);
    await requireHouseholdPermission(
      householdId,
      userId,
      'manage_permissions',
      'Not authorized to manage permissions'
    );

    const body = await request.json();
    const { permissions } = body;

    if (!permissions || typeof permissions !== 'object') {
      return Response.json(
        { error: 'Invalid permissions object' },
        { status: 400 }
      );
    }

    const member = await getValidatedMemberForHousehold(memberId, householdId);
    const customPermissions = permissions as CustomPermissions;

    const validation = await validatePermissionChange(
      householdId,
      member.userId,
      customPermissions
    );

    if (!validation.isValid) {
      return Response.json(
        { error: validation.error || 'Invalid permission changes' },
        { status: 400 }
      );
    }

    const customPermissionsJson =
      Object.keys(customPermissions).length > 0
        ? JSON.stringify(customPermissions)
        : null;

    await db
      .update(householdMembers)
      .set({ customPermissions: customPermissionsJson })
      .where(eq(householdMembers.id, memberId))
      .returning();

    const updatedPermissions = await getEffectivePermissions(
      householdId,
      member.userId
    );

    return Response.json(updatedPermissions);
  } catch (error) {
    return handleHouseholdRouteError(error, {
      defaultError: 'Internal server error',
      logLabel: 'Error updating member permissions:',
    });
  }
}

export async function handleResetMemberPermissions(
  _request: Request,
  householdId: string,
  memberId: string
) {
  try {
    const { userId } = await requireActiveHouseholdMember(householdId);
    await requireHouseholdPermission(
      householdId,
      userId,
      'manage_permissions',
      'Not authorized to manage permissions'
    );

    const member = await getValidatedMemberForHousehold(memberId, householdId);
    if (member.role === 'owner') {
      return Response.json(
        { error: 'Cannot reset permissions for owners' },
        { status: 400 }
      );
    }

    await db
      .update(householdMembers)
      .set({ customPermissions: null })
      .where(eq(householdMembers.id, memberId))
      .returning();

    const updatedPermissions = await getEffectivePermissions(
      householdId,
      member.userId
    );

    return Response.json(updatedPermissions);
  } catch (error) {
    return handleHouseholdRouteError(error, {
      defaultError: 'Internal server error',
      logLabel: 'Error resetting member permissions:',
    });
  }
}
