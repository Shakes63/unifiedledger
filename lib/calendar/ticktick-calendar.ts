/**
 * TickTick Calendar API Client
 * Handles OAuth token management and task operations for calendar sync
 * 
 * TickTick API Documentation: https://developer.ticktick.com/docs#/openapi
 */

import { db } from '@/lib/db';
import { calendarConnections } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { CalendarEvent } from './google-calendar';

// TickTick OAuth configuration
const TICKTICK_AUTH_URL = 'https://ticktick.com/oauth/authorize';
const TICKTICK_TOKEN_URL = 'https://ticktick.com/oauth/token';
const TICKTICK_API_URL = 'https://api.ticktick.com/open/v1';

// Required scopes for task access
const SCOPES = ['tasks:read', 'tasks:write'];

export interface TickTickProject {
  id: string;
  name: string;
  color?: string;
  sortOrder?: number;
  closed?: boolean;
  groupId?: string;
  viewMode?: string;
  permission?: string;
  kind?: string;
}

export interface TickTickTask {
  id?: string;
  projectId: string;
  title: string;
  content?: string;
  desc?: string;
  allDay?: boolean;
  startDate?: string;
  dueDate?: string;
  timeZone?: string;
  isFloating?: boolean;
  isAllDay?: boolean;
  reminders?: string[];
  repeatFlag?: string;
  priority?: 0 | 1 | 3 | 5; // none, low, medium, high
  status?: number;
  completedTime?: string;
  sortOrder?: number;
  items?: {
    id: string;
    title: string;
    status: number;
    completedTime?: string;
    isAllDay?: boolean;
    sortOrder?: number;
    startDate?: string;
    timeZone?: string;
  }[];
  modifiedTime?: string;
  etag?: string;
  deleted?: number;
  createdTime?: string;
  creator?: number;
  kind?: string;
}

export interface TickTickTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  tokenType: string;
  scope: string;
}

/**
 * Get the TickTick OAuth client credentials
 */
function getClientCredentials() {
  const clientId = process.env.TICKTICK_CLIENT_ID;
  const clientSecret = process.env.TICKTICK_CLIENT_SECRET;
  const redirectUri = process.env.TICKTICK_REDIRECT_URI || 
    `${process.env.APP_URL || 'http://localhost:3000'}/api/calendar-sync/ticktick/callback`;

  if (!clientId || !clientSecret) {
    throw new Error('TickTick credentials not configured');
  }

  return { clientId, clientSecret, redirectUri };
}

/**
 * Check if TickTick integration is configured
 */
export function isTickTickConfigured(): boolean {
  return !!(
    process.env.TICKTICK_CLIENT_ID &&
    process.env.TICKTICK_CLIENT_SECRET
  );
}

/**
 * Generate TickTick OAuth authorization URL
 */
export function getTickTickAuthUrl(state: string): string {
  const { clientId, redirectUri } = getClientCredentials();
  
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    state,
  });

  return `${TICKTICK_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeTickTickCodeForTokens(code: string): Promise<TickTickTokens> {
  const { clientId, clientSecret, redirectUri } = getClientCredentials();

  const response = await fetch(TICKTICK_TOKEN_URL, {
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
  
  // TickTick token response format
  const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    tokenType: data.token_type || 'Bearer',
    scope: data.scope || SCOPES.join(' '),
  };
}

/**
 * Refresh an expired access token
 */
export async function refreshTickTickToken(refreshToken: string): Promise<TickTickTokens> {
  const { clientId, clientSecret } = getClientCredentials();

  const response = await fetch(TICKTICK_TOKEN_URL, {
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
  const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt,
    tokenType: data.token_type || 'Bearer',
    scope: data.scope || SCOPES.join(' '),
  };
}

/**
 * Get a valid access token, refreshing if necessary
 */
export async function getValidTickTickAccessToken(connectionId: string): Promise<string> {
  const connection = await db
    .select()
    .from(calendarConnections)
    .where(eq(calendarConnections.id, connectionId))
    .limit(1);

  if (!connection[0]) {
    throw new Error('TickTick connection not found');
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
  const newTokens = await refreshTickTickToken(refreshToken);

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
 * List all projects (task lists) the user has
 */
export async function listTickTickProjects(connectionId: string): Promise<TickTickProject[]> {
  const accessToken = await getValidTickTickAccessToken(connectionId);

  const response = await fetch(`${TICKTICK_API_URL}/project`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list projects: ${error}`);
  }

  const projects = await response.json();
  
  return projects.map((project: TickTickProject) => ({
    id: project.id,
    name: project.name,
    color: project.color,
    sortOrder: project.sortOrder,
    closed: project.closed,
    kind: project.kind,
  }));
}

