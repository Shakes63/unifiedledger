/**
 * Call Backup Scheduler Endpoint
 * 
 * This script calls the backup scheduler cron endpoint and verifies results.
 * 
 * Usage:
 *   CRON_SECRET=your-secret node scripts/call-backup-scheduler.mjs
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';

const DB_PATH = join(process.cwd(), 'sqlite.db');
const CRON_SECRET = process.env.CRON_SECRET || 'test-secret-change-me';
const API_URL = process.env.API_URL || 'http://localhost:3000';

async function callBackupScheduler() {
  console.log('🚀 Calling Backup Scheduler Endpoint\n');
  console.log('='.repeat(50));

  try {
    // Step 1: Get user ID from database
    const db = new Database(DB_PATH);
    const testUser = db.prepare('SELECT id FROM user LIMIT 1').get();
    
    if (!testUser) {
      console.log('❌ No users found. Please run test-backup-scheduler.mjs first.');
      db.close();
      return;
    }

    const userId = testUser.id;
    
    // Get backup count before
    const backupsBefore = db
      .prepare('SELECT COUNT(*) as count FROM backup_history WHERE user_id = ?')
      .get(userId);
    
    const settingsBefore = db
      .prepare('SELECT * FROM backup_settings WHERE user_id = ?')
      .get(userId);

    console.log(`\n📊 Before:`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Backups: ${backupsBefore.count}`);
    console.log(`   Next Backup At: ${settingsBefore?.next_backup_at || 'N/A'}`);

    // Step 2: Call the endpoint
    console.log(`\n🌐 Calling ${API_URL}/api/cron/backups...`);
    
    const response = await fetch(`${API_URL}/api/cron/backups`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error(`\n❌ Error: ${response.status} ${response.statusText}`);
      console.error('Response:', JSON.stringify(responseData, null, 2));
      db.close();
      return;
    }

    console.log(`\n✅ Response (${response.status}):`);
    console.log(JSON.stringify(responseData, null, 2));

    // Step 3: Verify results
    console.log(`\n🔍 Verifying results...`);
    
    // Wait a moment for database writes to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    const backupsAfter = db
      .prepare('SELECT COUNT(*) as count FROM backup_history WHERE user_id = ?')
      .get(userId);
    
    const settingsAfter = db
      .prepare('SELECT * FROM backup_settings WHERE user_id = ?')
      .get(userId);

    const latestBackup = db
      .prepare('SELECT * FROM backup_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(userId);

    console.log(`\n📊 After:`);
    console.log(`   Backups: ${backupsAfter.count} (was ${backupsBefore.count})`);
    console.log(`   Last Backup At: ${settingsAfter?.last_backup_at || 'N/A'}`);
    console.log(`   Next Backup At: ${settingsAfter?.next_backup_at || 'N/A'}`);

    if (latestBackup) {
      console.log(`\n📁 Latest Backup:`);
      console.log(`   ID: ${latestBackup.id}`);
      console.log(`   Filename: ${latestBackup.filename}`);
      console.log(`   Status: ${latestBackup.status}`);
      console.log(`   Size: ${latestBackup.file_size} bytes`);
      console.log(`   Created: ${latestBackup.created_at}`);
      
      if (latestBackup.error_message) {
        console.log(`   ⚠️  Error: ${latestBackup.error_message}`);
      }
    }

    // Step 4: Check file system
    const { existsSync, readdirSync, statSync } = await import('fs');
    const backupDir = join(process.cwd(), 'backups', userId);
    
    if (existsSync(backupDir)) {
      const files = readdirSync(backupDir);
      console.log(`\n📂 Backup Directory: ${backupDir}`);
      console.log(`   Files: ${files.length}`);
      if (files.length > 0) {
        console.log(`   Latest files:`);
        for (const file of files.slice(-3)) {
          const filePath = join(backupDir, file);
          const stats = statSync(filePath);
          console.log(`     - ${file} (${stats.size} bytes)`);
        }
      }
    } else {
      console.log(`\n📂 Backup Directory: Does not exist yet`);
    }

    // Step 5: Summary
    console.log(`\n${'='.repeat(50)}`);
    console.log(`\n📋 Test Summary:`);
    console.log(`   ✅ Endpoint called successfully`);
    console.log(`   ✅ Backups created: ${responseData.summary?.backupsCreated || 0}`);
    console.log(`   ✅ Errors: ${responseData.summary?.errors || 0}`);
    
    if (responseData.summary?.errorDetails?.length > 0) {
      console.log(`\n   ⚠️  Error Details:`);
      responseData.summary.errorDetails.forEach((err) => {
        console.log(`      - User ${err.userId}: ${err.error}`);
      });
    }

    if (backupsAfter.count > backupsBefore.count) {
      console.log(`\n   ✅ SUCCESS: New backup created!`);
    } else if (responseData.summary?.backupsCreated === 0) {
      console.log(`\n   ℹ️  No backups created (may be expected if nextBackupAt is in future)`);
    }

    db.close();

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error(`\n❌ Connection refused. Is the server running?`);
      console.error(`   Start server with: pnpm dev`);
    } else {
      console.error(`\n❌ Error:`, error.message);
    }
    process.exit(1);
  }
}

callBackupScheduler().catch(console.error);

