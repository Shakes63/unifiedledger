import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { householdMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { hasPermission, isMemberOfHousehold } from '@/lib/household/permissions';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ householdId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { householdId } = await params;

    // Verify user is a member
    if (!(await isMemberOfHousehold(householdId, userId))) {
      return Response.json(
        { error: 'Not a member of this household' },
        { status: 403 }
      );
    }

    // Get all members
    const members = await db
      .select({
        id: householdMembers.id,
        userId: householdMembers.userId,
        userEmail: householdMembers.userEmail,
        userName: householdMembers.userName,
        role: householdMembers.role,
        joinedAt: householdMembers.joinedAt,
        invitedBy: householdMembers.invitedBy,
        isActive: householdMembers.isActive,
      })
      .from(householdMembers)
      .where(eq(householdMembers.householdId, householdId));

    return Response.json(members);
  } catch (error) {
    console.error('Error fetching members:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
