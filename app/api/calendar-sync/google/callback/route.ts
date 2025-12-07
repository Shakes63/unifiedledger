import { db } from '@/lib/db';
import { calendarConnections, calendarSyncSettings } from '@/lib/db/schema';
import { exchangeCodeForTokens, listCalendars } from '@/lib/calendar/google-calendar';
import { v4 as uuidv4 } from 'uuid';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/calendar-sync/google/callback
 * Handles the OAuth callback from Google
 * Query params: code, state, error (optional)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Base URL for redirects
  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  const settingsUrl = `${baseUrl}/dashboard/settings`;

  // Handle user cancellation or errors
  if (error) {
    console.error('Google OAuth error:', error);
    return redirect(`${settingsUrl}?tab=data&calendarError=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return redirect(`${settingsUrl}?tab=data&calendarError=missing_params`);
  }

  try {
    // Verify state from cookie
    const cookieStore = await cookies();
    const stateDataStr = cookieStore.get('google_oauth_state')?.value;

    if (!stateDataStr) {
      return redirect(`${settingsUrl}?tab=data&calendarError=state_expired`);
    }

    const stateData = JSON.parse(stateDataStr);

    if (stateData.state !== state) {
      return redirect(`${settingsUrl}?tab=data&calendarError=state_mismatch`);
    }

    const { userId, householdId } = stateData;

    // Clear the state cookie
    cookieStore.delete('google_oauth_state');

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Create the connection record first (without calendar selection)
    const connectionId = uuidv4();
    
    // Check if connection already exists for this user/household/provider
    const existing = await db
      .select()
      .from(calendarConnections)
      .where(
        and(
          eq(calendarConnections.userId, userId),
          eq(calendarConnections.householdId, householdId),
          eq(calendarConnections.provider, 'google')
        )
      )
      .limit(1);

    if (existing[0]) {
      // Update existing connection
      await db
        .update(calendarConnections)
        .set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken || existing[0].refreshToken,
          tokenExpiresAt: tokens.expiresAt,
          isActive: true,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(calendarConnections.id, existing[0].id));
    } else {
      // Create new connection
      await db.insert(calendarConnections).values({
        id: connectionId,
        userId,
        householdId,
        provider: 'google',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.expiresAt,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Create default sync settings if they don't exist
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
          reminderMinutes: 1440, // 1 day
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // Try to get the user's calendars and select primary
    const finalConnectionId = existing[0]?.id || connectionId;
    try {
      const calendars = await listCalendars(finalConnectionId);
      const primaryCalendar = calendars.find((cal) => cal.primary) || calendars[0];
      
      if (primaryCalendar) {
        await db
          .update(calendarConnections)
          .set({
            calendarId: primaryCalendar.id,
            calendarName: primaryCalendar.summary,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(calendarConnections.id, finalConnectionId));
      }
    } catch (calendarError) {
      console.error('Error fetching calendars:', calendarError);
      // Continue anyway - user can select calendar later
    }

    // Redirect to settings page with success
    return redirect(`${settingsUrl}?tab=data&calendarConnected=google`);
  } catch (err) {
    console.error('Error in Google OAuth callback:', err);
    return redirect(`${settingsUrl}?tab=data&calendarError=callback_failed`);
  }
}
