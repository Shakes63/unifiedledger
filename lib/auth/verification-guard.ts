import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { user as betterAuthUser } from "@/auth-schema";
import { eq } from "drizzle-orm";

/**
 * Requires both authentication AND email verification
 * Use this for sensitive operations that require a verified email
 *
 * @throws Error if user is not authenticated or email is not verified
 * @returns Authenticated user with verified email
 */
export async function requireEmailVerification() {
  const authResult = await requireAuth();

  // Fetch user from database to check email verification status
  const userRecord = await db
    .select()
    .from(betterAuthUser)
    .where(eq(betterAuthUser.id, authResult.userId))
    .limit(1);

  if (!userRecord || userRecord.length === 0 || !userRecord[0].emailVerified) {
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
    
    // Fetch user from database to check email verification status
    const userRecord = await db
      .select()
      .from(betterAuthUser)
      .where(eq(betterAuthUser.id, authResult.userId))
      .limit(1);

    return userRecord?.[0]?.emailVerified ?? false;
  } catch {
    return false;
  }
}
