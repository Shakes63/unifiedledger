import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { user } from '@/auth-schema';
import { eq } from 'drizzle-orm';
import { generateBackupCodes } from '@/lib/auth/two-factor-utils';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Generate new backup codes (invalidates old ones)
    const { plaintextCodes, hashedCodes } = generateBackupCodes(8);

    // Update backup codes
    await db
      .update(user)
      .set({
        twoFactorBackupCodes: JSON.stringify(hashedCodes),
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

    return NextResponse.json({
      backupCodes: plaintextCodes, // Only return plaintext codes once
      message: 'New backup codes generated. Old codes are no longer valid.',
    });
  } catch (error) {
    console.error('[2FA Backup Codes] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate backup codes' },
      { status: 500 }
    );
  }
}

