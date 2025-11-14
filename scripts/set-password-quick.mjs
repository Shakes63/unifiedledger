/**
 * Quick Password Set Script
 * Sets password for shakes.neudorf@gmail.com to "Subject3!"
 */

import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
import Database from 'better-sqlite3';

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

async function setPassword() {
  try {
    const db = new Database('sqlite.db');

    console.log('Hashing password...');
    const hashedPassword = await hashPassword('Subject3!');

    console.log('Updating database...');
    const result = db.prepare(`
      UPDATE account
      SET password = ?, updated_at = ?
      WHERE user_id = ? AND provider_id = 'credential'
    `).run(hashedPassword, Date.now(), 'KEWU5S1fbpia8KEIM4oKdln0PtVGS4yh');

    if (result.changes === 0) {
      console.error('❌ No account found or updated');
      process.exit(1);
    }

    console.log('✅ Password set successfully!');
    console.log('\nCredentials:');
    console.log('Email: shakes.neudorf@gmail.com');
    console.log('Password: Subject3!');
    console.log('\nYou can now sign in at http://localhost:3000/sign-in');

    db.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

setPassword();
