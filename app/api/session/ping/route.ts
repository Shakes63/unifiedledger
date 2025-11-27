/**
 * POST /api/session/ping
 * Updates session activity timestamp to prevent timeout
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth';
import { headers } from 'next/headers';
import { updateSessionActivity, validateSession } from '@/lib/session-utils';
import * as authSchema from '@/auth-schema';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request) {
  try {
    // Get session using Better Auth API
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session || !session.session) {
      return NextResponse.json({ error: 'No session found' }, { status: 401 });
    }

    const sessionToken = session.session.token;

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
