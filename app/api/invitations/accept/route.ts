import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { householdInvitations, householdMembers, userSettings } from '@/lib/db/schema';
import { user as betterAuthUser } from '@/auth-schema';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { userId, email: sessionEmail } = await requireAuth();

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
    if (inv.status !== 'pending' && inv.status !== 'accepted') {
      return Response.json(
        { error: `Invitation has already been ${inv.status}` },
        { status: 400 }
      );
    }

    // Check expiration
    if (inv.status === 'pending' && new Date() > new Date(inv.expiresAt)) {
      return Response.json(
        { error: 'Invitation has expired' },
        { status: 400 }
      );
    }

    // Get user info from Better Auth
    const user = await db
      .select({
        email: betterAuthUser.email,
        name: betterAuthUser.name,
      })
      .from(betterAuthUser)
      .where(eq(betterAuthUser.id, userId))
      .get();

    const userEmail = (user?.email || sessionEmail || '').trim().toLowerCase();
    const invitedEmail = inv.invitedEmail.trim().toLowerCase();
    const userName = user?.name || null;

    if (!userEmail) {
      return Response.json(
        { error: 'Authenticated account is missing an email address' },
        { status: 400 }
      );
    }

    if (userEmail !== invitedEmail) {
      return Response.json(
        { error: 'This invitation is for a different email address' },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();
    const role = inv.role as typeof householdMembers.$inferInsert['role'];

    await db.transaction(async (tx) => {
      // Upsert membership to make accept idempotent for retries.
      const existingMembership = await tx
        .select({
          id: householdMembers.id,
        })
        .from(householdMembers)
        .where(
          and(
            eq(householdMembers.householdId, inv.householdId),
            eq(householdMembers.userId, userId)
          )
        )
        .limit(1);

      if (existingMembership.length > 0) {
        await tx
          .update(householdMembers)
          .set({
            userEmail,
            userName,
            role,
            invitedBy: inv.invitedBy,
            isActive: true,
          })
          .where(
            and(
              eq(householdMembers.householdId, inv.householdId),
              eq(householdMembers.userId, userId)
            )
          );
      } else {
        await tx.insert(householdMembers).values({
          id: nanoid(),
          householdId: inv.householdId,
          userId,
          userEmail,
          userName,
          role,
          joinedAt: now,
          invitedBy: inv.invitedBy,
          isActive: true,
        });
      }

      // Prefer the invited household on first dashboard load.
      const existingSettings = await tx
        .select({
          id: userSettings.id,
        })
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1);

      if (existingSettings.length > 0) {
        await tx
          .update(userSettings)
          .set({
            defaultHouseholdId: inv.householdId,
            updatedAt: now,
          })
          .where(eq(userSettings.userId, userId));
      } else {
        await tx.insert(userSettings).values({
          id: nanoid(),
          userId,
          defaultHouseholdId: inv.householdId,
          onboardingCompleted: false,
          createdAt: now,
          updatedAt: now,
        });
      }

      if (inv.status === 'pending') {
        await tx
          .update(householdInvitations)
          .set({
            status: 'accepted',
            acceptedAt: now,
          })
          .where(eq(householdInvitations.id, inv.id));
      }
    });

    return Response.json({
      message:
        inv.status === 'accepted'
          ? 'Invitation already accepted'
          : 'Invitation accepted successfully',
      householdId: inv.householdId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error accepting invitation:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
