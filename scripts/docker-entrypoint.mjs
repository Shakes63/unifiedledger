#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

function isPostgresUrl(databaseUrl) {
  const v = (databaseUrl ?? "").trim().toLowerCase();
  return v.startsWith("postgres://") || v.startsWith("postgresql://");
}

function defaultDatabaseUrl() {
  // Unraid CA contract: SQLite persisted under /config by default.
  if (process.env.NODE_ENV === "production") return "file:/config/finance.db";
  return "file:./sqlite.db";
}

function requireRuntimeSecrets() {
  // In production containers, secrets must be provided at runtime (not baked into images).
  if (process.env.NODE_ENV !== "production") return;

  const betterAuthSecret = process.env.BETTER_AUTH_SECRET?.trim();
  if (!betterAuthSecret) {
    console.error("[entrypoint] BETTER_AUTH_SECRET is required in production.");
    console.error("[entrypoint] Set a long random secret in your Unraid template / container environment.");
    process.exit(1);
  }
}

function run(cmd, args, extraEnv = {}) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      ...extraEnv,
      // Encourage non-interactive behavior where tools honor CI.
      CI: process.env.CI ?? "1",
    },
  });
  if (result.error) throw result.error;
  if (typeof result.status === "number" && result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} exited with code ${result.status}`);
  }
}

function acquireSqliteMigrateLock() {
  const lockDir = "/config";
  const lockPath = path.join(lockDir, ".migrate.lock");

  try {
    fs.mkdirSync(lockDir, { recursive: true });
  } catch {
    // ignore; mkdir can fail if /config isn't writable — migration will fail later anyway
  }

  const fd = fs.openSync(lockPath, "wx");
  fs.writeFileSync(fd, `${process.pid}\n`, { encoding: "utf8" });
  return () => {
    try {
      fs.closeSync(fd);
    } catch {}
    try {
      fs.unlinkSync(lockPath);
    } catch {}
  };
}

async function withPostgresAdvisoryLock(databaseUrl, fn) {
  // Use a stable 2-int lock key to avoid bigint parsing differences.
  // This lock is held for the lifetime of this client connection.
  const lockKey1 = 8291;
  const lockKey2 = 33001;
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("select pg_advisory_lock($1, $2)", [lockKey1, lockKey2]);
    return await fn();
  } finally {
    try {
      await client.query("select pg_advisory_unlock($1, $2)", [lockKey1, lockKey2]);
    } catch {}
    try {
      await client.end();
    } catch {}
  }
}

async function main() {
  requireRuntimeSecrets();

  const databaseUrl = process.env.DATABASE_URL?.trim() || defaultDatabaseUrl();
  process.env.DATABASE_URL = databaseUrl;

  const dialect = isPostgresUrl(databaseUrl) ? "postgres" : "sqlite";
  const drizzleConfig = dialect === "postgres" ? "drizzle.config.pg.ts" : "drizzle.config.sqlite.ts";
  const migrationsRoot = dialect === "postgres" ? "/app/drizzle/postgres" : "/app/drizzle/sqlite";

  console.log(`[entrypoint] DATABASE_URL=${dialect === "postgres" ? "<postgresql>" : databaseUrl}`);
  console.log(`[entrypoint] Selected DB dialect: ${dialect}`);
  console.log(`[entrypoint] Running migrations with config: ${drizzleConfig}`);

  if (dialect === "postgres") {
    if (!fs.existsSync(path.join(migrationsRoot, "meta", "_journal.json"))) {
      console.error("[entrypoint] Postgres migrations are not present in this image.");
      console.error("[entrypoint] Expected migrations under:", migrationsRoot);
      console.error("[entrypoint] Use SQLite (DATABASE_URL=file:/config/finance.db) or upgrade to an image that includes Postgres migrations.");
      process.exit(1);
    }
  }

  let releaseLock = null;
  if (dialect === "sqlite") {
    try {
      releaseLock = acquireSqliteMigrateLock();
    } catch (e) {
      console.error("[entrypoint] Failed to acquire SQLite migration lock in /config:", e?.message ?? e);
      process.exit(1);
    }
  } else {
    // Postgres: use an advisory lock so only one migrator runs at a time.
  }

  const runMigrate = () => run("pnpm", ["drizzle-kit", "migrate", "--config", drizzleConfig]);
  try {
    if (dialect === "postgres") {
      await withPostgresAdvisoryLock(databaseUrl, async () => {
        runMigrate();
      });
    } else {
      runMigrate();
    }
  } finally {
    if (releaseLock) releaseLock();
  }

  console.log("[entrypoint] Starting server...");
  run("node", ["server.js"], { CI: process.env.CI ?? "0" });
}

main().catch((err) => {
  console.error("[entrypoint] Startup failed:", err);
  process.exit(1);
});


