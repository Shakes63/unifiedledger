import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { householdMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { hasPermission } from '@/lib/household/permissions';

export const dynamic = 'force-dynamic';

const ROLE_RANK: Record<string, number> = { owner: 3, admin: 2, member: 1, viewer: 0 };

function roleRank(role: string | null | undefined): number {
  return ROLE_RANK[String(role)] ?? -1;
}

/**
 * Load a member and confirm it belongs to this household (audit finding H-SEC-2:
 * both handlers previously looked the member up by id only, so an admin of one
 * household could pass a memberId from another and delete/re-role them).
 */
async function loadMemberInHousehold(memberId: string, householdId: string) {
  const [member] = await db
    .select()
    .from(householdMembers)
    .where(
      and(
        eq(householdMembers.id, memberId),
        eq(householdMembers.householdId, householdId)
      )
    )
    .limit(1);
  return member ?? null;
}

/** The active role of the acting user within the household, or null if not a member. */
async function getActorRole(householdId: string, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ role: householdMembers.role })
    .from(householdMembers)
    .where(
      and(
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.userId, userId),
        eq(householdMembers.isActive, true)
      )
    )
    .limit(1);
  return row?.role ?? null;
}

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

    // Get member to remove — scoped to this household (H-SEC-2).
    const member = await loadMemberInHousehold(memberId, householdId);

    if (!member) {
      return Response.json({ error: 'Member not found' }, { status: 404 });
    }

    // A member may not remove someone who outranks them (H-SEC-2).
    const actorRole = await getActorRole(householdId, userId);
    if (roleRank(actorRole) < roleRank(member.role)) {
      return Response.json(
        { error: 'You cannot remove a member with a higher role than yours' },
        { status: 403 }
      );
    }

    // Prevent removing owner if they are the only owner
    if (member.role === 'owner') {
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

    // Remove member (scoped to this household).
    await db
      .delete(householdMembers)
      .where(
        and(
          eq(householdMembers.id, memberId),
          eq(householdMembers.householdId, householdId)
        )
      );

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

    // Get member — scoped to this household (H-SEC-2).
    const member = await loadMemberInHousehold(memberId, householdId);

    if (!member) {
      return Response.json({ error: 'Member not found' }, { status: 404 });
    }

    // Role ceiling (H-SEC-2): the actor cannot grant a role above their own, nor
    // modify a member who already outranks them — so an admin cannot mint owners.
    const actorRole = await getActorRole(householdId, userId);
    const actorRank = roleRank(actorRole);
    if (actorRank < roleRank(role) || actorRank < roleRank(member.role)) {
      return Response.json(
        { error: 'You cannot assign a role higher than your own' },
        { status: 403 }
      );
    }

    // Prevent demoting the last owner
    if (member.role === 'owner' && role !== 'owner') {
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

    // Update role (scoped to this household).
    const result = await db
      .update(householdMembers)
      .set({ role: role as typeof householdMembers.$inferInsert['role'] })
      .where(
        and(
          eq(householdMembers.id, memberId),
          eq(householdMembers.householdId, householdId)
        )
      )
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
