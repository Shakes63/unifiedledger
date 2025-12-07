/**
 * DEPRECATED: This route is no longer used.
 * 
 * Google Calendar OAuth is now handled through Better Auth's social sign-in.
 * Users link their Google account once via Better Auth, and calendar access
 * is granted through the same OAuth flow with calendar scopes.
 * 
 * See: /api/calendar-sync/google/enable for enabling calendar sync
 * See: /api/calendar-sync/google/status for checking Google OAuth status
 * 
 * This route is kept for backwards compatibility but will be removed in a future version.
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(
    { 
      error: 'This endpoint is deprecated. Google Calendar now uses Better Auth OAuth. Link your Google account in Settings > Privacy & Security > Connected Accounts.',
      deprecated: true,
    },
    { status: 410 } // Gone
  );
}
