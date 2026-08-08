import { db } from '@/lib/db';
import { calendarConnections, calendarSyncSettings } from '@/lib/db/schema';
import {
  exchangeTickTickCodeForTokens,
  listTickTickProjects,
  createTickTickProject,
} from '@/lib/calendar/ticktick-calendar';
import { encryptToken } from '@/lib/encryption/oauth-encryption';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { v4 as uuidv4 } from 'uuid';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/calendar-sync/ticktick/callback
 * Handles the OAuth callback from TickTick.
 * Query params: code, state, error (optional)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  const settingsUrl = `${baseUrl}/dashboard/settings`;
  const fail = (reason: string) =>
    `${settingsUrl}?tab=data&calendarError=${encodeURIComponent(reason)}`;

  // A redirect target is computed inside a try, then issued OUTSIDE it —
  // next/navigation redirect() throws NEXT_REDIRECT, and issuing it inside the
  // try let the catch swallow the SUCCESS redirect and send every completed
  // connection to an error page (bug-hunt finding SY3).
  let redirectTo: string;

  try {
    if (error) {
      console.error('TickTick OAuth error:', error);
      redirect(fail(error));
    }
    if (!code || !state) {
      redirect(fail('missing_params'));
    }

    // Identity comes from the SESSION, never from the state cookie (bug-hunt
    // finding SEC1): the callback previously trusted client-controlled
    // userId/householdId out of the cookie with no auth check, letting an
    // attacker bind their TickTick account to a victim's household. The cookie
    // is used ONLY for CSRF state matching now.
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const cookieStore = await cookies();
    const stateDataStr = cookieStore.get('ticktick_oauth_state')?.value;
    if (!stateDataStr) {
      redirect(fail('state_expired'));
    }

    const stateData = JSON.parse(stateDataStr as string);
    if (stateData.state !== state) {
      redirect(fail('state_mismatch'));
    }
    // The cookie was issued to THIS session (connect route sets it after
    // requireAuth) — reject a state cookie minted for a different user.
    if (stateData.userId && stateData.userId !== userId) {
      redirect(fail('state_mismatch'));
    }

    cookieStore.delete('ticktick_oauth_state');

    const tokens = await exchangeTickTickCodeForTokens(code as string);

    const existing = await db
      .select()
      .from(calendarConnections)
      .where(
        and(
          eq(calendarConnections.userId, userId),
          eq(calendarConnections.householdId, householdId),
          eq(calendarConnections.provider, 'ticktick')
        )
      )
      .limit(1);

    const connectionId = existing[0]?.id ?? uuidv4();

    if (existing[0]) {
      await db
        .update(calendarConnections)
        .set({
          accessToken: encryptToken(tokens.accessToken),
          refreshToken: tokens.refreshToken
            ? encryptToken(tokens.refreshToken)
            : existing[0].refreshToken,
          tokenExpiresAt: tokens.expiresAt,
          isActive: true,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(calendarConnections.id, existing[0].id));
    } else {
      await db.insert(calendarConnections).values({
        id: connectionId,
        userId,
        householdId,
        provider: 'ticktick',
        accessToken: encryptToken(tokens.accessToken),
        refreshToken: tokens.refreshToken ? encryptToken(tokens.refreshToken) : null,
        tokenExpiresAt: tokens.expiresAt,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const existingSettings = await db
        .select()
        .from(calendarSyncSettings)
        .where(
          and(
            eq(calendarSyncSettings.userId, userId),
            eq(calendarSyncSettings.householdId, householdId)
          )
        )
        .limit(1);

      if (!existingSettings[0]) {
        await db.insert(calendarSyncSettings).values({
          id: uuidv4(),
          userId,
          householdId,
          syncMode: 'direct',
          syncBills: true,
          syncSavingsMilestones: true,
          syncDebtMilestones: true,
          syncPayoffDates: true,
          syncGoalTargetDates: true,
          reminderMinutes: 1440,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // Best-effort project selection — never fails the connection.
    try {
      const projects = await listTickTickProjects(connectionId);
      let selectedProject = projects.find((p) => p.name === 'Unified Ledger');
      if (!selectedProject) {
        try {
          selectedProject = await createTickTickProject(connectionId, 'Unified Ledger');
        } catch (createError) {
          console.error('Error creating project, using first available:', createError);
          selectedProject = projects[0];
        }
      }
      if (selectedProject) {
        await db
          .update(calendarConnections)
          .set({
            calendarId: selectedProject.id,
            calendarName: selectedProject.name,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(calendarConnections.id, connectionId));
      }
    } catch (projectError) {
      console.error('Error fetching/creating projects:', projectError);
    }

    redirectTo = `${settingsUrl}?tab=data&calendarConnected=ticktick`;
  } catch (err) {
    // NEXT_REDIRECT from an early redirect() above must propagate, not be
    // rewritten as callback_failed.
    if (err && typeof err === 'object' && 'digest' in err && String((err as { digest: unknown }).digest).startsWith('NEXT_REDIRECT')) {
      throw err;
    }
    if (err instanceof Error && err.message === 'Unauthorized') {
      redirect(fail('unauthorized'));
    }
    console.error('Error in TickTick OAuth callback:', err);
    redirectTo = fail('callback_failed');
  }

  redirect(redirectTo);
}
