/**
 * Password Reset Script
 * Run with: npx tsx scripts/reset-password.ts
 */

import { db } from '../lib/db/index';
import { account } from '../auth-schema';
import { eq, and } from 'drizzle-orm';
import * as crypto from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(crypto.scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

async function resetPassword(email: string, newPassword: string) {
  try {
    console.log(`Resetting password for: ${email}`);

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);
    console.log('Password hashed');

    // Find the user's credential account
    const result = await db
      .update(account)
      .set({
        password: hashedPassword,
        updated_at: Date.now(),
      })
      .where(
        and(
          eq(account.account_id, email), // account_id is the email for credential provider
          eq(account.provider_id, 'credential')
        )
      )
      .returning();

    if (result.length === 0) {
      console.error('No credential account found for this email');
      process.exit(1);
    }

    console.log('✅ Password reset successfully!');
    console.log(`Email: ${email}`);
    console.log(`New password: ${newPassword}`);
    console.log('\nYou can now sign in with these credentials.');
  } catch (error) {
    console.error('Error resetting password:', error);
    process.exit(1);
  }
}

// Get email and password from command line
const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.error('Usage: npx tsx scripts/reset-password.ts <email> <new-password>');
  console.error('Example: npx tsx scripts/reset-password.ts user@example.com myNewPassword123');
  process.exit(1);
}

resetPassword(email, newPassword);
