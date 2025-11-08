import { auth, clerkClient } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { householdInvitations, householdMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { token } = body;

    if (!token) {
      return Response.json(
        { error: 'Invitation token is required' },
        { status: 400 }
      );
    }

    // Get invitation
    const invitation = await db
      .select()
      .from(householdInvitations)
      .where(eq(householdInvitations.invitationToken, token))
      .limit(1);

    if (invitation.length === 0) {
      return Response.json(
        { error: 'Invalid invitation token' },
        { status: 404 }
      );
    }

    const inv = invitation[0];

    // Check status
    if (inv.status !== 'pending') {
      return Response.json(
        { error: `Invitation has already been ${inv.status}` },
        { status: 400 }
      );
    }

    // Check expiration
    if (new Date() > new Date(inv.expiresAt)) {
      return Response.json(
        { error: 'Invitation has expired' },
        { status: 400 }
      );
    }

    // Get user info from Clerk
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const userName = user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.firstName || user.username || '';

    // Add user to household
    const memberId = nanoid();
    await db.insert(householdMembers).values({
      id: memberId,
      householdId: inv.householdId,
      userId,
      userEmail: inv.invitedEmail,
      userName: userName || null,
      role: inv.role as any,
      joinedAt: new Date().toISOString(),
      invitedBy: inv.invitedBy,
    });

    // Update invitation status
    await db
      .update(householdInvitations)
      .set({
        status: 'accepted',
        acceptedAt: new Date().toISOString(),
      })
      .where(eq(householdInvitations.id, inv.id));

    return Response.json({
      message: 'Invitation accepted successfully',
      householdId: inv.householdId,
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
