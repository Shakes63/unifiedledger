import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { householdInvitations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

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

    // Update invitation status
    await db
      .update(householdInvitations)
      .set({
        status: 'declined',
      })
      .where(eq(householdInvitations.id, inv.id));

    return Response.json({ message: 'Invitation declined successfully' });
  } catch (error) {
    console.error('Error declining invitation:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
