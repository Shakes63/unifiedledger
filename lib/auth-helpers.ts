import { auth } from '@/lib/better-auth';
import { headers } from 'next/headers';
import { isTestMode, getTestUser, logTestModeWarning } from '@/lib/test-mode';

/**
 * Get session and user from Better Auth
 * Use in API routes where authentication is optional
 * @returns User data if authenticated, null otherwise
 */
export async function getAuthUser() {
  // Test mode bypass - return test user without session validation
  if (isTestMode()) {
    logTestModeWarning('getAuthUser');
    return getTestUser();
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) return null;

  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    session: session.session,
  };
}

/**
 * Require authentication (throw if not authenticated)
 * Use in API routes that require authentication
 * @throws Error with message 'Unauthorized' if not authenticated
 * @returns User data
 */
export async function requireAuth() {
  // Test mode bypass - return test user without session validation
  if (isTestMode()) {
    logTestModeWarning('requireAuth');
    return getTestUser();
  }

  const user = await getAuthUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  return user;
}

/**
 * Type for the authenticated user returned by auth helpers
 */
export type AuthUser = NonNullable<Awaited<ReturnType<typeof getAuthUser>>>;
