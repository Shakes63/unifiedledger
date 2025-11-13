import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { betterAuthAccount } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

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

    // Get user's account to verify password
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
        { error: 'No password account found. Please contact support.' },
        { status: 400 }
      );
    }

    // Note: For production, we need to:
    // 1. Verify currentPassword using Better Auth's password verification
    // 2. Hash newPassword using Better Auth's password hashing
    // For now, we're leaving a TODO and placeholder response
    // TODO: Implement proper password verification and hashing using Better Auth

    // This is a placeholder - in production, we would:
    // - Use Better Auth's internal password comparison
    // - Use Better Auth's internal password hashing
    // - Update the password in the account table

    // For now, return a message that this needs implementation
    return NextResponse.json({
      error: 'Password change functionality requires Better Auth integration. This feature is coming soon.',
      todo: 'Implement password verification and hashing using Better Auth methods',
    }, { status: 501 });

    // When implemented, it would look something like:
    // const isValid = await verifyPassword(currentPassword, account[0].password);
    // if (!isValid) {
    //   return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    // }
    // const hashedPassword = await hashPassword(newPassword);
    // await db.update(betterAuthAccount).set({ password: hashedPassword }).where(...);
    // return NextResponse.json({ success: true, message: 'Password changed successfully' });

  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to change password:', error);
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
}
