import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { user } from '@/auth-schema';
import { eq } from 'drizzle-orm';

/**
 * Check if a user has 2FA enabled (called during sign-in flow)
 * This endpoint doesn't require authentication since the user is not yet logged in
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Find user by email
    const [foundUser] = await db
      .select({
        twoFactorEnabled: user.twoFactorEnabled,
      })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (!foundUser) {
      // Don't reveal if user exists - return as if 2FA is not required
      return NextResponse.json({ required: false });
    }

    return NextResponse.json({
      required: foundUser.twoFactorEnabled || false,
    });
  } catch (error) {
    console.error('[2FA Check Required] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check two-factor authentication status' },
      { status: 500 }
    );
  }
}
