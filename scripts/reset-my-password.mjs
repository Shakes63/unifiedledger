import Database from 'better-sqlite3';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

async function resetPassword() {
  const email = 'shakes.neudorf@gmail.com';
  const newPassword = 'password123'; // Change this to your desired password

  const db = new Database('./sqlite.db');

  try {
    // Get user ID
    const user = db.prepare('SELECT id FROM user WHERE email = ?').get(email);

    if (!user) {
      console.error('User not found');
      process.exit(1);
    }

    console.log('Found user:', email);

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);
    console.log('Generated new password hash');

    // Update the password in the account table
    const result = db.prepare(
      'UPDATE account SET password = ? WHERE user_id = ? AND provider_id = ?'
    ).run(hashedPassword, user.id, 'credential');

    if (result.changes > 0) {
      console.log('✓ Password updated successfully!');
      console.log('Email:', email);
      console.log('New password:', newPassword);
      console.log('\nYou can now sign in with these credentials.');
    } else {
      console.error('Failed to update password');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    db.close();
  }
}

resetPassword();
