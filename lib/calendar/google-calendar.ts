/**
 * Google Calendar API Client
 * Handles OAuth token management and calendar event operations
 */

import { db } from '@/lib/db';
import { calendarConnections } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Google OAuth configuration
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

// Required scopes for calendar access
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
];

export interface GoogleCalendar {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  accessRole: string;
  backgroundColor?: string;
}

export interface CalendarEvent {
  title: string;
  description: string;
  date: string; // ISO date (YYYY-MM-DD)
  allDay: boolean;
  reminderMinutes?: number | null;
  color?: string;
  link?: string;
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
}

/**
 * Get the Google OAuth client credentials
 */
function getClientCredentials() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI || 
    `${process.env.APP_URL || 'http://localhost:3000'}/api/calendar-sync/google/callback`;

  if (!clientId || !clientSecret) {
    throw new Error('Google Calendar credentials not configured');
  }

  return { clientId, clientSecret, redirectUri };
}

/**
 * Generate Google OAuth authorization URL
 */
export function getGoogleAuthUrl(state: string): string {
  const { clientId, redirectUri } = getClientCredentials();
  
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent', // Force consent to get refresh token
    state,
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
  const { clientId, clientSecret, redirectUri } = getClientCredentials();

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }

  const data = await response.json();
  
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
  };
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const { clientId, clientSecret } = getClientCredentials();

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh token: ${error}`);
  }

  const data = await response.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken, // Google may not return a new refresh token
    expiresAt,
  };
}

/**
 * Get a valid access token, refreshing if necessary
 */
export async function getValidAccessToken(connectionId: string): Promise<string> {
  const connection = await db
    .select()
    .from(calendarConnections)
    .where(eq(calendarConnections.id, connectionId))
    .limit(1);

  if (!connection[0]) {
    throw new Error('Calendar connection not found');
  }

  const { accessToken, refreshToken, tokenExpiresAt } = connection[0];

  // Check if token is expired (with 5 minute buffer)
  const isExpired = tokenExpiresAt && 
    new Date(tokenExpiresAt).getTime() < Date.now() + 5 * 60 * 1000;

  if (!isExpired) {
    return accessToken;
  }

  if (!refreshToken) {
    throw new Error('Token expired and no refresh token available');
  }

  // Refresh the token
  const newTokens = await refreshAccessToken(refreshToken);

  // Update the database
  await db
    .update(calendarConnections)
    .set({
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
      tokenExpiresAt: newTokens.expiresAt,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(calendarConnections.id, connectionId));

  return newTokens.accessToken;
}

/**
 * List all calendars the user has access to
 */
export async function listCalendars(connectionId: string): Promise<GoogleCalendar[]> {
  const accessToken = await getValidAccessToken(connectionId);

  const response = await fetch(`${GOOGLE_CALENDAR_API}/users/me/calendarList`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list calendars: ${error}`);
  }

  const data = await response.json();
  
  return data.items.map((cal: {
    id: string;
    summary: string;
    description?: string;
    primary?: boolean;
    accessRole: string;
    backgroundColor?: string;
  }) => ({
    id: cal.id,
    summary: cal.summary,
    description: cal.description,
    primary: cal.primary,
    accessRole: cal.accessRole,
    backgroundColor: cal.backgroundColor,
  }));
}

/**
 * Create a new calendar for Unified Ledger
 */
export async function createCalendar(connectionId: string, name: string = 'Unified Ledger'): Promise<GoogleCalendar> {
  const accessToken = await getValidAccessToken(connectionId);

  const response = await fetch(`${GOOGLE_CALENDAR_API}/calendars`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: name,
      description: 'Bills, milestones, and financial events from Unified Ledger',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create calendar: ${error}`);
  }

  const data = await response.json();
  
  return {
    id: data.id,
    summary: data.summary,
    description: data.description,
    accessRole: 'owner',
  };
}

/**
 * Create a calendar event
 */
export async function createEvent(
  connectionId: string,
  calendarId: string,
  event: CalendarEvent
): Promise<string> {
  const accessToken = await getValidAccessToken(connectionId);

  // Build the event body
  const eventBody: Record<string, unknown> = {
    summary: event.title,
    description: event.link 
      ? `${event.description}\n\nOpen in Unified Ledger: ${event.link}`
      : event.description,
  };

  // All-day event uses date, timed events use dateTime
  if (event.allDay) {
    eventBody.start = { date: event.date };
    eventBody.end = { date: event.date };
  } else {
    // For non-all-day events, use full ISO datetime
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    eventBody.start = { dateTime: `${event.date}T09:00:00`, timeZone };
    eventBody.end = { dateTime: `${event.date}T09:30:00`, timeZone };
  }

  // Add reminder if specified
  if (event.reminderMinutes !== undefined && event.reminderMinutes !== null) {
    eventBody.reminders = {
      useDefault: false,
      overrides: [{ method: 'popup', minutes: event.reminderMinutes }],
    };
  }

  // Add source link for clickable link in Google Calendar UI
  if (event.link) {
    eventBody.source = {
      title: 'Open in Unified Ledger',
      url: event.link,
    };
  }

  const response = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventBody),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create event: ${error}`);
  }

  const data = await response.json();
  return data.id;
}

/**
 * Update an existing calendar event
 */
export async function updateEvent(
  connectionId: string,
  calendarId: string,
  eventId: string,
  event: CalendarEvent
): Promise<void> {
  const accessToken = await getValidAccessToken(connectionId);

  const eventBody: Record<string, unknown> = {
    summary: event.title,
    description: event.link 
      ? `${event.description}\n\nOpen in Unified Ledger: ${event.link}`
      : event.description,
  };

  if (event.allDay) {
    eventBody.start = { date: event.date };
    eventBody.end = { date: event.date };
  } else {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    eventBody.start = { dateTime: `${event.date}T09:00:00`, timeZone };
    eventBody.end = { dateTime: `${event.date}T09:30:00`, timeZone };
  }

  if (event.reminderMinutes !== undefined && event.reminderMinutes !== null) {
    eventBody.reminders = {
      useDefault: false,
      overrides: [{ method: 'popup', minutes: event.reminderMinutes }],
    };
  }

  if (event.link) {
    eventBody.source = {
      title: 'Open in Unified Ledger',
      url: event.link,
    };
  }

  const response = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventBody),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update event: ${error}`);
  }
}

/**
 * Delete a calendar event
 */
export async function deleteEvent(
  connectionId: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const accessToken = await getValidAccessToken(connectionId);

  const response = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  // 410 Gone is acceptable (event already deleted)
  if (!response.ok && response.status !== 410) {
    const error = await response.text();
    throw new Error(`Failed to delete event: ${error}`);
  }
}

/**
 * Batch delete multiple events
 */
export async function deleteEvents(
  connectionId: string,
  calendarId: string,
  eventIds: string[]
): Promise<void> {
  // Delete events in parallel with concurrency limit
  const BATCH_SIZE = 10;
  
  for (let i = 0; i < eventIds.length; i += BATCH_SIZE) {
    const batch = eventIds.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map((eventId) => deleteEvent(connectionId, calendarId, eventId))
    );
  }
}

/**
 * Check if the Google Calendar API is configured
 */
export function isGoogleCalendarConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CALENDAR_CLIENT_ID &&
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET
  );
}
