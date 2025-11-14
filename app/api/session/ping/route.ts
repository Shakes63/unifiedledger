/**
 * POST /api/session/ping
 * Updates session activity timestamp to prevent timeout
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { updateSessionActivity, validateSession } from '@/lib/session-utils';
import * as authSchema from '@/auth-schema';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // Get session from cookie (Better Auth stores session data in session_data cookie)
    const cookies = request.headers.get('cookie') || '';
    const sessionDataMatch = cookies.match(/better-auth\.session_data=([^;]+)/);

    if (!sessionDataMatch) {
      return NextResponse.json({ error: 'No session found' }, { status: 401 });
    }

    // Parse the session data cookie to extract the token
    let sessionToken: string | undefined;
    try {
      const sessionData = JSON.parse(atob(sessionDataMatch[1].split('.')[0]));
      sessionToken = sessionData?.session?.session?.token;
    } catch (e) {
      console.error('Failed to parse session cookie:', e);
      return NextResponse.json({ error: 'Invalid session cookie' }, { status: 401 });
    }

    if (!sessionToken) {
      return NextResponse.json({ error: 'No session token found' }, { status: 401 });
    }

    // Validate session
    const validation = await validateSession(sessionToken);

    if (!validation.valid || !validation.session) {
      return NextResponse.json(
        {
          error: 'Session invalid',
          reason: validation.reason,
        },
        { status: 401 }
      );
    }

    // Update activity timestamp
    await updateSessionActivity(validation.session.id);

    // Get updated session to return new expiration
    const updatedSession = await db
      .select()
      .from(authSchema.session)
      .where(eq(authSchema.session.id, validation.session.id))
      .limit(1);

    if (!updatedSession || updatedSession.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      expiresAt: updatedSession[0].expiresAt,
      lastActivityAt: updatedSession[0].lastActivityAt,
    });
  } catch (error) {
    console.error('Session ping error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
