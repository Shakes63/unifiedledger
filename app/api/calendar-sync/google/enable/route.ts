import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { calendarConnections, calendarSyncSettings } from '@/lib/db/schema';
import { 
  hasGoogleOAuthLinked, 
  listCalendarsForUser,
  isGoogleCalendarConfigured 
} from '@/lib/calendar/google-calendar';
import { v4 as uuidv4 } from 'uuid';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * POST /api/calendar-sync/google/enable
 * Enable Google Calendar sync for a household
 * Creates connection record and default sync settings
 * Body: { calendarId?: string }
 * Household context: x-household-id header
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const { householdId } = await getAndVerifyHousehold(request, userId);
    const { calendarId } = body;

    // Check if Google OAuth is configured
    if (!(await isGoogleCalendarConfigured())) {
      return Response.json(
        { error: 'Google OAuth not configured' },
        { status: 503 }
      );
    }

    // Check if user has Google account linked
    const isLinked = await hasGoogleOAuthLinked(userId);
    if (!isLinked) {
      return Response.json(
        { error: 'Google account not linked. Please link your Google account first.' },
        { status: 400 }
      );
    }

    // Check if connection already exists
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

    let connectionId: string;
    let selectedCalendarId = calendarId;
    let selectedCalendarName: string | null = null;

    // If no calendar specified, try to get primary calendar
    if (!selectedCalendarId) {
      try {
        const calendars = await listCalendarsForUser(userId);
        const primary = calendars.find((c) => c.primary) || calendars[0];
        if (primary) {
          selectedCalendarId = primary.id;
          selectedCalendarName = primary.summary;
        }
      } catch (e) {
        console.error('Error fetching calendars:', e);
      }
    } else {
      // Get calendar name
      try {
        const calendars = await listCalendarsForUser(userId);
        const calendar = calendars.find((c) => c.id === calendarId);
        if (calendar) {
          selectedCalendarName = calendar.summary;
        }
      } catch (e) {
        console.error('Error fetching calendar name:', e);
      }
    }

    if (existing[0]) {
      // Update existing connection
      connectionId = existing[0].id;
      await db
        .update(calendarConnections)
        .set({
          calendarId: selectedCalendarId,
          calendarName: selectedCalendarName,
          isActive: true,
          // Clear old OAuth tokens since we now use Better Auth
          accessToken: '',
          refreshToken: null,
          tokenExpiresAt: null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(calendarConnections.id, existing[0].id));
    } else {
      // Create new connection
      connectionId = uuidv4();
      await db.insert(calendarConnections).values({
        id: connectionId,
        userId,
        householdId,
        provider: 'google',
        calendarId: selectedCalendarId,
        calendarName: selectedCalendarName,
        // No OAuth tokens needed - we use Better Auth
        accessToken: '',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

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

    return Response.json({
      success: true,
      connectionId,
      calendarId: selectedCalendarId,
      calendarName: selectedCalendarName,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error enabling Google Calendar:', error);
    return Response.json(
      { error: 'Failed to enable Google Calendar sync' },
      { status: 500 }
    );
  }
}
