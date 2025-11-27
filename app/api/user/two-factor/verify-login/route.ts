import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { user } from '@/auth-schema';
import { eq } from 'drizzle-orm';
import { verifyTwoFactorToken, verifyBackupCode } from '@/lib/auth/two-factor-utils';
import crypto from 'crypto';

/**
 * POST /api/user/two-factor/verify-login
 * Verify 2FA code during login flow
 * This endpoint is called after password verification but before session creation
 */
export async function POST(request: NextRequest) {
  try {
    const { email, token } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Verification code is required' }, { status: 400 });
    }

    // Get user by email
    const [currentUser] = await db
      .select()
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!currentUser.twoFactorEnabled) {
      return NextResponse.json(
        { error: 'Two-factor authentication is not enabled for this account' },
        { status: 400 }
      );
    }

    if (!currentUser.twoFactorSecret) {
      return NextResponse.json(
        { error: 'Two-factor authentication secret not found' },
        { status: 400 }
      );
    }

    // Verify the token (either TOTP code or backup code)
    let isValid = verifyTwoFactorToken(token, currentUser.twoFactorSecret);

    // If TOTP verification failed, try backup codes
    if (!isValid && currentUser.twoFactorBackupCodes) {
      try {
        const backupCodes = JSON.parse(currentUser.twoFactorBackupCodes as string);
        if (Array.isArray(backupCodes)) {
          isValid = verifyBackupCode(token, backupCodes);

          // If backup code was used, remove it
          if (isValid) {
            const updatedCodes = backupCodes.filter(
              (hash: string) => hash !== crypto.createHash('sha256').update(token.toUpperCase()).digest('hex')
            );
            await db
              .update(user)
              .set({
                twoFactorBackupCodes: JSON.stringify(updatedCodes),
                updatedAt: new Date(),
              })
              .where(eq(user.id, currentUser.id));
          }
        }
      } catch (_error) {
        // Invalid backup codes format, continue with TOTP only
      }
    }

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // Return success - the caller will complete the login
    return NextResponse.json({
      success: true,
      userId: currentUser.id,
      message: 'Two-factor authentication verified successfully',
    });
  } catch (error) {
    console.error('[2FA Verify Login] Error:', error);
    return NextResponse.json(
      { error: 'Failed to verify two-factor authentication' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/user/two-factor/check-required
 * Check if 2FA is required for a user (called after password verification)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Get user by email
    const [currentUser] = await db
      .select({
        id: user.id,
        email: user.email,
        twoFactorEnabled: user.twoFactorEnabled,
      })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      required: currentUser.twoFactorEnabled || false,
      userId: currentUser.id,
    });
  } catch (error) {
    console.error('[2FA Check Required] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check two-factor authentication requirement' },
      { status: 500 }
    );
  }
}

