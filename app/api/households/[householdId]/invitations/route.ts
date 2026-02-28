import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { householdInvitations, householdMembers, households, betterAuthUser } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { sendInvitationEmail } from '@/lib/email/email-service';
export const dynamic = 'force-dynamic';

const INVITATION_EXPIRY_DAYS = 30;

/**
 * Get the base URL from the request headers (for self-hosted environments)
 * This allows invitation emails to use the correct URL regardless of
 * how the app is accessed (IP, hostname, port, etc.)
 */
function getBaseUrlFromRequest(request: Request): string {
  const requestUrl = new URL(request.url);
  // Try to get from X-Forwarded headers (when behind a proxy)
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');
  
  // Use forwarded host first, then Host header, then URL host.
  const host = forwardedHost || request.headers.get('host') || requestUrl.host;
  
  if (host) {
    // Use proxy protocol first, then request URL protocol.
    const proto = forwardedProto || requestUrl.protocol.replace(':', '');
    return `${proto}://${host}`;
  }

  throw new Error('Unable to determine request host for invitation URL');
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ householdId: string }> }
) {
  try {
    const { userId } = await requireAuth();

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
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
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
    const { userId } = await requireAuth();

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

    // Send invitation email (non-blocking - don't fail if email fails)
    try {
      // Fetch household name
      const household = await db
        .select({ name: households.name })
        .from(households)
        .where(eq(households.id, householdId))
        .limit(1);

      // Fetch inviter's name
      const inviter = await db
        .select({ name: betterAuthUser.name })
        .from(betterAuthUser)
        .where(eq(betterAuthUser.id, userId))
        .limit(1);

      if (household.length > 0 && inviter.length > 0) {
        const baseUrl = getBaseUrlFromRequest(request);
        const invitationUrl = `${baseUrl}/invite/${invitationToken}`;

        await sendInvitationEmail({
          to: invitedEmail,
          invitedBy: inviter[0].name,
          householdName: household[0].name,
          invitationUrl,
          role,
        });
      }
    } catch (emailError) {
      // Log error but don't fail the invitation creation
      console.error('[Invitation API] Failed to send invitation email:', emailError);
      // Continue - invitation was created successfully even if email failed
    }

    return Response.json(
      {
        id: invitationId,
        invitationToken,
        message: 'Invitation sent successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Invitation creation error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
