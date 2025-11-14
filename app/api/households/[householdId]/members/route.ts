import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { householdMembers } from '@/lib/db/schema';
import { user as betterAuthUser } from '@/auth-schema';
import { eq, and } from 'drizzle-orm';
import { hasPermission, isMemberOfHousehold } from '@/lib/household/permissions';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ householdId: string }> }
) {
  try {
    const { userId } = await requireAuth();

    const { householdId } = await params;

    // Verify user is a member
    if (!(await isMemberOfHousehold(householdId, userId))) {
      return Response.json(
        { error: 'Not a member of this household' },
        { status: 403 }
      );
    }

    // Get all members with avatar URLs
    const members = await db
      .select({
        id: householdMembers.id,
        userId: householdMembers.userId,
        userEmail: householdMembers.userEmail,
        userName: householdMembers.userName,
        userAvatarUrl: betterAuthUser.image,
        role: householdMembers.role,
        joinedAt: householdMembers.joinedAt,
        invitedBy: householdMembers.invitedBy,
        isActive: householdMembers.isActive,
      })
      .from(householdMembers)
      .leftJoin(betterAuthUser, eq(householdMembers.userId, betterAuthUser.id))
      .where(eq(householdMembers.householdId, householdId));

    // Backfill missing userNames from Better Auth
    const updatedMembers = await Promise.all(
      members.map(async (member) => {
        // If userName is missing or empty, fetch from Better Auth
        if (!member.userName || member.userName.trim() === '') {
          try {
            const user = await db
              .select()
              .from(betterAuthUser)
              .where(eq(betterAuthUser.id, member.userId))
              .get();

            const userName = user?.name || user?.email || '';

            if (userName) {
              // Update in database
              await db
                .update(householdMembers)
                .set({ userName })
                .where(eq(householdMembers.id, member.id));

              // Return updated member
              return { ...member, userName };
            }
          } catch (error) {
            console.error(`Failed to fetch user info for ${member.userId}:`, error);
          }
        }
        return member;
      })
    );

    return Response.json(updatedMembers);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching members:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
