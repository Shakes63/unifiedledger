import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { user } from '@/auth-schema';
import { eq } from 'drizzle-orm';
import {
  verifyTwoFactorToken,
  generateBackupCodes,
} from '@/lib/auth/two-factor-utils';

export async function POST(request: NextRequest) {
  try {
    const authUser = await requireAuth();
    const userId = authUser.userId;

    const { token } = await request.json();

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      );
    }

    // Get user with secret
    const [currentUser] = await db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!currentUser.twoFactorSecret) {
      return NextResponse.json(
        { error: 'Two-factor authentication setup not started' },
        { status: 400 }
      );
    }

    if (currentUser.twoFactorEnabled) {
      return NextResponse.json(
        { error: 'Two-factor authentication is already enabled' },
        { status: 400 }
      );
    }

    // Verify the token
    const isValid = verifyTwoFactorToken(token, currentUser.twoFactorSecret);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // Generate backup codes
    const { plaintextCodes, hashedCodes } = generateBackupCodes(8);

    // Enable 2FA and store backup codes
    await db
      .update(user)
      .set({
        twoFactorEnabled: true,
        twoFactorBackupCodes: JSON.stringify(hashedCodes),
        twoFactorVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

    return NextResponse.json({
      success: true,
      backupCodes: plaintextCodes, // Only return plaintext codes once
      message: 'Two-factor authentication enabled successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[2FA Verify] Error:', error);
    return NextResponse.json(
      { error: 'Failed to verify two-factor authentication' },
      { status: 500 }
    );
  }
}

