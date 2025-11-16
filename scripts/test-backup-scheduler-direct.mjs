/**
 * Direct Test of Backup Scheduler
 * 
 * This script tests the backup scheduler function directly (bypassing HTTP endpoint).
 * Useful for testing without needing CRON_SECRET or server running.
 * 
 * Usage:
 *   node scripts/test-backup-scheduler-direct.mjs
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';

// Import the scheduler function directly
// Note: This requires the TypeScript to be compiled or we use a workaround
const DB_PATH = join(process.cwd(), 'sqlite.db');

async function testSchedulerDirect() {
  console.log('🧪 Direct Backup Scheduler Test\n');
  console.log('='.repeat(50));

  const db = new Database(DB_PATH);

  try {
    // Step 1: Get test user
    console.log('\n1️⃣ Finding test user...');
    const testUser = db.prepare('SELECT id FROM user LIMIT 1').get();
    
    if (!testUser) {
      console.log('❌ No users found. Please create a user first.');
      db.close();
      return;
    }

    const userId = testUser.id;
    console.log(`✅ Found user: ${userId}`);

    // Step 2: Ensure backup settings exist and are configured
    console.log('\n2️⃣ Configuring backup settings...');
    let backupSettings = db
      .prepare('SELECT * FROM backup_settings WHERE user_id = ?')
      .get(userId);

    if (!backupSettings) {
      const { v4: uuidv4 } = await import('uuid');
      const settingsId = uuidv4();
      const now = new Date().toISOString();
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      db.prepare(`
        INSERT INTO backup_settings (
          id, user_id, enabled, frequency, format, retention_count, 
          email_backups, last_backup_at, next_backup_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        settingsId,
        userId,
        1, // enabled
        'daily',
        'json',
        10,
        0,
        null,
        pastDate,
        now,
        now
      );

      backupSettings = db
        .prepare('SELECT * FROM backup_settings WHERE user_id = ?')
        .get(userId);
      console.log('✅ Created backup settings');
    } else {
      // Update to trigger backup
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      db.prepare(`
        UPDATE backup_settings 
        SET enabled = 1, next_backup_at = ?, updated_at = ?
        WHERE user_id = ?
      `).run(pastDate, new Date().toISOString(), userId);
      console.log('✅ Updated backup settings');
    }

    // Step 3: Count backups before
    const backupsBefore = db
      .prepare('SELECT COUNT(*) as count FROM backup_history WHERE user_id = ?')
      .get(userId);
    console.log(`\n📊 Before: ${backupsBefore.count} backups`);

    // Step 4: Call the scheduler function directly via HTTP
    // Since we can't easily import TypeScript, we'll make an HTTP call
    // but first check if server is running
    console.log('\n3️⃣ Testing scheduler function...');
    console.log('   Note: This requires the server to be running.');
    
    // Try to call the endpoint
    const CRON_SECRET = process.env.CRON_SECRET || 'test-secret-change-me';
    const API_URL = process.env.API_URL || 'http://localhost:3000';
    
    try {
      const response = await fetch(`${API_URL}/api/cron/backups`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CRON_SECRET}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.log(`\n⚠️  Authentication failed. CRON_SECRET may not match.`);
          console.log(`   Set CRON_SECRET environment variable when starting server:`);
          console.log(`   CRON_SECRET=${CRON_SECRET} pnpm dev`);
        } else {
          const errorText = await response.text();
          console.log(`\n❌ Error ${response.status}: ${errorText}`);
        }
        db.close();
        return;
      }

      const result = await response.json();
      console.log('\n✅ Scheduler executed successfully!');
      console.log(JSON.stringify(result, null, 2));

      // Step 5: Verify results
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for DB writes

      const backupsAfter = db
        .prepare('SELECT COUNT(*) as count FROM backup_history WHERE user_id = ?')
        .get(userId);
      
      const settingsAfter = db
        .prepare('SELECT * FROM backup_settings WHERE user_id = ?')
        .get(userId);

      const latestBackup = db
        .prepare('SELECT * FROM backup_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 1')
        .get(userId);

      console.log(`\n📊 After: ${backupsAfter.count} backups`);
      console.log(`   Last Backup: ${settingsAfter?.last_backup_at || 'N/A'}`);
      console.log(`   Next Backup: ${settingsAfter?.next_backup_at || 'N/A'}`);

      if (latestBackup) {
        console.log(`\n📁 Latest Backup:`);
        console.log(`   Status: ${latestBackup.status}`);
        console.log(`   Filename: ${latestBackup.filename}`);
        console.log(`   Size: ${latestBackup.file_size} bytes`);
        if (latestBackup.error_message) {
          console.log(`   ⚠️  Error: ${latestBackup.error_message}`);
        }
      }

      // Check file system
      const { existsSync, readdirSync } = await import('fs');
      const backupDir = join(process.cwd(), 'backups', userId);
      if (existsSync(backupDir)) {
        const files = readdirSync(backupDir);
        console.log(`\n📂 Backup Files: ${files.length} files`);
        if (files.length > 0) {
          files.slice(-3).forEach(file => console.log(`   - ${file}`));
        }
      }

      // Summary
      console.log(`\n${'='.repeat(50)}`);
      if (backupsAfter.count > backupsBefore.count) {
        console.log(`\n✅ SUCCESS: Backup created!`);
        console.log(`   Backups before: ${backupsBefore.count}`);
        console.log(`   Backups after: ${backupsAfter.count}`);
        console.log(`   Created: ${backupsAfter.count - backupsBefore.count} new backup(s)`);
      } else {
        console.log(`\nℹ️  No new backups created`);
        console.log(`   This may be expected if the scheduler found no users needing backups`);
      }

    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log(`\n❌ Server not running. Start it with:`);
        console.log(`   pnpm dev`);
        console.log(`\n   Or set CRON_SECRET and start:`);
        console.log(`   CRON_SECRET=${CRON_SECRET} pnpm dev`);
      } else {
        console.error(`\n❌ Error:`, error.message);
      }
    }

    db.close();

  } catch (error) {
    console.error('\n❌ Error:', error);
    db.close();
    throw error;
  }
}

testSchedulerDirect().catch(console.error);

