#!/usr/bin/env node

/**
 * Create test backups for multiple households to verify isolation
 */

import Database from 'better-sqlite3';
import { join } from 'path';

// Import the backup creation function
const { createUserBackup } = await import('../lib/backups/create-backup.ts');

const dbPath = join(process.cwd(), 'sqlite.db');
const db = new Database(dbPath);

console.log('🧪 Creating Test Backups for Household Isolation\n');

// Get user with multiple households
const user = db.prepare('SELECT id FROM user LIMIT 1').get();
if (!user) {
  console.error('❌ No users found');
  process.exit(1);
}

const userId = user.id;
console.log(`✅ Using user: ${userId}`);

// Get households
const households = db
  .prepare(`
    SELECT h.id, h.name
    FROM households h
    INNER JOIN household_members hm ON h.id = hm.household_id
    WHERE hm.user_id = ? AND hm.is_active = 1
    ORDER BY hm.joined_at ASC
    LIMIT 2
  `)
  .all(userId);

if (households.length < 2) {
  console.error('❌ User needs at least 2 households');
  process.exit(1);
}

const household1 = households[0];
const household2 = households[1];

console.log(`✅ Household 1: ${household1.id} (${household1.name})`);
console.log(`✅ Household 2: ${household2.id} (${household2.name})\n`);

// Create backups
console.log('📋 Creating backup for household 1...');
try {
  const result1 = await createUserBackup(userId, household1.id);
  if (result1.success) {
    console.log(`   ✅ Backup created: ${result1.backupId}`);
  } else {
    console.error(`   ❌ Failed: ${result1.error}`);
  }
} catch (error) {
  console.error(`   ❌ Error: ${error.message}`);
}

console.log('\n📋 Creating backup for household 2...');
try {
  const result2 = await createUserBackup(userId, household2.id);
  if (result2.success) {
    console.log(`   ✅ Backup created: ${result2.backupId}`);
  } else {
    console.error(`   ❌ Failed: ${result2.error}`);
  }
} catch (error) {
  console.error(`   ❌ Error: ${error.message}`);
}

db.close();
console.log('\n✅ Done!\n');

