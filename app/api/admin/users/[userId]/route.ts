import { requireOwner } from '@/lib/auth/owner-helpers';
import { db } from '@/lib/db';
import { betterAuthUser, householdMembers, households } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/admin/users/[userId]
 * Update user details (owner only)
 * Request body: { name?, email?, householdId?, role? }
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Verify owner access
    const { userId: ownerId } = await requireOwner();

    const { userId } = await params;
    const body = await request.json();
    const { name, email, householdId, role } = body;

    // Check if user exists
    const user = await db
      .select({ id: betterAuthUser.id, email: betterAuthUser.email })
      .from(betterAuthUser)
      .where(eq(betterAuthUser.id, userId))
      .limit(1);

    if (user.length === 0) {
      return Response.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Prevent updating the owner account
    const ownerCheck = await db
      .select({ isApplicationOwner: betterAuthUser.isApplicationOwner })
      .from(betterAuthUser)
      .where(eq(betterAuthUser.id, userId))
      .limit(1);

    if (ownerCheck[0]?.isApplicationOwner === true) {
      return Response.json(
        { error: 'Cannot modify the application owner account' },
        { status: 403 }
      );
    }

    // Update user name if provided
    if (name !== undefined) {
      await db
        .update(betterAuthUser)
        .set({ name })
        .where(eq(betterAuthUser.id, userId));
    }

    // Update email if provided
    if (email !== undefined) {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return Response.json(
          { error: 'Invalid email format' },
          { status: 400 }
        );
      }

      // Check if email already exists (excluding current user)
      const existingUser = await db
        .select({ id: betterAuthUser.id })
        .from(betterAuthUser)
        .where(eq(betterAuthUser.email, email.toLowerCase()))
        .limit(1);

      if (existingUser.length > 0 && existingUser[0].id !== userId) {
        return Response.json(
          { error: 'Email already exists' },
          { status: 409 }
        );
      }

      // Note: Better Auth handles email updates through its own API
      // For now, we'll update the database directly
      // In production, you might want to use Better Auth's email update API
      await db
        .update(betterAuthUser)
        .set({ email: email.toLowerCase() })
        .where(eq(betterAuthUser.id, userId));
    }

    // Handle household assignment if provided
    if (householdId !== undefined) {
      if (householdId === null) {
        // Remove from all households (if needed)
        // For now, we'll leave this as a no-op - you might want to implement removal logic
      } else {
        // Validate household exists
        const household = await db
          .select({ id: households.id })
          .from(households)
          .where(eq(households.id, householdId))
          .limit(1);

        if (household.length === 0) {
          return Response.json(
            { error: 'Household not found' },
            { status: 404 }
          );
        }

        // Validate role if provided
        if (role) {
          const validRoles = ['owner', 'admin', 'member', 'viewer'];
          if (!validRoles.includes(role)) {
            return Response.json(
              { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
              { status: 400 }
            );
          }
        }

        // Check if user is already a member
        const existingMember = await db
          .select({ id: householdMembers.id, role: householdMembers.role })
          .from(householdMembers)
          .where(
            and(
              eq(householdMembers.householdId, householdId),
              eq(householdMembers.userId, userId)
            )
          )
          .limit(1);

        if (existingMember.length > 0) {
          // Update role if provided
          if (role && existingMember[0].role !== role) {
            await db
              .update(householdMembers)
              .set({ role: role as 'owner' | 'admin' | 'member' | 'viewer' })
              .where(eq(householdMembers.id, existingMember[0].id));
          }
        } else {
          // Add user to household
          await db.insert(householdMembers).values({
            id: nanoid(),
            householdId,
            userId,
            userEmail: user[0].email,
            userName: name || null,
            role: (role || 'member') as 'owner' | 'admin' | 'member' | 'viewer',
            joinedAt: new Date().toISOString(),
            invitedBy: ownerId,
          });
        }
      }
    }

    // Fetch updated user
    const updatedUser = await db
      .select({
        id: betterAuthUser.id,
        email: betterAuthUser.email,
        name: betterAuthUser.name,
        createdAt: betterAuthUser.createdAt,
      })
      .from(betterAuthUser)
      .where(eq(betterAuthUser.id, userId))
      .limit(1);

    return Response.json({
      ...updatedUser[0],
      message: 'User updated successfully',
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message.includes('Forbidden') || error.message.includes('Owner')) {
        return Response.json(
          { error: 'Forbidden: Owner access required' },
          { status: 403 }
        );
      }
    }
    console.error('[Admin Users API] Error updating user:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users/[userId]
 * Delete user account (owner only)
 * Prevents deleting the owner account
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Verify owner access
    await requireOwner();

    const { userId } = await params;

    // Check if user exists
    const user = await db
      .select({ id: betterAuthUser.id, isApplicationOwner: betterAuthUser.isApplicationOwner })
      .from(betterAuthUser)
      .where(eq(betterAuthUser.id, userId))
      .limit(1);

    if (user.length === 0) {
      return Response.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Prevent deleting the owner account
    if (user[0].isApplicationOwner === true) {
      return Response.json(
        { error: 'Cannot delete the application owner account' },
        { status: 403 }
      );
    }

    // Delete household memberships (cascade should handle this, but we'll do it explicitly)
    await db
      .delete(householdMembers)
      .where(eq(householdMembers.userId, userId));

    // Note: Better Auth handles user deletion through its own API
    // For now, we'll delete from the database directly
    // In production, you might want to use Better Auth's user deletion API
    await db
      .delete(betterAuthUser)
      .where(eq(betterAuthUser.id, userId));

    return Response.json({
      message: 'User deleted successfully',
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message.includes('Forbidden') || error.message.includes('Owner')) {
        return Response.json(
          { error: 'Forbidden: Owner access required' },
          { status: 403 }
        );
      }
    }
    console.error('[Admin Users API] Error deleting user:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


