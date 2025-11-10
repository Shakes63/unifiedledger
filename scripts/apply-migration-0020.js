const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

console.log('🔄 Applying migration 0020_add_rule_actions.sql...\n');

try {
  // Open database connection
  const db = new Database('./sqlite.db');

  // Read migration file
  const migrationPath = path.join(__dirname, '../drizzle/0020_add_rule_actions.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  console.log('📄 Migration SQL:');
  console.log('---');
  console.log(migrationSQL);
  console.log('---\n');

  // Remove comments and split by semicolon, preserving multi-line statements
  const cleanSQL = migrationSQL
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');

  const statements = cleanSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  console.log(`📊 Executing ${statements.length} SQL statements...\n`);

  // Execute each statement
  let successCount = 0;
  for (const statement of statements) {
    try {
      db.exec(statement + ';');
      successCount++;
      const preview = statement.replace(/\s+/g, ' ').substring(0, 60);
      console.log(`✅ Executed: ${preview}...`);
    } catch (err) {
      // If column already exists, that's okay
      if (err.message && err.message.includes('duplicate column')) {
        const preview = statement.replace(/\s+/g, ' ').substring(0, 60);
        console.log(`⚠️  Column already exists (skipping): ${preview}...`);
        successCount++;
      } else {
        throw err;
      }
    }
  }

  console.log(`\n✅ Migration completed successfully! (${successCount} statements executed)`);
  console.log('🎉 Rule actions support is now enabled!\n');

  // Show a sample of migrated data
  console.log('📋 Sample of migrated rules:');
  const rules = db.prepare('SELECT id, name, category_id, actions FROM categorization_rules LIMIT 3').all();
  if (rules.length > 0) {
    rules.forEach(rule => {
      console.log(`  - ${rule.name}`);
      console.log(`    Category ID: ${rule.category_id || 'null'}`);
      console.log(`    Actions: ${rule.actions || 'null'}\n`);
    });
  } else {
    console.log('  (No rules in database yet)\n');
  }

  db.close();
  process.exit(0);
} catch (error) {
  console.error('❌ Error applying migration:', error);
  process.exit(1);
}
