/**
 * Test Mode Utility Module
 *
 * Provides utilities for enabling a test mode that bypasses authentication.
 * When TEST_MODE=true is set in environment variables:
 * - Authentication is bypassed
 * - A single test admin user is auto-created
 * - No login is required to access the app
 *
 * WARNING: Only use for development/testing, never in production!
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/** Test user ID - predictable for easy identification */
export const TEST_USER_ID = 'test-user-001';

/** Test user email */
export const TEST_USER_EMAIL = 'test@unifiedledger.local';

/** Test user display name */
export const TEST_USER_NAME = 'Test Admin';

/** Test household ID - predictable for easy identification */
export const TEST_HOUSEHOLD_ID = 'test-household-001';

/** Test household name */
export const TEST_HOUSEHOLD_NAME = 'Test Household';

/** Test session token for cookie validation */
export const TEST_SESSION_TOKEN = 'test-session-token-001';

/** Test session ID */
export const TEST_SESSION_ID = 'test-session-001';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if test mode is enabled via environment variable
 *
 * TEST_MODE bypasses ALL authentication, owner, and household-membership checks
 * (see requireAuth/requireOwner/isMemberOfHousehold and proxy.ts). It must never
 * be active in a production build. This is the single chokepoint every consumer
 * routes through, so the production guard here fails the whole app closed rather
 * than silently disabling auth (audit finding M-SEC-10).
 *
 * @returns true if TEST_MODE is set to 'true' (non-production only)
 * @throws if TEST_MODE is 'true' while NODE_ENV is 'production'
 */
export function isTestMode(): boolean {
  const enabled = process.env.TEST_MODE === 'true';
  if (enabled && process.env.NODE_ENV === 'production') {
    throw new Error(
      'TEST_MODE=true is not permitted when NODE_ENV=production: it disables all ' +
        'authentication. Unset TEST_MODE or use a non-production build.'
    );
  }
  return enabled;
}

/**
 * Get test user object matching the AuthUser type from auth-helpers.ts
 *
 * This is the user object returned by getAuthUser() and requireAuth()
 * when test mode is enabled.
 *
 * @returns Test user object with userId, email, name, and session
 */
export function getTestUser() {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

  return {
    userId: TEST_USER_ID,
    email: TEST_USER_EMAIL,
    name: TEST_USER_NAME,
    session: {
      id: TEST_SESSION_ID,
      token: TEST_SESSION_TOKEN,
      userId: TEST_USER_ID,
      expiresAt,
      createdAt: now,
      updatedAt: now,
      ipAddress: null,
      userAgent: null,
      city: null,
      region: null,
      country: null,
      countryCode: null,
      lastActivityAt: now,
      rememberMe: true,
    },
  };
}

/**
 * Log a warning message when test mode is active
 *
 * Used to make it clear in server logs when authentication is bypassed.
 *
 * @param context - Description of where the bypass occurred (e.g., "middleware", "requireAuth")
 */
export function logTestModeWarning(context: string): void {
  console.warn(`[TEST MODE] Auth bypassed in ${context}`);
}

/**
 * Get test mode status for client-side checks
 *
 * This is a safe way to check test mode status that can be used
 * in both server and client components.
 *
 * Note: Client components should use the /api/test-mode/status endpoint
 * instead of directly checking process.env
 *
 * @returns Object with testMode boolean
 */
export function getTestModeStatus(): { testMode: boolean } {
  return {
    testMode: isTestMode(),
  };
}

