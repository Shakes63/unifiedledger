import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { betterAuthAccount } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyPassword, hashPassword } from '@/lib/auth/password-utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/user/password
 * Change user password
 * Body: { currentPassword, newPassword, confirmPassword }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const { currentPassword, newPassword, confirmPassword } = body;

    // Validate inputs
    if (!currentPassword || typeof currentPassword !== 'string') {
      return NextResponse.json({ error: 'Current password is required' }, { status: 400 });
    }

    if (!newPassword || typeof newPassword !== 'string') {
      return NextResponse.json({ error: 'New password is required' }, { status: 400 });
    }

    if (!confirmPassword || typeof confirmPassword !== 'string') {
      return NextResponse.json({ error: 'Password confirmation is required' }, { status: 400 });
    }

    // Validate new password meets requirements
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Check if new password matches confirmation
    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: 'New password and confirmation do not match' },
        { status: 400 }
      );
    }

    // Check if new password is different from current password
    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: 'New password must be different from current password' },
        { status: 400 }
      );
    }

    // Get user's credential account with password hash
    const accounts = await db
      .select()
      .from(betterAuthAccount)
      .where(
        and(
          eq(betterAuthAccount.userId, userId),
          eq(betterAuthAccount.providerId, 'credential')
        )
      )
      .limit(1);

    if (!accounts || accounts.length === 0 || !accounts[0].password) {
      return NextResponse.json(
        { error: 'No password account found. You may have signed up with OAuth.' },
        { status: 400 }
      );
    }

    const account = accounts[0];
    const storedPassword = account.password;

    // Verify current password
    if (!storedPassword) {
      return NextResponse.json(
        { error: 'No password found for this account' },
        { status: 400 }
      );
    }

    const isValidPassword = await verifyPassword(currentPassword, storedPassword);
    
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 401 }
      );
    }

    // Hash new password
    const newHashedPassword = await hashPassword(newPassword);

    // Update password in database
    await db
      .update(betterAuthAccount)
      .set({
        password: newHashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(betterAuthAccount.id, account.id));

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to change password:', error);
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
}
