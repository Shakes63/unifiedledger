import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { calendarConnections, calendarEvents } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { deleteEvents as deleteGoogleEvents } from '@/lib/calendar/google-calendar';
import { deleteTickTickTasks } from '@/lib/calendar/ticktick-calendar';

export const dynamic = 'force-dynamic';

/**
 * POST /api/calendar-sync/disconnect
 * Disconnects a calendar integration
 * Body: { connectionId: string, deleteEvents?: boolean }
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const { connectionId, deleteRemoteEvents = false } = body;

    if (!connectionId) {
      return Response.json(
        { error: 'connectionId is required' },
        { status: 400 }
      );
    }

    // Get the connection and verify ownership
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

    // Optionally delete events from the external calendar
    if (deleteRemoteEvents && connection[0].calendarId) {
      try {
        // Get all tracked events for this connection
        const events = await db
          .select()
          .from(calendarEvents)
          .where(eq(calendarEvents.connectionId, connectionId));

        const eventIds = events.map((e) => e.externalEventId);

        if (eventIds.length > 0) {
          // Use appropriate delete function based on provider
          if (connection[0].provider === 'ticktick') {
            await deleteTickTickTasks(
              connectionId,
              connection[0].calendarId,
              eventIds
            );
          } else {
            await deleteGoogleEvents(
              connectionId,
              connection[0].calendarId,
              eventIds
            );
          }
        }
      } catch (deleteError) {
        console.error('Error deleting remote events:', deleteError);
        // Continue with disconnection even if remote deletion fails
      }
    }

    // Delete all tracked events from our database
    await db
      .delete(calendarEvents)
      .where(eq(calendarEvents.connectionId, connectionId));

    // Delete the connection
    await db
      .delete(calendarConnections)
      .where(eq(calendarConnections.id, connectionId));

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error disconnecting calendar:', error);
    return Response.json(
      { error: 'Failed to disconnect calendar' },
      { status: 500 }
    );
  }
}
