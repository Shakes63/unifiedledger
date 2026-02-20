const { spawnSync } = require('node:child_process');
const path = require('node:path');

const dbPath = process.env.DATABASE_URL || path.join(process.cwd(), 'sqlite.db');

console.log('🗄️  Initializing database via safe SQLite migration flow...');
console.log(`📍 DATABASE_URL: ${dbPath}`);

const result = spawnSync('pnpm', ['-s', 'db:migrate:sqlite:safe'], {
  stdio: 'inherit',
  env: process.env,
});

if (result.status !== 0) {
  console.error('❌ Database initialization failed');
  process.exit(result.status ?? 1);
}

console.log('✅ Database initialized and migrations are up to date');
