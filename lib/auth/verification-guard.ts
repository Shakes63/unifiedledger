import { requireAuth } from "@/lib/auth-helpers";

/**
 * Requires both authentication AND email verification
 * Use this for sensitive operations that require a verified email
 *
 * @throws Error if user is not authenticated or email is not verified
 * @returns Authenticated user with verified email
 */
export async function requireEmailVerification() {
  const authResult = await requireAuth();

  if (!authResult.user.emailVerified) {
    throw new Error("Email verification required for this operation");
  }

  return authResult;
}

/**
 * Checks if user's email is verified (non-throwing version)
 *
 * @returns true if user is authenticated and email is verified, false otherwise
 */
export async function isEmailVerified(): Promise<boolean> {
  try {
    const authResult = await requireAuth();
    return authResult.user.emailVerified ?? false;
  } catch {
    return false;
  }
}
