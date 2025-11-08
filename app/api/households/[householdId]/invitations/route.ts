import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { householdInvitations, householdMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const INVITATION_EXPIRY_DAYS = 30;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ householdId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { householdId } = await params;

    // Verify user is a member of this household
    const membership = await db
      .select()
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, userId)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      return Response.json(
        { error: 'Not a member of this household' },
        { status: 403 }
      );
    }

    // Get pending invitations
    const invitations = await db
      .select()
      .from(householdInvitations)
      .where(
        and(
          eq(householdInvitations.householdId, householdId),
          eq(householdInvitations.status, 'pending')
        )
      );

    return Response.json(invitations);
  } catch (error) {
    console.error('Invitation fetch error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ householdId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { invitedEmail, role = 'member' } = body;
    const { householdId } = await params;

    if (!invitedEmail) {
      return Response.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Verify user has permission to invite (owner or admin)
    const membership = await db
      .select()
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, userId)
        )
      )
      .limit(1);

    if (
      membership.length === 0 ||
      (membership[0].role !== 'owner' && membership[0].role !== 'admin')
    ) {
      return Response.json(
        { error: 'Not authorized to invite members' },
        { status: 403 }
      );
    }

    // Create invitation
    const invitationId = nanoid();
    const invitationToken = nanoid(32);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

    await db.insert(householdInvitations).values({
      id: invitationId,
      householdId,
      invitedEmail,
      invitedBy: userId,
      role,
      invitationToken,
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
    });

    return Response.json(
      {
        id: invitationId,
        invitationToken,
        message: 'Invitation sent successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Invitation creation error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
