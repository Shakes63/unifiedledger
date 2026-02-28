#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';

function isPostgresUrl(databaseUrl) {
  const value = (databaseUrl ?? '').trim().toLowerCase();
  return value.startsWith('postgres://') || value.startsWith('postgresql://');
}

function resolveDatabaseUrl() {
  const envUrl = process.env.DATABASE_URL?.trim();
  if (envUrl) {
    return envUrl;
  }

  if (process.env.NODE_ENV === 'production') {
    return 'file:/config/finance.db';
  }

  return `file:${path.join(process.cwd(), 'sqlite.db')}`;
}

function run(command, args, env) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env,
  });

  if (result.error) {
    throw result.error;
  }

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main() {
  const databaseUrl = resolveDatabaseUrl();
  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
  };

  if (isPostgresUrl(databaseUrl)) {
    run('pnpm', ['-s', 'db:migrate:pg'], env);
  } else {
    run('pnpm', ['-s', 'db:migrate:sqlite:safe'], env);
  }

  run('next', ['dev'], env);
}

main();
