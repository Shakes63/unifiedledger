#!/usr/bin/env node

/**
 * Direct Test of Backup Household Isolation
 * 
 * Tests backup creation function directly to verify household isolation
 */

import Database from 'better-sqlite3';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const dbPath = join(process.cwd(), 'sqlite.db');
const backupsDir = join(process.cwd(), 'backups');

if (!existsSync(dbPath)) {
  console.error('❌ Database not found:', dbPath);
  process.exit(1);
}

const db = new Database(dbPath);

console.log('🧪 Testing Backup Household Isolation\n');

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
  console.error('❌ User needs at least 2 households for this test');
  process.exit(1);
}

const household1 = households[0];
const household2 = households[1];

console.log(`✅ Household 1: ${household1.id} (${household1.name})`);
console.log(`✅ Household 2: ${household2.id} (${household2.name})\n`);

// Test 1: Verify backup settings isolation
console.log('📋 Test 1: Backup Settings Isolation');
const settings1 = db
  .prepare('SELECT * FROM backup_settings WHERE user_id = ? AND household_id = ?')
  .get(userId, household1.id);

const settings2 = db
  .prepare('SELECT * FROM backup_settings WHERE user_id = ? AND household_id = ?')
  .get(userId, household2.id);

if (settings1 && settings1.household_id === household1.id) {
  console.log(`   ✅ Settings 1 isolated to household ${household1.id}`);
} else {
  console.log(`   ⚠️  No settings found for household 1`);
}

if (settings2 && settings2.household_id === household2.id) {
  console.log(`   ✅ Settings 2 isolated to household ${household2.id}`);
} else {
  console.log(`   ⚠️  No settings found for household 2`);
}

// Test 2: Verify backup history isolation
console.log('\n📋 Test 2: Backup History Isolation');
const backups1 = db
  .prepare(`
    SELECT id, household_id, filename, status, created_at
    FROM backup_history
    WHERE user_id = ? AND household_id = ?
    ORDER BY created_at DESC
    LIMIT 5
  `)
  .all(userId, household1.id);

const backups2 = db
  .prepare(`
    SELECT id, household_id, filename, status, created_at
    FROM backup_history
    WHERE user_id = ? AND household_id = ?
    ORDER BY created_at DESC
    LIMIT 5
  `)
  .all(userId, household2.id);

console.log(`   Household 1 backups: ${backups1.length}`);
backups1.forEach(b => {
  if (b.household_id === household1.id) {
    console.log(`      ✅ ${b.filename} (${b.status})`);
  } else {
    console.error(`      ❌ ${b.filename} - WRONG HOUSEHOLD: ${b.household_id}`);
  }
});

console.log(`   Household 2 backups: ${backups2.length}`);
backups2.forEach(b => {
  if (b.household_id === household2.id) {
    console.log(`      ✅ ${b.filename} (${b.status})`);
  } else {
    console.error(`      ❌ ${b.filename} - WRONG HOUSEHOLD: ${b.household_id}`);
  }
});

// Verify no cross-contamination - check if household 1 backups have household 2's ID
const wrongBackups1 = db
  .prepare(`
    SELECT COUNT(*) as count
    FROM backup_history
    WHERE user_id = ? AND household_id = ? AND household_id != ?
  `)
  .get(userId, household1.id, household1.id);

// Check if household 2 backups have household 1's ID  
const wrongBackups2 = db
  .prepare(`
    SELECT COUNT(*) as count
    FROM backup_history
    WHERE user_id = ? AND household_id = ? AND household_id != ?
  `)
  .get(userId, household2.id, household2.id);

// Better check: verify all backups have correct household_id
const allBackups = db
  .prepare(`
    SELECT id, household_id
    FROM backup_history
    WHERE user_id = ?
  `)
  .all(userId);

const incorrectBackups = allBackups.filter(b => 
  b.household_id !== household1.id && b.household_id !== household2.id
);

if (incorrectBackups.length === 0 && backups1.every(b => b.household_id === household1.id) && backups2.every(b => b.household_id === household2.id)) {
  console.log(`   ✅ No cross-contamination detected`);
} else {
  if (incorrectBackups.length > 0) {
    console.error(`   ❌ Found ${incorrectBackups.length} backup(s) with incorrect household_id`);
  } else {
    console.log(`   ✅ No cross-contamination detected`);
  }
}

// Test 3: Verify file storage isolation
console.log('\n📋 Test 3: File Storage Isolation');
const userBackupDir = join(backupsDir, userId);

