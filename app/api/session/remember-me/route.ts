/**
 * POST /api/session/remember-me
 * Updates the rememberMe flag for the current session
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import * as authSchema from '@/auth-schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // Get session using Better Auth API (consistent with other session routes)
    const sessionResult = await auth.api.getSession({
      headers: await headers(),
    });

    if (!sessionResult || !sessionResult.session) {
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

    // Update rememberMe field using session ID from Better Auth
    await db
      .update(authSchema.session)
      .set({
        rememberMe: rememberMe,
        updatedAt: new Date(),
      })
      .where(eq(authSchema.session.id, sessionResult.session.id));

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
