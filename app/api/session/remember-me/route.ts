/**
 * POST /api/session/remember-me
 * Updates the rememberMe flag for the current session
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as authSchema from '@/auth-schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // Get session token from cookie
    const cookies = request.headers.get('cookie') || '';
    const sessionTokenMatch = cookies.match(/better-auth\.session_token=([^;]+)/);
    const sessionToken = sessionTokenMatch?.[1];

    if (!sessionToken) {
      return NextResponse.json({ error: 'No session found' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { rememberMe } = body;

    if (typeof rememberMe !== 'boolean') {
      return NextResponse.json(
        { error: 'rememberMe must be a boolean' },
        { status: 400 }
      );
    }

    // Find session by token
    const sessions = await db
      .select()
      .from(authSchema.session)
      .where(eq(authSchema.session.token, sessionToken))
      .limit(1);

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 401 });
    }

    const session = sessions[0];

    // Update rememberMe field
    await db
      .update(authSchema.session)
      .set({
        rememberMe: rememberMe,
        updatedAt: new Date(),
      })
      .where(eq(authSchema.session.id, session.id));

    return NextResponse.json({
      success: true,
      rememberMe,
    });
  } catch (error) {
    console.error('Remember me update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
