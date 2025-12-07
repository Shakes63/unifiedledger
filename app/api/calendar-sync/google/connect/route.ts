import { requireAuth } from '@/lib/auth-helpers';
import { getGoogleAuthUrl, isGoogleCalendarConfigured } from '@/lib/calendar/google-calendar';
import { v4 as uuidv4 } from 'uuid';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/calendar-sync/google/connect
 * Initiates Google OAuth flow for calendar access
 * Query params: householdId (required)
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    const { searchParams } = new URL(request.url);
    const householdId = searchParams.get('householdId');

    if (!householdId) {
      return Response.json(
        { error: 'householdId is required' },
        { status: 400 }
      );
    }

    // Check if Google Calendar is configured
    if (!isGoogleCalendarConfigured()) {
      return Response.json(
        { error: 'Google Calendar integration is not configured' },
        { status: 503 }
      );
    }

    // Generate a state token for CSRF protection
    const state = uuidv4();

    // Store state, userId, and householdId in a secure cookie
    const stateData = JSON.stringify({ state, userId, householdId });
    const cookieStore = await cookies();
    cookieStore.set('google_oauth_state', stateData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    // Generate the Google OAuth URL
    const authUrl = getGoogleAuthUrl(state);

    return Response.json({ authUrl });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error initiating Google OAuth:', error);
    return Response.json(
      { error: 'Failed to initiate Google Calendar connection' },
      { status: 500 }
    );
  }
}
