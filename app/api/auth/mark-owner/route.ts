import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { markAsOwner } from '@/lib/auth/owner-helpers';
import { db } from '@/lib/db';
import { user as betterAuthUser } from '@/auth-schema';

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

    // Check if this user is the only user (first user scenario)
    // After sign-up, there will be 1 user, so we check if count = 1
    
    const allUsers = await db
      .select({ id: betterAuthUser.id })
      .from(betterAuthUser);
    
    // If there's only one user and it's the current user, mark as owner
    if (allUsers.length === 1 && allUsers[0].id === userId) {
      // Mark as owner
      await markAsOwner(userId);
      
      return NextResponse.json({
        success: true,
        isOwner: true,
        message: 'Account created successfully. You are now the application owner.',
      });
    }
    
    // Not the first/only user - return success but don't mark as owner
    return NextResponse.json({
      success: true,
      isOwner: false,
      message: 'User account created successfully',
    });
  } catch (error) {
    console.error('Error marking owner:', error);
    return NextResponse.json(
      { error: 'Failed to mark owner' },
      { status: 500 }
    );
  }
}

