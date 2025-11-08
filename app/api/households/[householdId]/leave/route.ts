import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { householdMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { hasPermission } from '@/lib/household/permissions';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ householdId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { householdId } = await params;

    // Check permission to leave
    const canLeave = await hasPermission(householdId, userId, 'leave_household');
    if (!canLeave) {
      return Response.json(
        { error: 'Owners cannot leave the household' },
        { status: 403 }
      );
    }

    // Get member
    const member = await db
      .select()
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, userId)
        )
      )
      .limit(1);

    if (member.length === 0) {
      return Response.json(
        { error: 'Not a member of this household' },
        { status: 404 }
      );
    }

    // Remove member
    await db
      .delete(householdMembers)
      .where(eq(householdMembers.id, member[0].id));

    return Response.json({ message: 'Successfully left household' });
  } catch (error) {
    console.error('Error leaving household:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