/**
 * Create a new project for Unified Ledger events
 */
export async function createTickTickProject(
  connectionId: string, 
  name: string = 'Unified Ledger'
): Promise<TickTickProject> {
  const accessToken = await getValidTickTickAccessToken(connectionId);

  const response = await fetch(`${TICKTICK_API_URL}/project`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      color: '#4CAF50', // Green color matching app theme
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create project: ${error}`);
  }

  const project = await response.json();
  
  return {
    id: project.id,
    name: project.name,
    color: project.color,
  };
}

/**
 * Convert reminder minutes to TickTick reminder format
 * TickTick uses trigger strings like "TRIGGER:-P0DT1H0M0S" (1 hour before)
 */
function toTickTickReminder(minutes: number | null | undefined): string[] {
  if (minutes === null || minutes === undefined) {
    return [];
  }

  // Convert minutes to days, hours, mins
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;

  return [`TRIGGER:-P${days}DT${hours}H${mins}M0S`];
}

/**
 * Create a task in TickTick
 */
export async function createTickTickTask(
  connectionId: string,
  projectId: string,
  event: CalendarEvent
): Promise<string> {
  const accessToken = await getValidTickTickAccessToken(connectionId);

  // Build the task body
  const content = event.link 
    ? `${event.description}\n\nOpen in Unified Ledger: ${event.link}`
    : event.description;

  const taskBody: TickTickTask = {
    projectId,
    title: event.title,
    content,
    dueDate: event.date,
    isAllDay: event.allDay,
    reminders: toTickTickReminder(event.reminderMinutes),
    priority: 0, // Default priority
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  const response = await fetch(`${TICKTICK_API_URL}/task`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(taskBody),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create task: ${error}`);
  }

  const task = await response.json();
  return task.id;
}

/**
 * Update an existing task in TickTick
 */
export async function updateTickTickTask(
  connectionId: string,
  projectId: string,
  taskId: string,
  event: CalendarEvent
): Promise<void> {
  const accessToken = await getValidTickTickAccessToken(connectionId);

  const content = event.link 
    ? `${event.description}\n\nOpen in Unified Ledger: ${event.link}`
    : event.description;

  const taskBody: Partial<TickTickTask> = {
    id: taskId,
    projectId,
    title: event.title,
    content,
    dueDate: event.date,
    isAllDay: event.allDay,
    reminders: toTickTickReminder(event.reminderMinutes),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  const response = await fetch(`${TICKTICK_API_URL}/task/${taskId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(taskBody),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update task: ${error}`);
  }
}

/**
 * Delete a task from TickTick
 */
export async function deleteTickTickTask(
  connectionId: string,
  projectId: string,
  taskId: string
): Promise<void> {
  const accessToken = await getValidTickTickAccessToken(connectionId);

  const response = await fetch(`${TICKTICK_API_URL}/project/${projectId}/task/${taskId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  // 404 is acceptable (task already deleted)
  if (!response.ok && response.status !== 404) {
    const error = await response.text();
    throw new Error(`Failed to delete task: ${error}`);
  }
}

/**
 * Batch delete multiple tasks
 */
export async function deleteTickTickTasks(
  connectionId: string,
  projectId: string,
  taskIds: string[]
): Promise<void> {
  // Delete tasks in parallel with concurrency limit
  const BATCH_SIZE = 10;
  
  for (let i = 0; i < taskIds.length; i += BATCH_SIZE) {
    const batch = taskIds.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map((taskId) => deleteTickTickTask(connectionId, projectId, taskId))
    );
  }
}

/**
 * Get current user info
 */
export async function getTickTickUserInfo(connectionId: string): Promise<{ username: string; id: string }> {
  const accessToken = await getValidTickTickAccessToken(connectionId);

  const response = await fetch(`${TICKTICK_API_URL}/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get user info: ${error}`);
  }

  return response.json();
}
