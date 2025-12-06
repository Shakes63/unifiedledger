import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { user } from '@/auth-schema';
import { eq } from 'drizzle-orm';
import { generateTwoFactorSecret, generateQRCode } from '@/lib/auth/two-factor-utils';

export async function POST() {
  try {
    const authUser = await requireAuth();
    const userId = authUser.userId;

    // Check if 2FA is already enabled
    const [currentUser] = await db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (currentUser.twoFactorEnabled) {
      return NextResponse.json(
        { error: 'Two-factor authentication is already enabled' },
        { status: 400 }
      );
    }

    // Generate new secret
    const { secret, otpauthUrl } = generateTwoFactorSecret(
      currentUser.email,
      'Unified Ledger'
    );

    // Generate QR code
    const qrCodeDataUrl = await generateQRCode(otpauthUrl);

    // Store secret temporarily (user hasn't verified yet)
    await db
      .update(user)
      .set({
        twoFactorSecret: secret,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

    return NextResponse.json({
      secret,
      qrCode: qrCodeDataUrl,
      otpauthUrl,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[2FA Enable] Error:', error);
    return NextResponse.json(
      { error: 'Failed to enable two-factor authentication' },
      { status: 500 }
    );
  }
}

