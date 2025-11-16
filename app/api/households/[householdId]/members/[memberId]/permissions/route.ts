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
 * 
 * Get member permissions including role-based, custom overrides, and effective permissions.
 * 
 * **Authorization:**
 * - User must be authenticated
 * - User must be a member of the household (any role can view)
 * 
 * **Response:**
 * - 200: Returns permissions object with role, rolePermissions, customPermissions, and effectivePermissions
 * - 401: Unauthorized (not authenticated)
 * - 403: Forbidden (not a member of household)
 * - 404: Member not found
 * - 400: Bad request (member belongs to different household)
 * 
 * @param request - The HTTP request object
 * @param params - Route parameters containing householdId and memberId
 * @returns JSON response with permissions or error message
 * 
 * @example
 * ```typescript
 * // Response (200 OK):
 * {
 *   role: 'admin',
 *   rolePermissions: { create_accounts: true, ... },
 *   customPermissions: { create_accounts: false } | null,
 *   effectivePermissions: { create_accounts: false, ... }
 * }
 * ```
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
 * 
 * Update custom permissions for a household member.
 * 
 * **Authorization:**
 * - User must be authenticated
 * - User must have `manage_permissions` permission
 * 
 * **Request Body:**
 * ```typescript
 * {
 *   permissions: {
 *     "permission_name": true | false
 *   }
 * }
 * ```
 * 
 * **Validation:**
 * - Cannot modify permissions for owners
 * - Cannot remove `manage_permissions` from the last admin
 * - Permission names must be valid
 * - Empty object resets to role defaults (sets customPermissions to null)
 * 
 * **Response:**
 * - 200: Returns updated permissions object
 * - 401: Unauthorized (not authenticated)
 * - 403: Forbidden (lacks manage_permissions)
 * - 404: Member not found
 * - 400: Bad request (validation error, invalid body, etc.)
 * 
 * @param request - The HTTP request object with JSON body containing permissions
 * @param params - Route parameters containing householdId and memberId
 * @returns JSON response with updated permissions or error message
 * 
 * @example
 * ```typescript
 * // Request body:
 * {
 *   permissions: {
 *     create_accounts: false,
 *     edit_accounts: true
 *   }
 * }
 * 
 * // Response (200 OK):
 * {
 *   role: 'admin',
 *   rolePermissions: { create_accounts: true, ... },
 *   customPermissions: { create_accounts: false, edit_accounts: true },
 *   effectivePermissions: { create_accounts: false, edit_accounts: true, ... }
 * }
 * ```
 * 
 * @remarks
 * Custom permissions override role defaults. Deny takes precedence over allow.
 * If a permission is set to `false`, it denies access even if the role allows it.
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
 * 
 * Reset custom permissions to role defaults (removes all custom overrides).
 * 
 * **Authorization:**
 * - User must be authenticated
 * - User must have `manage_permissions` permission
 * 
 * **Validation:**
 * - Cannot reset permissions for owners
 * 
 * **Response:**
 * - 200: Returns updated permissions object (now matching role defaults)
 * - 401: Unauthorized (not authenticated)
 * - 403: Forbidden (lacks manage_permissions)
 * - 404: Member not found
 * - 400: Bad request (cannot reset owner permissions, etc.)
 * 
 * @param request - The HTTP request object
 * @param params - Route parameters containing householdId and memberId
 * @returns JSON response with updated permissions (role defaults) or error message
 * 
 * @example
 * ```typescript
 * // Response (200 OK):
 * {
 *   role: 'admin',
 *   rolePermissions: { create_accounts: true, ... },
 *   customPermissions: null, // Reset to null
 *   effectivePermissions: { create_accounts: true, ... } // Now matches role defaults
 * }
 * ```
 * 
 * @remarks
 * This endpoint sets `customPermissions` to `null` in the database, effectively
 * removing all custom overrides and reverting to role-based permissions only.
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

