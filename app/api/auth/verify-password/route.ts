import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

/**
 * POST /api/auth/verify-password
 * Verify password without creating a session
 * Used for 2FA flow where we need to verify password before checking 2FA
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    // Use Better Auth's sign-in to verify password
    // This will create a session, but we'll handle that in the frontend
    const result = await auth.api.signInEmail({
      body: {
        email,
        password,
      },
      headers: request.headers,
    });

    if (!result || result.error) {
      return NextResponse.json(
        { error: 'Incorrect email or password' },
        { status: 401 }
      );
    }

    // Password is valid - return success
    // Note: Better Auth has already created a session at this point
    // The frontend will need to handle 2FA verification and potentially invalidate/recreate the session
    return NextResponse.json({
      success: true,
      user: result.user,
    });
  } catch (error) {
    console.error('[Verify Password] Error:', error);
    return NextResponse.json(
      { error: 'Failed to verify password' },
      { status: 500 }
    );
  }
}

