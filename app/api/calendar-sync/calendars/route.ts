import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { calendarConnections } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { listCalendars, createCalendar } from '@/lib/calendar/google-calendar';

export const dynamic = 'force-dynamic';

/**
 * GET /api/calendar-sync/calendars
 * List available calendars for a connection
 * Query params: connectionId
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');

    if (!connectionId) {
      return Response.json(
        { error: 'connectionId is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const connection = await db
      .select()
      .from(calendarConnections)
      .where(
        and(
          eq(calendarConnections.id, connectionId),
          eq(calendarConnections.userId, userId)
        )
      )
      .limit(1);

    if (!connection[0]) {
      return Response.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    const calendars = await listCalendars(connectionId);

    return Response.json({
      calendars,
      selectedCalendarId: connection[0].calendarId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error listing calendars:', error);
    return Response.json(
      { error: 'Failed to list calendars' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/calendar-sync/calendars
 * Create a new calendar or select an existing one
 * Body: { connectionId: string, calendarId?: string, createNew?: boolean, calendarName?: string }
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const { connectionId, calendarId, createNew, calendarName } = body;

    if (!connectionId) {
      return Response.json(
        { error: 'connectionId is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const connection = await db
      .select()
      .from(calendarConnections)
      .where(
        and(
          eq(calendarConnections.id, connectionId),
          eq(calendarConnections.userId, userId)
        )
      )
      .limit(1);

    if (!connection[0]) {
      return Response.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    let selectedCalendarId = calendarId;
    let selectedCalendarName = calendarName;

    // Create a new calendar if requested
    if (createNew) {
      const newCalendar = await createCalendar(
        connectionId,
        calendarName || 'Unified Ledger'
      );
      selectedCalendarId = newCalendar.id;
      selectedCalendarName = newCalendar.summary;
    } else if (calendarId && !calendarName) {
      // Get the calendar name if not provided
      const calendars = await listCalendars(connectionId);
      const selected = calendars.find((c) => c.id === calendarId);
      selectedCalendarName = selected?.summary;
    }

    // Update the connection with the selected calendar
    await db
      .update(calendarConnections)
      .set({
        calendarId: selectedCalendarId,
        calendarName: selectedCalendarName,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(calendarConnections.id, connectionId));

    return Response.json({
      success: true,
      calendarId: selectedCalendarId,
      calendarName: selectedCalendarName,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error selecting calendar:', error);
    return Response.json(
      { error: 'Failed to select calendar' },
      { status: 500 }
    );
  }
}








