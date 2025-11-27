/**
 * Resend Email Verification API Endpoint
 *
 * POST /api/user/resend-verification
 *
 * Allows users to request a new verification email if they:
 * - Didn't receive the original email
 * - The verification link expired
 * - Need to verify their email address
 *
 * Rate limited to prevent abuse (max 3 requests per hour per user)
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { user as userSchema, verification } from '@/auth-schema';
import { eq } from 'drizzle-orm';
import { sendVerificationEmail } from '@/lib/email/email-service';
import { getAppUrl } from '@/lib/email/email-config';
import { nanoid } from 'nanoid';

// Rate limiting: Track verification email requests per user
const verificationRequests = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const maxRequests = 3;

  const userRequests = verificationRequests.get(userId);

  if (!userRequests || now > userRequests.resetAt) {
    // Reset or initialize
    verificationRequests.set(userId, { count: 1, resetAt: now + oneHour });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (userRequests.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  userRequests.count++;
  return { allowed: true, remaining: maxRequests - userRequests.count };
}

export async function POST() {
  try {
    // Authenticate user
    const authUser = await requireAuth();

    // Get full user data from database
    const users = await db
      .select()
      .from(userSchema)
      .where(eq(userSchema.id, authUser.userId))
      .limit(1);

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = users[0];

    // Check if email is already verified
    if (user.emailVerified) {
      return NextResponse.json(
        { error: 'Email already verified' },
        { status: 400 }
      );
    }

    // Check rate limiting
    const rateLimit = checkRateLimit(user.id);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Too many requests. Please try again in an hour.',
          remaining: rateLimit.remaining,
        },
        { status: 429 }
      );
    }

    // Generate new verification token
    const token = nanoid(32);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Delete any existing verification tokens for this user
    await db
      .delete(verification)
      .where(eq(verification.identifier, user.email));

    // Create new verification token
    await db.insert(verification).values({
      id: nanoid(),
      identifier: user.email,
      value: token,
      expiresAt: expiresAt,
    });

    // Build verification URL
    const appUrl = getAppUrl();
    const verificationUrl = `${appUrl}/api/better-auth/verify-email?token=${token}&email=${encodeURIComponent(user.email)}`;

    // Send verification email
    await sendVerificationEmail({
      to: user.email,
      userName: user.name,
      verificationUrl,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Verification email sent successfully',
        remaining: rateLimit.remaining,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Resend Verification] Error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to send verification email' },
      { status: 500 }
    );
  }
}
