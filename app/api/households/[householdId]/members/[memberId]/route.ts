import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { householdMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { hasPermission } from '@/lib/household/permissions';
import type { HouseholdRole } from '@/lib/household/permissions';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ householdId: string; memberId: string }> }
) {
  try {
    const { userId } = await requireAuth();

    const { householdId, memberId } = await params;

    // Check permission to remove members
    const canRemove = await hasPermission(householdId, userId, 'remove_members');
    if (!canRemove) {
      return Response.json(
        { error: 'Not authorized to remove members' },
        { status: 403 }
      );
    }

    // Get member to remove
    const member = await db
      .select()
      .from(householdMembers)
      .where(eq(householdMembers.id, memberId))
      .limit(1);

    if (member.length === 0) {
      return Response.json({ error: 'Member not found' }, { status: 404 });
    }

    // Prevent removing owner if they are the only owner
    if (member[0].role === 'owner') {
      const ownerCount = await db
        .select()
        .from(householdMembers)
        .where(
          and(
            eq(householdMembers.householdId, householdId),
            eq(householdMembers.role, 'owner')
          )
        );

      if (ownerCount.length === 1) {
        return Response.json(
          { error: 'Cannot remove the last owner of the household' },
          { status: 400 }
        );
      }
    }

    // Remove member
    await db.delete(householdMembers).where(eq(householdMembers.id, memberId));

    return Response.json({ message: 'Member removed successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error removing member:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ householdId: string; memberId: string }> }
) {
  try {
    const { userId } = await requireAuth();

    const { householdId, memberId } = await params;
    const body = await request.json();
    const { role } = body;

    if (!role || !['owner', 'admin', 'member', 'viewer'].includes(role)) {
      return Response.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    // Check permission to manage permissions
    const canManage = await hasPermission(householdId, userId, 'manage_permissions');
    if (!canManage) {
      return Response.json(
        { error: 'Not authorized to manage member roles' },
        { status: 403 }
      );
    }

    // Get member
    const member = await db
      .select()
      .from(householdMembers)
      .where(eq(householdMembers.id, memberId))
      .limit(1);

    if (member.length === 0) {
      return Response.json({ error: 'Member not found' }, { status: 404 });
    }

    // Prevent demoting the last owner
    if (member[0].role === 'owner' && role !== 'owner') {
      const ownerCount = await db
        .select()
        .from(householdMembers)
        .where(
          and(
            eq(householdMembers.householdId, householdId),
            eq(householdMembers.role, 'owner')
          )
        );

      if (ownerCount.length === 1) {
        return Response.json(
          { error: 'Cannot demote the last owner' },
          { status: 400 }
        );
      }
    }

    // Update role
    const result = await db
      .update(householdMembers)
      .set({ role: role as any })
      .where(eq(householdMembers.id, memberId))
      .returning();

    return Response.json(result[0]);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error updating member role:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
