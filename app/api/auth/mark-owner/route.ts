import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { isFirstUser, markAsOwner } from '@/lib/auth/owner-helpers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/mark-owner
 * Mark the current user as owner if they are the first user
 * Called after successful sign-up
 */
export async function POST() {
  try {
    const authResult = await auth.api.getSession({
      headers: await headers(),
    });

    if (!authResult?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = authResult.user.id;

    // Check if this is the first user
    const firstUser = await isFirstUser();
    
    if (!firstUser) {
      // Not the first user - return success but don't mark as owner
      return NextResponse.json({
        success: true,
        isOwner: false,
        message: 'User account created successfully',
      });
    }

    // Mark as owner
    await markAsOwner(userId);

    return NextResponse.json({
      success: true,
      isOwner: true,
      message: 'Account created successfully. You are now the application owner.',
    });
  } catch (error) {
    console.error('Error marking owner:', error);
    return NextResponse.json(
      { error: 'Failed to mark owner' },
      { status: 500 }
    );
  }
}

