import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { user as betterAuthUser, account as betterAuthAccount } from '@/auth-schema';
import { eq, and } from 'drizzle-orm';
import { headers } from 'next/headers';

export async function POST(request: Request) {
  try {
    const authResult = await auth.api.getSession({
      headers: await headers(),
    });

    if (!authResult?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { password, confirmation } = body;

    // Validate confirmation text
    if (confirmation !== 'DELETE MY ACCOUNT') {
      return NextResponse.json(
        { error: 'Confirmation text must be exactly "DELETE MY ACCOUNT"' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    // Get user's credential account to verify password
    const account = await db
      .select()
      .from(betterAuthAccount)
      .where(
        and(
          eq(betterAuthAccount.userId, authResult.user.id),
          eq(betterAuthAccount.providerId, 'credential')
        )
      )
      .limit(1);

    if (!account || account.length === 0) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Verify password using Better Auth
    // We'll attempt to sign in with the provided password to verify it
    try {
      const email = authResult.user.email;
      if (!email) {
        return NextResponse.json(
          { error: 'User email not found' },
          { status: 400 }
        );
      }

      // Use Better Auth's signIn method to verify credentials
      const verifyResult = await auth.api.signInEmail({
        body: {
          email,
          password,
        },
      });

      // If sign-in fails, password is incorrect
      if (!verifyResult) {
        return NextResponse.json(
          { error: 'Invalid password' },
          { status: 401 }
        );
      }
    } catch (_verifyError) {
      // If verification fails, password is incorrect
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    // Password is verified, proceed with account deletion
    // Delete user (cascade will delete all related data via foreign key constraints)
    await db
      .delete(betterAuthUser)
      .where(eq(betterAuthUser.id, authResult.user.id));

    // Sign out user (this will invalidate the session)
    try {
      await auth.api.signOut({
        headers: await headers(),
      });
    } catch (signOutError) {
      // Session may already be invalid, continue
      console.log('Session already invalid or sign-out failed:', signOutError);
    }

    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    );
  }
}
