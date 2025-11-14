import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verification as verificationTable, user as userTable } from '@/auth-schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/verify-email-change
 * Handle email change verification link clicks
 * Query params: { token }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      // Redirect to settings with error
      const redirectUrl = new URL('/dashboard/settings', request.url);
      redirectUrl.searchParams.set('tab', 'profile');
      redirectUrl.searchParams.set('error', 'invalid_token');
      return NextResponse.redirect(redirectUrl);
    }

    // Find verification record
    const verificationRecords = await db
      .select()
      .from(verificationTable)
      .where(eq(verificationTable.value, token))
      .limit(1);

    if (!verificationRecords || verificationRecords.length === 0) {
      // Redirect to settings with error
      const redirectUrl = new URL('/dashboard/settings', request.url);
      redirectUrl.searchParams.set('tab', 'profile');
      redirectUrl.searchParams.set('error', 'invalid_token');
      return NextResponse.redirect(redirectUrl);
    }

    const verification = verificationRecords[0];

    // Check if token is expired
    if (new Date(verification.expiresAt).getTime() < Date.now()) {
      // Delete expired token
      await db.delete(verificationTable).where(eq(verificationTable.id, verification.id));

      // Redirect to settings with error
      const redirectUrl = new URL('/dashboard/settings', request.url);
      redirectUrl.searchParams.set('tab', 'profile');
      redirectUrl.searchParams.set('error', 'token_expired');
      return NextResponse.redirect(redirectUrl);
    }

    // Extract user ID from identifier (format: "email-change:userId")
    const identifierParts = verification.identifier.split(':');
    if (identifierParts.length !== 2 || identifierParts[0] !== 'email-change') {
      // Invalid identifier format
      const redirectUrl = new URL('/dashboard/settings', request.url);
      redirectUrl.searchParams.set('tab', 'profile');
      redirectUrl.searchParams.set('error', 'invalid_token');
      return NextResponse.redirect(redirectUrl);
    }

    const userId = identifierParts[1];

    // Get user and verify they have a pending email change
    const userRecords = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

    if (!userRecords || userRecords.length === 0 || !userRecords[0].pendingEmail) {
      // Delete verification token
      await db.delete(verificationTable).where(eq(verificationTable.id, verification.id));

      // Redirect to settings with error
      const redirectUrl = new URL('/dashboard/settings', request.url);
      redirectUrl.searchParams.set('tab', 'profile');
      redirectUrl.searchParams.set('error', 'no_pending_change');
      return NextResponse.redirect(redirectUrl);
    }

    const user = userRecords[0];

    // Complete email change
    await db
      .update(userTable)
      .set({
        email: user.pendingEmail!, // Non-null assertion - we already checked it exists above
        pendingEmail: null,
        emailVerified: true, // Mark new email as verified
        updatedAt: new Date(),
      })
      .where(eq(userTable.id, userId));

    // Delete verification token (it's been used)
    await db.delete(verificationTable).where(eq(verificationTable.id, verification.id));

    // Redirect to email verification success page
    const redirectUrl = new URL('/email-verified', request.url);
    redirectUrl.searchParams.set('email_changed', 'true');
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Error verifying email change:', error);

    // Redirect to settings with error
    const redirectUrl = new URL('/dashboard/settings', request.url);
    redirectUrl.searchParams.set('tab', 'profile');
    redirectUrl.searchParams.set('error', 'verification_failed');
    return NextResponse.redirect(redirectUrl);
  }
}
