/**
 * Password Set Script using bcrypt (Better Auth compatible)
 */

import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';

async function setPassword() {
  try {
    const db = new Database('sqlite.db');

    console.log('Hashing password with bcrypt...');
    // Better Auth uses bcrypt with 10 rounds by default
    const hashedPassword = await bcrypt.hash('Subject3!', 10);

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

    console.log('✅ Password set successfully with bcrypt!');
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
