const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = './sqlite.db';
const migrationsDir = './drizzle';

const db = new Database(dbPath);

// Get migration filename from command line argument
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('❌ Error: Please provide a migration filename');
  console.log('Usage: node scripts/run-migration.js 0037_add_session_activity_tracking.sql');
  process.exit(1);
}

const migrationPath = path.join(migrationsDir, migrationFile);

if (!fs.existsSync(migrationPath)) {
  console.error(`❌ Error: Migration file not found: ${migrationPath}`);
  process.exit(1);
}

console.log(`🔄 Running migration: ${migrationFile}`);

try {
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  // Execute the migration
  db.exec(migrationSql);

  console.log('✅ Migration completed successfully!');
  process.exit(0);
} catch (error) {
  console.error('❌ Error running migration:', error.message);
  process.exit(1);
}
