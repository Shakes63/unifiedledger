/**
 * Session validation utilities for inactivity-based session timeout
 *
 * These utilities handle:
 * - Session validation (checking expiration and inactivity)
 * - Activity tracking (updating lastActivityAt)
 * - User timeout settings (fetching sessionTimeout preference)
 */

import { db } from '@/lib/db';
import { userSettings } from '@/lib/db/schema';
import * as authSchema from '@/auth-schema';
import { eq } from 'drizzle-orm';

interface ValidationResult {
  valid: boolean;
  reason?: 'expired' | 'inactive' | 'not_found';
  session?: typeof authSchema.session.$inferSelect;
  userId?: string;
}

/**
 * In-memory cache for user session timeout settings
 * Key: userId, Value: { timeout: number, cachedAt: number }
 */
const timeoutCache = new Map<string, { timeout: number; cachedAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Validates a session token against expiration and inactivity timeout
 *
 * @param sessionToken - The session token to validate
 * @returns ValidationResult with session validity status
 */
export async function validateSession(sessionToken: string): Promise<ValidationResult> {
  if (!sessionToken) {
    return { valid: false, reason: 'not_found' };
  }

  try {
    // Fetch session from database
    const sessions = await db
      .select()
      .from(authSchema.session)
      .where(eq(authSchema.session.token, sessionToken))
      .limit(1);

    if (!sessions || sessions.length === 0) {
      return { valid: false, reason: 'not_found' };
    }

    const session = sessions[0];
    const now = Date.now();

    // Check if session has expired (absolute expiration)
    if (session.expiresAt <= now) {
      return { valid: false, reason: 'expired', session, userId: session.userId };
    }

    // If rememberMe is enabled, skip inactivity check
    if (session.rememberMe) {
      return { valid: true, session, userId: session.userId };
    }

    // Check inactivity timeout
    const userTimeout = await getSessionTimeout(session.userId);

    // If timeout is 0 (disabled), skip inactivity check
    if (userTimeout === 0) {
      return { valid: true, session, userId: session.userId };
    }

    // Check if session is inactive
    const lastActivity = session.lastActivityAt || session.createdAt;
    const inactivityMs = userTimeout * 60 * 1000; // Convert minutes to milliseconds
    const inactiveSince = now - lastActivity;

    if (inactiveSince > inactivityMs) {
      return { valid: false, reason: 'inactive', session, userId: session.userId };
    }

    return { valid: true, session, userId: session.userId };
  } catch (error) {
    console.error('Error validating session:', error);
    // Fail open for availability - allow request but log error
    return { valid: true };
  }
}

/**
 * Updates the lastActivityAt timestamp for a session
 * Should be called on authenticated requests to reset inactivity timer
 *
 * @param sessionId - The session ID to update
 */
export async function updateSessionActivity(sessionId: string): Promise<void> {
  if (!sessionId) {
    return;
  }

  try {
    const now = new Date(); // Date object for Drizzle timestamp fields

    await db
      .update(authSchema.session)
      .set({
        lastActivityAt: now,
        updatedAt: now,
      })
      .where(eq(authSchema.session.id, sessionId));
  } catch (error) {
    console.error('Error updating session activity:', error);
    // Fail silently - don't block request
  }
}

/**
 * Gets the session timeout setting for a user (in minutes)
 * Uses in-memory cache to reduce database queries
 *
 * @param userId - The user ID
 * @returns Session timeout in minutes (0 = disabled, default = 30)
 */
export async function getSessionTimeout(userId: string): Promise<number> {
  if (!userId) {
    return 30; // Default timeout
  }

  // Check cache first
  const cached = timeoutCache.get(userId);
  const now = Date.now();

  if (cached && (now - cached.cachedAt) < CACHE_TTL) {
    return cached.timeout;
  }

  try {
    // Fetch from database
    const settings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    const timeout = settings && settings.length > 0
      ? (settings[0].sessionTimeout ?? 30)
      : 30;

    // Cache result
    timeoutCache.set(userId, { timeout, cachedAt: now });

    return timeout;
  } catch (error) {
    console.error('Error fetching session timeout:', error);
    return 30; // Default timeout on error
  }
}

/**
 * Clears the session timeout cache for a user
 * Should be called when user updates their timeout setting
 *
 * @param userId - The user ID
 */
export function clearTimeoutCache(userId: string): void {
  timeoutCache.delete(userId);
}

/**
 * Deletes an expired or invalid session from the database
 *
 * @param sessionId - The session ID to delete
 */
export async function deleteSession(sessionId: string): Promise<void> {
  if (!sessionId) {
    return;
  }

  try {
    await db
      .delete(authSchema.session)
      .where(eq(authSchema.session.id, sessionId));
  } catch (error) {
    console.error('Error deleting session:', error);
    // Fail silently - don't block request
  }
}

/**
 * Deletes a session by token
 *
 * @param sessionToken - The session token
 */
export async function deleteSessionByToken(sessionToken: string): Promise<void> {
  if (!sessionToken) {
    return;
  }

  try {
    await db
      .delete(authSchema.session)
      .where(eq(authSchema.session.token, sessionToken));
  } catch (error) {
    console.error('Error deleting session by token:', error);
    // Fail silently - don't block request
  }
}
