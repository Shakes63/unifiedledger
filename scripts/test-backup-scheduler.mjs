/**
 * Manual Test Script for Backup Scheduler
 * 
 * This script helps test the backup scheduler by:
 * 1. Finding or creating a test user with backup settings
 * 2. Setting nextBackupAt to a past date
 * 3. Calling the cron endpoint to trigger backups
 * 4. Verifying results
 * 
 * Usage:
 *   node scripts/test-backup-scheduler.mjs
 * 
 * Prerequisites:
 *   - CRON_SECRET environment variable must be set
 *   - Server must be running (or use direct database access)
 */

import { join } from 'path';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = join(process.cwd(), 'sqlite.db');
const CRON_SECRET = process.env.CRON_SECRET || 'test-secret-change-me';

async function testBackupScheduler() {
  console.log('🧪 Backup Scheduler Manual Test\n');
  console.log('=' .repeat(50));

  // Step 1: Connect to database
  console.log('\n1️⃣ Connecting to database...');
  const db = new Database(DB_PATH);
  console.log('✅ Connected to database');

  try {
    // Step 2: Find or create a test user
    console.log('\n2️⃣ Finding test user...');
    let testUser = db.prepare('SELECT id FROM user LIMIT 1').get();
    
    if (!testUser) {
      console.log('⚠️  No users found. Please create a user first by signing up.');
      return;
    }

    const userId = testUser.id;
    console.log(`✅ Found user: ${userId}`);

    // Step 3: Check/create backup settings
    console.log('\n3️⃣ Checking backup settings...');
    let backupSettings = db
      .prepare('SELECT * FROM backup_settings WHERE user_id = ?')
      .get(userId);

    if (!backupSettings) {
      console.log('📝 Creating backup settings...');
      const settingsId = uuidv4();
      const now = new Date().toISOString();
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 1 day ago

      db.prepare(`
        INSERT INTO backup_settings (
          id, user_id, enabled, frequency, format, retention_count, 
          email_backups, last_backup_at, next_backup_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        settingsId,
        userId,
        1, // enabled = true
        'daily',
        'json',
        10,
        0, // emailBackups = false
        null, // lastBackupAt
        pastDate, // nextBackupAt = past date (triggers backup)
        now,
        now
      );

      backupSettings = db
        .prepare('SELECT * FROM backup_settings WHERE user_id = ?')
        .get(userId);
      console.log('✅ Created backup settings');
    } else {
      // Update nextBackupAt to past date to trigger backup
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      db.prepare(`
        UPDATE backup_settings 
        SET enabled = 1, next_backup_at = ?, updated_at = ?
        WHERE user_id = ?
      `).run(pastDate, new Date().toISOString(), userId);
      console.log('✅ Updated backup settings (enabled, nextBackupAt set to past)');
    }

    console.log('\n📋 Backup Settings:');
    console.log(`   Enabled: ${backupSettings.enabled ? 'Yes' : 'No'}`);
    console.log(`   Frequency: ${backupSettings.frequency}`);
    console.log(`   Format: ${backupSettings.format}`);
    console.log(`   Next Backup At: ${backupSettings.next_backup_at}`);

    // Step 4: Count existing backups
    console.log('\n4️⃣ Checking existing backups...');
    const existingBackups = db
      .prepare('SELECT COUNT(*) as count FROM backup_history WHERE user_id = ?')
      .get(userId);
    console.log(`   Existing backups: ${existingBackups.count}`);

    // Step 5: Call cron endpoint (simulate)
    console.log('\n5️⃣ Calling backup scheduler...');
    console.log('   Note: This requires the server to be running.');
    console.log(`   Endpoint: POST http://localhost:3000/api/cron/backups`);
    console.log(`   Authorization: Bearer ${CRON_SECRET.substring(0, 10)}...`);

    // Provide curl command for manual testing
    console.log('\n📝 To test manually, run:');
    console.log(`curl -X POST http://localhost:3000/api/cron/backups \\`);
    console.log(`  -H "Authorization: Bearer ${CRON_SECRET}" \\`);
    console.log(`  -H "Content-Type: application/json"`);

    // Step 6: Check results after a delay (if server is running)
    console.log('\n6️⃣ Verification Steps:');
    console.log('   After calling the endpoint, verify:');
    console.log('   1. Check backup_history table for new backup');
    console.log('   2. Check backups/{userId}/ directory for backup file');
    console.log('   3. Check backup_settings.next_backup_at was updated');
    console.log('   4. Check backup_settings.last_backup_at was updated');

    // Show SQL queries for verification
    console.log('\n📊 Verification Queries:');
    console.log('\n   -- Check backup history:');
    console.log(`   SELECT * FROM backup_history WHERE user_id = '${userId}' ORDER BY created_at DESC LIMIT 5;`);
    console.log('\n   -- Check backup settings:');
    console.log(`   SELECT enabled, frequency, last_backup_at, next_backup_at FROM backup_settings WHERE user_id = '${userId}';`);

    // Step 7: Check file system (if possible)
    console.log('\n7️⃣ File System Check:');
    const { existsSync } = await import('fs');
    const { join } = await import('path');
    const backupDir = join(process.cwd(), 'backups', userId);
    if (existsSync(backupDir)) {
      const { readdirSync } = await import('fs');
      const files = readdirSync(backupDir);
      console.log(`   Backup directory exists: ${backupDir}`);
      console.log(`   Files: ${files.length}`);
      if (files.length > 0) {
        console.log(`   Latest files:`);
        files.slice(-3).forEach(file => console.log(`     - ${file}`));
      }
    } else {
      console.log(`   Backup directory does not exist yet: ${backupDir}`);
      console.log('   (Will be created when first backup runs)');
    }

    console.log('\n' + '='.repeat(50));
    console.log('\n✅ Test setup complete!');
    console.log('\nNext steps:');
    console.log('1. Make sure your server is running (pnpm dev)');
    console.log('2. Run the curl command above or use Postman/Thunder Client');
    console.log('3. Check the verification queries to confirm backup was created');
    console.log('4. Check the UI at /dashboard/settings?section=household&tab=household-data');

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    db.close();
  }
}

// Run the test
testBackupScheduler().catch(console.error);

