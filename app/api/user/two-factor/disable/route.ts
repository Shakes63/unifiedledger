import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { user } from '@/auth-schema';
import { eq } from 'drizzle-orm';
import { verifyTwoFactorToken, verifyBackupCode } from '@/lib/auth/two-factor-utils';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token } = await request.json();

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: '2FA verification code is required to disable two-factor authentication' },
        { status: 400 }
      );
    }

    const userId = session.user.id;

    // Get user
    const [currentUser] = await db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!currentUser.twoFactorEnabled) {
      return NextResponse.json(
        { error: 'Two-factor authentication is not enabled' },
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
              })
              .where(eq(user.id, userId));
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

    // Disable 2FA and clear secrets
    await db
      .update(user)
      .set({
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
        twoFactorVerifiedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

    return NextResponse.json({
      success: true,
      message: 'Two-factor authentication disabled successfully',
    });
  } catch (error) {
    console.error('[2FA Disable] Error:', error);
    return NextResponse.json(
      { error: 'Failed to disable two-factor authentication' },
      { status: 500 }
    );
  }
}

