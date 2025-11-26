import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { betterAuthAccount } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  performUserDataReset,
  checkResetRateLimit,
} from '@/lib/reset-utils';
import { MAX_RESET_ATTEMPTS_PER_DAY } from '@/lib/constants/default-settings';
import { verifyPassword } from '@/lib/auth/password-utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/user/reset-app-data
 * Reset user app settings and cached data (preserves financial data)
 * Body: { password, confirm }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const { password, confirm } = body;

    // Validate confirmation
    if (confirm !== true) {
      return NextResponse.json(
        { error: 'You must confirm this action' },
        { status: 400 }
      );
    }

    // Validate password is provided
    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Password is required to reset app data' },
        { status: 400 }
      );
    }

    // Check rate limiting
    const rateLimitExceeded = await checkResetRateLimit(
      userId,
      MAX_RESET_ATTEMPTS_PER_DAY
    );

    if (rateLimitExceeded) {
      return NextResponse.json(
        {
          error: `Too many reset attempts. You can reset app data up to ${MAX_RESET_ATTEMPTS_PER_DAY} times per day. Please try again later.`,
        },
        { status: 429 }
      );
    }

    // Verify password by checking if account exists with password
    // Better Auth stores password in the account table with providerId = 'credential'
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
        { error: 'No password account found. You may have signed up with OAuth.' },
        { status: 400 }
      );
    }

    // Verify password using bcrypt
    const isValidPassword = await verifyPassword(password, account[0].password);
    
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Password is incorrect' },
        { status: 401 }
      );
    }

    // Perform the reset in a transaction
    const result = await db.transaction(async () => {
      try {
        return await performUserDataReset(userId);
      } catch (error) {
        console.error('Error during reset transaction:', error);
        throw error;
      }
    });

    return NextResponse.json({
      success: true,
      message: 'App data reset successfully. You will be logged out shortly.',
      settingsReset: result.settingsReset,
      preferencesReset: result.preferencesReset,
      clearedCounts: result.clearedCounts,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to reset app data:', error);
    return NextResponse.json(
      { error: 'Failed to reset app data. Please try again.' },
      { status: 500 }
    );
  }
}
