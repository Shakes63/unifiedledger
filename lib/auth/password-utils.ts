/**
 * Password Utilities for Better Auth
 * 
 * Better Auth uses bcryptjs for password hashing with 10 rounds.
 * These utilities provide password verification and hashing functions
 * for use in API routes that require password confirmation.
 */

import bcrypt from 'bcryptjs';

/**
 * Verify a plaintext password against a bcrypt hash
 * 
 * @param plainPassword - The plaintext password to verify
 * @param hashedPassword - The bcrypt hash from the database
 * @returns Promise<boolean> - True if password matches, false otherwise
 */
export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(plainPassword, hashedPassword);
  } catch (error) {
    console.error('[Password Utils] Error verifying password:', error);
    return false;
  }
}

/**
 * Hash a plaintext password using bcrypt
 * Uses 10 rounds (Better Auth default)
 * 
 * @param plainPassword - The plaintext password to hash
 * @returns Promise<string> - The bcrypt hash
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  // Better Auth uses 10 rounds by default
  const BCRYPT_ROUNDS = 10;
  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
}

/**
 * Get user's credential account with password hash from database
 * 
 * @param db - Drizzle database instance
 * @param userId - The user ID to look up
 * @returns The credential account or null if not found
 */
export async function getCredentialAccount(
  db: any,
  betterAuthAccount: any,
  userId: string
) {
  const { eq, and } = await import('drizzle-orm');
  
  const accounts = await db
    .select()
    .from(betterAuthAccount)
    .where(
      and(
        eq(betterAuthAccount.userId, userId),
        eq(betterAuthAccount.providerId, 'credential')
      )
    )
    .limit(1);

  if (!accounts || accounts.length === 0) {
    return null;
  }

  return accounts[0];
}

