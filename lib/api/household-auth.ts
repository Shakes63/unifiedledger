/**
 * Household Authorization Helper Utilities
 *
 * Provides helper functions for API routes to:
 * 1. Extract household ID from requests
 * 2. Verify user is a member of the household
 * 3. Check role-based permissions
 *
 * Usage in API routes:
 * ```typescript
 * import { requireHouseholdAuth, getHouseholdIdFromRequest } from '@/lib/api/household-auth';
 *
 * export async function GET(request: Request) {
 *   const { userId } = await requireAuth();
 *   const householdId = getHouseholdIdFromRequest(request);
 *   await requireHouseholdAuth(userId, householdId);
 *   // ... proceed with household-filtered query
 * }
 * ```
 */

import { db } from '@/lib/db';
import { householdMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Extracts household ID from request headers or body
 *
 * Priority:
 * 1. x-household-id header (for GET requests)
 * 2. householdId in request body (for POST/PUT/DELETE requests)
 *
 * @param request - The incoming HTTP request
 * @param body - Optional parsed request body
 * @returns The household ID or null if not found
 */
export function getHouseholdIdFromRequest(
  request: Request,
  body?: { householdId?: string }
): string | null {
  // Try header first (for GET requests)
  const headerHouseholdId = request.headers.get('x-household-id');
  if (headerHouseholdId) return headerHouseholdId;

  // Try body (for POST/PUT/DELETE requests)
  if (body?.householdId) return body.householdId;

  return null;
}

/**
 * Verifies user is an active member of the household
 * Throws error if:
 * - Household ID is missing
 * - User is not a member of the household
 * - User's membership is inactive
 *
 * @param userId - The authenticated user's ID
 * @param householdId - The household ID to check
 * @returns The household membership record if authorized
 * @throws Error if unauthorized or household ID is missing
 */
export async function requireHouseholdAuth(
  userId: string,
  householdId: string | null
) {
  if (!householdId) {
    throw new Error('Household ID is required');
  }

  const membership = await db
    .select()
    .from(householdMembers)
    .where(
      and(
        eq(householdMembers.userId, userId),
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.isActive, true)
      )
    )
    .get();

  if (!membership) {
    throw new Error('Unauthorized: Not a member of this household');
  }

  return membership;
}

/**
 * Checks if user has specific role permission in household
 *
 * Role hierarchy:
 * - owner: 3 (highest)
 * - admin: 2
 * - member: 1
 * - viewer: 0 (lowest)
 *
 * @param membership - The household membership record
 * @param requiredRole - The minimum role required
 * @returns true if user has required permission level or higher
 */
export function hasPermission(
  membership: { role: string },
  requiredRole: 'owner' | 'admin' | 'member' | 'viewer'
): boolean {
  const roleHierarchy: Record<string, number> = {
    owner: 3,
    admin: 2,
    member: 1,
    viewer: 0,
  };

  const userLevel = roleHierarchy[membership.role] || 0;
  const requiredLevel = roleHierarchy[requiredRole];

  return userLevel >= requiredLevel;
}

/**
 * Requires user to have specific role permission
 * Convenience function that combines membership check with permission check
 *
 * @param userId - The authenticated user's ID
 * @param householdId - The household ID to check
 * @param requiredRole - The minimum role required
 * @returns The household membership record if authorized
 * @throws Error if unauthorized or insufficient permissions
 */
export async function requireHouseholdRole(
  userId: string,
  householdId: string | null,
  requiredRole: 'owner' | 'admin' | 'member' | 'viewer' = 'member'
) {
  const membership = await requireHouseholdAuth(userId, householdId);

  if (!hasPermission(membership, requiredRole)) {
    throw new Error(`Unauthorized: Requires ${requiredRole} role or higher`);
  }

  return membership;
}

/**
 * Extracts household ID and verifies authorization in one call
 * Convenience function for common pattern in API routes
 *
 * @param request - The incoming HTTP request
 * @param userId - The authenticated user's ID
 * @param body - Optional parsed request body
 * @returns Object with householdId and membership
 * @throws Error if household ID missing or user not authorized
 *
 * @example
 * ```typescript
 * export async function POST(request: Request) {
 *   const { userId } = await requireAuth();
 *   const body = await request.json();
 *   const { householdId, membership } = await getAndVerifyHousehold(request, userId, body);
 *   // ... proceed with household-filtered logic
 * }
 * ```
 */
export async function getAndVerifyHousehold(
  request: Request,
  userId: string,
  body?: { householdId?: string }
) {
  const householdId = getHouseholdIdFromRequest(request, body);
  const membership = await requireHouseholdAuth(userId, householdId);

  return {
    householdId: householdId!,
    membership,
  };
}
