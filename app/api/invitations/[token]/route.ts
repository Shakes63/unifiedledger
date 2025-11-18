import { db } from '@/lib/db';
import { householdInvitations, households, betterAuthUser } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/invitations/[token]
 * Get invitation details by token
 * Public endpoint - no authentication required (for invitation links)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return Response.json(
        { error: 'Invitation token is required' },
        { status: 400 }
      );
    }

    // Get invitation
    const invitation = await db
      .select({
        id: householdInvitations.id,
        householdId: householdInvitations.householdId,
        invitedEmail: householdInvitations.invitedEmail,
        invitedBy: householdInvitations.invitedBy,
        role: householdInvitations.role,
        expiresAt: householdInvitations.expiresAt,
        status: householdInvitations.status,
        createdAt: householdInvitations.createdAt,
      })
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

    // Check if expired
    const isExpired = new Date() > new Date(inv.expiresAt);
    if (isExpired && inv.status === 'pending') {
      // Update status to expired
      await db
        .update(householdInvitations)
        .set({ status: 'expired' })
        .where(eq(householdInvitations.id, inv.id));
      
      return Response.json(
        { error: 'Invitation has expired', status: 'expired' },
        { status: 400 }
      );
    }

    // Fetch household name
    const household = await db
      .select({ name: households.name })
      .from(households)
      .where(eq(households.id, inv.householdId))
      .limit(1);

    // Fetch inviter's name
    const inviter = await db
      .select({ name: betterAuthUser.name })
      .from(betterAuthUser)
      .where(eq(betterAuthUser.id, inv.invitedBy))
      .limit(1);

    return Response.json({
      id: inv.id,
      householdId: inv.householdId,
      householdName: household.length > 0 ? household[0].name : null,
      invitedEmail: inv.invitedEmail,
      invitedBy: inv.invitedBy,
      invitedByName: inviter.length > 0 ? inviter[0].name : null,
      role: inv.role,
      expiresAt: inv.expiresAt,
      status: inv.status,
      createdAt: inv.createdAt,
    });
  } catch (error) {
    console.error('[Invitation Details API] Error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


