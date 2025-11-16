import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { user } from '@/auth-schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Get user
    const [currentUser] = await db
      .select({
        twoFactorEnabled: user.twoFactorEnabled,
        twoFactorVerifiedAt: user.twoFactorVerifiedAt,
        hasBackupCodes: user.twoFactorBackupCodes,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    // Count backup codes (if any)
    let backupCodesCount = 0;
    if (currentUser.hasBackupCodes) {
      try {
        const codes = JSON.parse(currentUser.hasBackupCodes as string);
        backupCodesCount = Array.isArray(codes) ? codes.length : 0;
      } catch {
        backupCodesCount = 0;
      }
    }

    return NextResponse.json({
      enabled: currentUser.twoFactorEnabled || false,
      verifiedAt: currentUser.twoFactorVerifiedAt
        ? new Date(currentUser.twoFactorVerifiedAt).toISOString()
        : null,
      backupCodesCount,
      isSetupComplete: currentUser.twoFactorEnabled && currentUser.twoFactorVerifiedAt !== null,
    });
  } catch (error) {
    console.error('[2FA Status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get two-factor authentication status' },
      { status: 500 }
    );
  }
}

