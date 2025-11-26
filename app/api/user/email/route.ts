import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { user as betterAuthUser, account as betterAuthAccount } from '@/auth-schema';
import { eq, and } from 'drizzle-orm';
import { sendEmailChangeVerification } from '@/lib/email/email-service';
import { verification as verificationTable } from '@/auth-schema';
import { randomBytes } from 'crypto';
import { verifyPassword } from '@/lib/auth/password-utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/user/email
 * Request email change with verification
 * Body: { newEmail, password }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const { newEmail, password } = body;

    // Validate inputs
    if (!newEmail || typeof newEmail !== 'string') {
      return NextResponse.json({ error: 'New email is required' }, { status: 400 });
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Password is required for email change' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Get current user
    const currentUser = await db
      .select()
      .from(betterAuthUser)
      .where(eq(betterAuthUser.id, userId))
      .limit(1);

    if (!currentUser || currentUser.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = currentUser[0];

    // Check if new email is same as current
    if (newEmail.toLowerCase() === user.email.toLowerCase()) {
      return NextResponse.json({ error: 'New email is the same as current email' }, { status: 400 });
    }

    // Check if email is already taken by another user
    const existingUser = await db
      .select()
      .from(betterAuthUser)
      .where(eq(betterAuthUser.email, newEmail.toLowerCase()))
      .limit(1);

    if (existingUser && existingUser.length > 0 && existingUser[0].id !== userId) {
      return NextResponse.json({ error: 'Email is already in use' }, { status: 409 });
    }

    // Verify password by checking if account exists with password
    // Better Auth stores password in the account table with providerId = 'credential'
    const account = await db
      .select()
      .from(betterAuthAccount)
      .where(
        and(
          eq(betterAuthAccount.userId, userId),
          eq(betterAuthAccount.providerId, 'credential')
        )
      )
      .limit(1);

    if (!account || account.length === 0 || !account[0].password) {
      return NextResponse.json(
        { error: 'No password account found. You may have signed up with OAuth.' },
        { status: 400 }
      );
    }

    // Verify password using bcrypt
    const isValidPassword = await verifyPassword(password, account[0].password);
    
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Password is incorrect' },
        { status: 401 }
      );
    }

    // Store pending email change
    await db
      .update(betterAuthUser)
      .set({
        pendingEmail: newEmail.toLowerCase(),
        updatedAt: new Date(),
      })
      .where(eq(betterAuthUser.id, userId));

    // Generate verification token
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store verification token
    await db.insert(verificationTable).values({
      id: randomBytes(16).toString('base64url'),
      identifier: `email-change:${userId}`,
      value: token,
      expiresAt: expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Generate verification URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const verificationUrl = `${baseUrl}/api/auth/verify-email-change?token=${token}`;

    // Send verification email to NEW email address
    try {
      await sendEmailChangeVerification({
        to: newEmail.toLowerCase(),
        userName: user.name,
        verificationUrl,
        oldEmail: user.email,
      });
    } catch (emailError) {
      console.error('Failed to send email change verification:', emailError);
      // Rollback pending email change
      await db
        .update(betterAuthUser)
        .set({
          pendingEmail: null,
          updatedAt: new Date(),
        })
        .where(eq(betterAuthUser.id, userId));

      return NextResponse.json(
        { error: 'Failed to send verification email. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Verification email sent to new address. Please check your inbox.',
      pendingEmail: newEmail.toLowerCase(),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to update email:', error);
    return NextResponse.json({ error: 'Failed to update email' }, { status: 500 });
  }
}