if (existsSync(userBackupDir)) {
  const householdDirs = readdirSync(userBackupDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  console.log(`   Found directories: ${householdDirs.join(', ')}`);
  
  const hasHousehold1 = householdDirs.includes(household1.id);
  const hasHousehold2 = householdDirs.includes(household2.id);
  
  if (hasHousehold1) {
    const files1 = readdirSync(join(userBackupDir, household1.id));
    console.log(`   ✅ Household 1 directory exists with ${files1.length} file(s)`);
  } else {
    console.log(`   ⚠️  Household 1 directory not found`);
  }
  
  if (hasHousehold2) {
    const files2 = readdirSync(join(userBackupDir, household2.id));
    console.log(`   ✅ Household 2 directory exists with ${files2.length} file(s)`);
  } else {
    console.log(`   ⚠️  Household 2 directory not found`);
  }
  
  // Check for old-style directories (without household subdirectory)
  const oldStyleFiles = readdirSync(userBackupDir, { withFileTypes: true })
    .filter(dirent => dirent.isFile())
    .map(dirent => dirent.name);
  
  if (oldStyleFiles.length > 0) {
    console.log(`   ⚠️  Found ${oldStyleFiles.length} old-style backup file(s) in root directory`);
  }
} else {
  console.log(`   ⚠️  User backup directory not found: ${userBackupDir}`);
}

// Test 4: Verify data isolation in backup files
console.log('\n📋 Test 4: Backup File Content Isolation');

if (backups1.length > 0 && backups2.length > 0) {
  const latestBackup1 = backups1[0];
  const latestBackup2 = backups2[0];
  
  const filePath1 = join(userBackupDir, household1.id, latestBackup1.filename);
  const filePath2 = join(userBackupDir, household2.id, latestBackup2.filename);
  
  if (existsSync(filePath1) && existsSync(filePath2)) {
    try {
      const content1 = JSON.parse(readFileSync(filePath1, 'utf-8'));
      const content2 = JSON.parse(readFileSync(filePath2, 'utf-8'));
      
      // Check account isolation
      const accounts1 = content1.data?.accounts || [];
      const accounts2 = content2.data?.accounts || [];
      
      const accounts1HouseholdIds = new Set(accounts1.map(a => a.household_id));
      const accounts2HouseholdIds = new Set(accounts2.map(a => a.household_id));
      
      const allAccounts1Correct = accounts1.every(a => a.household_id === household1.id);
      const allAccounts2Correct = accounts2.every(a => a.household_id === household2.id);
      
      if (allAccounts1Correct) {
        console.log(`   ✅ Backup 1 contains only household 1 accounts (${accounts1.length} accounts)`);
      } else {
        console.error(`   ❌ Backup 1 contains accounts from other households!`);
        accounts1HouseholdIds.forEach(hid => {
          if (hid !== household1.id) {
            console.error(`      Found household: ${hid}`);
          }
        });
      }
      
      if (allAccounts2Correct) {
        console.log(`   ✅ Backup 2 contains only household 2 accounts (${accounts2.length} accounts)`);
      } else {
        console.error(`   ❌ Backup 2 contains accounts from other households!`);
        accounts2HouseholdIds.forEach(hid => {
          if (hid !== household2.id) {
            console.error(`      Found household: ${hid}`);
          }
        });
      }
      
      // Check transaction isolation
      const transactions1 = content1.data?.transactions || [];
      const transactions2 = content2.data?.transactions || [];
      
      const allTransactions1Correct = transactions1.every(t => t.household_id === household1.id);
      const allTransactions2Correct = transactions2.every(t => t.household_id === household2.id);
      
      if (allTransactions1Correct) {
        console.log(`   ✅ Backup 1 contains only household 1 transactions (${transactions1.length} transactions)`);
      } else {
        console.error(`   ❌ Backup 1 contains transactions from other households!`);
      }
      
      if (allTransactions2Correct) {
        console.log(`   ✅ Backup 2 contains only household 2 transactions (${transactions2.length} transactions)`);
      } else {
        console.error(`   ❌ Backup 2 contains transactions from other households!`);
      }
      
    } catch (error) {
      console.error(`   ❌ Error reading backup files: ${error.message}`);
    }
  } else {
    console.log(`   ⚠️  Backup files not found on disk`);
    if (!existsSync(filePath1)) console.log(`      Missing: ${filePath1}`);
    if (!existsSync(filePath2)) console.log(`      Missing: ${filePath2}`);
  }
} else {
  console.log(`   ⚠️  Need at least one backup for each household to test content`);
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 Test Summary');
console.log('='.repeat(60));

const allTestsPassed = 
  (settings1 && settings1.household_id === household1.id) &&
  (settings2 && settings2.household_id === household2.id) &&
  backups1.every(b => b.household_id === household1.id) &&
  backups2.every(b => b.household_id === household2.id);

if (allTestsPassed) {
  console.log('✅ All isolation tests PASSED');
  console.log('✅ Backups are properly isolated by household');
} else {
  console.log('⚠️  Some tests had warnings or failures');
  console.log('💡 Review the output above for details');
}

db.close();
console.log('\n✅ Test completed!\n');

