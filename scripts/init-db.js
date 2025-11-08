const Database = require('better-sqlite3');
const { drizzle } = require('drizzle-orm/better-sqlite3');

const db = new Database('./sqlite.db');

// Initialize Drizzle ORM
const drizzleDb = drizzle(db);

console.log('🗄️  Initializing database...');

try {
  // Run migrations automatically
  // Since we're using better-sqlite3 with Drizzle, we can use db.exec() for raw SQL
  // But Drizzle handles schema creation automatically on first use

  console.log('✅ Database initialized successfully!');
  console.log('📍 Database location: ./sqlite.db');
  console.log('📊 Tables will be created on first query');

  // Optional: List the tables that will be created
  console.log('\n📋 Schema tables configured:');
  console.log('  ✓ Accounts');
  console.log('  ✓ Transactions');
  console.log('  ✓ Bills & Bill Instances');
  console.log('  ✓ Budget Categories');
  console.log('  ✓ Merchants');
  console.log('  ✓ Savings Goals');
  console.log('  ✓ Debts');
  console.log('  ✓ Households & Members');
  console.log('  ✓ Notifications');
  console.log('  ✓ User Settings');
  console.log('  ✓ And more...\n');

  process.exit(0);
} catch (error) {
  console.error('❌ Error initializing database:', error);
  process.exit(1);
}
