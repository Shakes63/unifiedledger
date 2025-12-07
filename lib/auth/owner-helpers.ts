import { db } from '@/lib/db';
import { user as betterAuthUser } from '@/auth-schema';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { auth } from '@/auth';
import { isTestMode, TEST_USER_ID, logTestModeWarning } from '@/lib/test-mode';

/**
 * Check if the database has any users (first startup)
 */
export async function isFirstUser(): Promise<boolean> {
  try {
    const users = await db
      .select({ id: betterAuthUser.id })
      .from(betterAuthUser)
      .limit(1);
    
    return users.length === 0;
  } catch (error) {
    console.error('Error checking for first user:', error);
    // If there's an error, assume users exist (safer)
    return false;
  }
}

/**
 * Check if a user is the application owner
 */
export async function isApplicationOwner(userId: string): Promise<boolean> {
  try {
    const users = await db
      .select({ isApplicationOwner: betterAuthUser.isApplicationOwner })
      .from(betterAuthUser)
      .where(eq(betterAuthUser.id, userId))
      .limit(1);
    
    if (users.length === 0) {
      return false;
    }
    
    return users[0].isApplicationOwner === true;
  } catch (error) {
    console.error('Error checking owner status:', error);
    return false;
  }
}

/**
 * Mark a user as the application owner
 */
export async function markAsOwner(userId: string): Promise<void> {
  try {
    await db
      .update(betterAuthUser)
      .set({ isApplicationOwner: true })
      .where(eq(betterAuthUser.id, userId));
  } catch (error) {
    console.error('Error marking user as owner:', error);
    throw error;
  }
}

/**
 * Require owner access - throws error if user is not owner
 * Use in API routes to protect admin endpoints
 */
export async function requireOwner(): Promise<{ userId: string; isOwner: boolean }> {
  // Test mode bypass - test user is always owner
  if (isTestMode()) {
    logTestModeWarning('requireOwner');
    return { userId: TEST_USER_ID, isOwner: true };
  }

  try {
    const authResult = await auth.api.getSession({
      headers: await headers(),
    });

    if (!authResult?.user?.id) {
      throw new Error('Unauthorized');
    }

    const userId = authResult.user.id;
    const isOwner = await isApplicationOwner(userId);

    if (!isOwner) {
      throw new Error('Forbidden: Owner access required');
    }

    return { userId, isOwner: true };
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      throw new Error('Unauthorized');
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      throw new Error('Forbidden: Owner access required');
    }
    throw error;
  }
}

/**
 * Get the current user's owner status
 * Returns null if not authenticated
 */
export async function getCurrentUserOwnerStatus(): Promise<boolean | null> {
  // Test mode bypass - test user is always owner
  if (isTestMode()) {
    return true;
  }

  try {
    const authResult = await auth.api.getSession({
      headers: await headers(),
    });

    if (!authResult?.user?.id) {
      return null;
    }

    return await isApplicationOwner(authResult.user.id);
  } catch (error) {
    console.error('Error getting owner status:', error);
    return null;
  }
}

