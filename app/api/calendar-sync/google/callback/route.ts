/**
 * DEPRECATED: This route is no longer used.
 * 
 * Google Calendar OAuth is now handled through Better Auth's social sign-in.
 * The OAuth callback is handled by Better Auth at /api/better-auth/callback/google.
 * 
 * See: /api/calendar-sync/google/enable for enabling calendar sync
 * See: /api/calendar-sync/google/status for checking Google OAuth status
 * 
 * This route is kept for backwards compatibility but will be removed in a future version.
 */

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Redirect to settings page with deprecation notice
  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  return redirect(`${baseUrl}/dashboard/settings?tab=data&calendarError=deprecated_flow`);
}
