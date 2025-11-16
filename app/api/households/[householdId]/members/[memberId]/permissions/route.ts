import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { householdMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  hasPermission,
  getEffectivePermissions,
  validatePermissionChange,
  isMemberOfHousehold,
  type CustomPermissions,
} from '@/lib/household/permissions';

export const dynamic = 'force-dynamic';

/**
 * GET /api/households/[householdId]/members/[memberId]/permissions
 * Get member permissions (role-based, custom, and effective)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ householdId: string; memberId: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { householdId, memberId } = await params;

    // Verify requester is a member of the household
    if (!(await isMemberOfHousehold(householdId, userId))) {
      return Response.json(
        { error: 'Not a member of this household' },
        { status: 403 }
      );
    }

    // Get member record
    const member = await db
      .select()
      .from(householdMembers)
      .where(eq(householdMembers.id, memberId))
      .limit(1);

    if (member.length === 0) {
      return Response.json({ error: 'Member not found' }, { status: 404 });
    }

    // Verify member belongs to this household
    if (member[0].householdId !== householdId) {
      return Response.json(
        { error: 'Member does not belong to this household' },
        { status: 400 }
      );
    }

    // Get effective permissions
    const permissions = await getEffectivePermissions(
      householdId,
      member[0].userId
    );

    return Response.json(permissions);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching member permissions:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/households/[householdId]/members/[memberId]/permissions
 * Update custom permissions for a member
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ householdId: string; memberId: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { householdId, memberId } = await params;
    const body = await request.json();
    const { permissions } = body;

    // Validate request body
    if (!permissions || typeof permissions !== 'object') {
      return Response.json(
        { error: 'Invalid permissions object' },
        { status: 400 }
      );
    }

    // Check requester has manage_permissions
    const canManage = await hasPermission(householdId, userId, 'manage_permissions');
    if (!canManage) {
      return Response.json(
        { error: 'Not authorized to manage permissions' },
        { status: 403 }
      );
    }

    // Get member record
    const member = await db
      .select()
      .from(householdMembers)
      .where(eq(householdMembers.id, memberId))
      .limit(1);

    if (member.length === 0) {
      return Response.json({ error: 'Member not found' }, { status: 404 });
    }

    // Verify member belongs to this household
    if (member[0].householdId !== householdId) {
      return Response.json(
        { error: 'Member does not belong to this household' },
        { status: 400 }
      );
    }

    // Validate permission changes
    const customPermissions = permissions as CustomPermissions;
    const validation = await validatePermissionChange(
      householdId,
      member[0].userId,
      customPermissions
    );

    if (!validation.isValid) {
      return Response.json(
        { error: validation.error || 'Invalid permission changes' },
        { status: 400 }
      );
    }

    // Update custom permissions
    // Store as JSON string, or null if empty object
    const customPermissionsJson =
      Object.keys(customPermissions).length > 0
        ? JSON.stringify(customPermissions)
        : null;

    const result = await db
      .update(householdMembers)
      .set({ customPermissions: customPermissionsJson })
      .where(eq(householdMembers.id, memberId))
      .returning();

    // Get updated effective permissions
    const updatedPermissions = await getEffectivePermissions(
      householdId,
      member[0].userId
    );

    return Response.json(updatedPermissions);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error updating member permissions:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/households/[householdId]/members/[memberId]/permissions
 * Reset custom permissions to role defaults
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ householdId: string; memberId: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { householdId, memberId } = await params;

    // Check requester has manage_permissions
    const canManage = await hasPermission(householdId, userId, 'manage_permissions');
    if (!canManage) {
      return Response.json(
        { error: 'Not authorized to manage permissions' },
        { status: 403 }
      );
    }

    // Get member record
    const member = await db
      .select()
      .from(householdMembers)
      .where(eq(householdMembers.id, memberId))
      .limit(1);

    if (member.length === 0) {
      return Response.json({ error: 'Member not found' }, { status: 404 });
    }

    // Verify member belongs to this household
    if (member[0].householdId !== householdId) {
      return Response.json(
        { error: 'Member does not belong to this household' },
        { status: 400 }
      );
    }

    // Validate that we're not resetting owner permissions
    if (member[0].role === 'owner') {
      return Response.json(
        { error: 'Cannot reset permissions for owners' },
        { status: 400 }
      );
    }

    // Reset custom permissions to null
    const result = await db
      .update(householdMembers)
      .set({ customPermissions: null })
      .where(eq(householdMembers.id, memberId))
      .returning();

    // Get updated effective permissions (should match role defaults)
    const updatedPermissions = await getEffectivePermissions(
      householdId,
      member[0].userId
    );

    return Response.json(updatedPermissions);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error resetting member permissions:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

