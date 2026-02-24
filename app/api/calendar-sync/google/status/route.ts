import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { 
  hasGoogleOAuthLinked, 
  listCalendarsForUser,
  isGoogleCalendarConfigured 
} from '@/lib/calendar/google-calendar';
import { db } from '@/lib/db';
import { calendarConnections, calendarSyncSettings } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/calendar-sync/google/status
 * Check if user has Google OAuth linked and get calendar list
 * Household context: x-household-id header
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    // Check if Google OAuth is configured at all
    if (!isGoogleCalendarConfigured()) {
      return Response.json({
        configured: false,
        linked: false,
        calendars: [],
        selectedCalendarId: null,
        message: 'Google OAuth not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.',
      });
    }

    // Check if user has Google account linked via Better Auth
    const isLinked = await hasGoogleOAuthLinked(userId);

    if (!isLinked) {
      return Response.json({
        configured: true,
        linked: false,
        calendars: [],
        selectedCalendarId: null,
        message: 'Link your Google account to enable calendar sync.',
      });
    }

    // Get existing connection for this household
    const connection = await db
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

    // Get sync settings
    const settings = await db
      .select()
      .from(calendarSyncSettings)
      .where(
        and(
          eq(calendarSyncSettings.userId, userId),
          eq(calendarSyncSettings.householdId, householdId)
        )
      )
      .limit(1);

    // Try to list calendars
    let calendars: Array<{id: string; summary: string; primary?: boolean}> = [];
    let error: string | null = null;

    try {
      calendars = await listCalendarsForUser(userId);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to fetch calendars';
      console.error('Error fetching calendars:', e);
    }

    return Response.json({
      configured: true,
      linked: true,
      calendars,
      selectedCalendarId: connection[0]?.calendarId || null,
      selectedCalendarName: connection[0]?.calendarName || null,
      connectionId: connection[0]?.id || null,
      settings: settings[0] || null,
      error,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error checking Google status:', error);
    return Response.json(
      { error: 'Failed to check Google Calendar status' },
      { status: 500 }
    );
  }
}
