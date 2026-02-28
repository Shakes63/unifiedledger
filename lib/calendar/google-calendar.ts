/**
 * Google Calendar API Client
 * Uses Better Auth OAuth tokens for authentication
 */

import { db } from '@/lib/db';
import { calendarConnections } from '@/lib/db/schema';
import * as authSchema from '@/auth-schema';
import { eq, and } from 'drizzle-orm';
import { loadOAuthSettingsFromDatabase } from '@/lib/auth/load-oauth-settings';
import { isOAuthLoginProviderConfigured } from '@/lib/auth/oauth-provider-config';

// Google API URLs
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

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
  expiresAt: Date | null;
}

/**
 * Check if the user has Google OAuth linked via Better Auth
 */
export async function hasGoogleOAuthLinked(userId: string): Promise<boolean> {
  const account = await db
    .select()
    .from(authSchema.account)
    .where(
      and(
        eq(authSchema.account.userId, userId),
        eq(authSchema.account.providerId, 'google')
      )
    )
    .limit(1);

  return account.length > 0 && !!account[0].accessToken;
}

/**
 * Get Google OAuth tokens from Better Auth account table
 */
async function getGoogleOAuthTokens(userId: string): Promise<GoogleTokens | null> {
  const account = await db
    .select()
    .from(authSchema.account)
    .where(
      and(
        eq(authSchema.account.userId, userId),
        eq(authSchema.account.providerId, 'google')
      )
    )
    .limit(1);

  if (!account[0] || !account[0].accessToken) {
    return null;
  }

  return {
    accessToken: account[0].accessToken,
    refreshToken: account[0].refreshToken || undefined,
    expiresAt: account[0].accessTokenExpiresAt,
  };
}

/**
 * Refresh an expired access token using Google's token endpoint
 */
async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
  const settings = await loadOAuthSettingsFromDatabase();
  const clientId = settings?.google?.clientId;
  const clientSecret = settings?.google?.clientSecret;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }

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
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  return {
    accessToken: data.access_token,
    expiresAt,
  };
}

/**
 * Get a valid access token for a user, refreshing if necessary
 * Uses Better Auth's account table for token storage
 */
export async function getValidAccessTokenForUser(userId: string): Promise<string> {
  const tokens = await getGoogleOAuthTokens(userId);

  if (!tokens) {
    throw new Error('Google account not linked. Please link your Google account in Settings.');
  }

  // Check if token is expired (with 5 minute buffer)
  const isExpired = tokens.expiresAt && 
    tokens.expiresAt.getTime() < Date.now() + 5 * 60 * 1000;

  if (!isExpired) {
    return tokens.accessToken;
  }

  if (!tokens.refreshToken) {
    throw new Error('Token expired and no refresh token available. Please re-link your Google account.');
  }

  // Refresh the token
  const newTokens = await refreshAccessToken(tokens.refreshToken);

  // Update the Better Auth account table
  await db
    .update(authSchema.account)
    .set({
      accessToken: newTokens.accessToken,
      accessTokenExpiresAt: newTokens.expiresAt,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(authSchema.account.userId, userId),
        eq(authSchema.account.providerId, 'google')
      )
    );

  return newTokens.accessToken;
}

/**
 * Get a valid access token from a calendar connection
 * This is a wrapper that gets the userId from the connection and uses Better Auth tokens
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

  return getValidAccessTokenForUser(connection[0].userId);
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
 * List calendars directly for a user (without requiring a connection)
 */
export async function listCalendarsForUser(userId: string): Promise<GoogleCalendar[]> {
  const accessToken = await getValidAccessTokenForUser(userId);

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
 * Check if Google Calendar sync is available
 * Requires Google OAuth provider to be configured in OAuth settings
 */
export async function isGoogleCalendarConfigured(): Promise<boolean> {
  return isOAuthLoginProviderConfigured('google');
}
