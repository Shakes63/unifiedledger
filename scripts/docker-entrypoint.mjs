#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
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

function ensureRuntimeAuthSecret() {
  if (process.env.NODE_ENV !== "production") return;

  const envSecret = process.env.BETTER_AUTH_SECRET?.trim();
  if (envSecret) {
    return;
  }

  const secretFilePath = "/config/.better-auth-secret";
  try {
    const fileSecret = fs.existsSync(secretFilePath)
      ? fs.readFileSync(secretFilePath, "utf8").trim()
      : "";
    if (fileSecret) {
      process.env.BETTER_AUTH_SECRET = fileSecret;
      console.log(`[entrypoint] Loaded BETTER_AUTH_SECRET from ${secretFilePath}`);
      return;
    }
  } catch (error) {
    console.error(
      `[entrypoint] Failed reading persisted BETTER_AUTH_SECRET at ${secretFilePath}:`,
      error
    );
    process.exit(1);
  }

  const generatedSecret = crypto.randomBytes(32).toString("hex");
  try {
    fs.mkdirSync("/config", { recursive: true });
    fs.writeFileSync(secretFilePath, `${generatedSecret}\n`, { mode: 0o600 });
  } catch (error) {
    console.error(
      `[entrypoint] Failed generating persisted BETTER_AUTH_SECRET at ${secretFilePath}:`,
      error
    );
    process.exit(1);
  }

  process.env.BETTER_AUTH_SECRET = generatedSecret;
  console.warn("[entrypoint] BETTER_AUTH_SECRET was not provided.");
  console.warn(
    `[entrypoint] Generated and persisted a runtime secret to ${secretFilePath}.`
  );
  console.warn(
    "[entrypoint] For managed deployments, set BETTER_AUTH_SECRET explicitly via environment variables."
  );
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

function requireFileExists(filePath, { label }) {
  if (!fs.existsSync(filePath)) {
    console.error(`[entrypoint] Missing ${label}: ${filePath}`);
    console.error(
      "[entrypoint] This image may be incomplete/corrupted, or you may be running an unexpected working directory."
    );
    process.exit(1);
  }
}

function requireMigrationArtifacts({ dialect }) {
  // Fail-fast with clearer messaging.
  const cwd = process.cwd();

  const migrationsDir =
    dialect === "postgres"
      ? path.resolve(cwd, "drizzle", "postgres")
      : path.resolve(cwd, "drizzle", "sqlite");

  const journalPath = path.resolve(migrationsDir, "meta", "_journal.json");

  requireFileExists(migrationsDir, { label: "migrations directory" });
  requireFileExists(journalPath, { label: "Drizzle migration journal (meta/_journal.json)" });
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
  ensureRuntimeAuthSecret();

  const databaseUrl = process.env.DATABASE_URL?.trim() || defaultDatabaseUrl();
  process.env.DATABASE_URL = databaseUrl;

  const dialect = isPostgresUrl(databaseUrl) ? "postgres" : "sqlite";

  console.log(`[entrypoint] DATABASE_URL=${dialect === "postgres" ? "<postgresql>" : databaseUrl}`);
  console.log(`[entrypoint] Selected DB dialect: ${dialect}`);
  console.log(`[entrypoint] Running migrations...`);

  requireMigrationArtifacts({ dialect });

  let releaseLock = null;
  if (dialect === "sqlite") {
    try {
      releaseLock = acquireSqliteMigrateLock();
    } catch (e) {
      const code = e?.code;
      if (code === "EEXIST") {
        console.error("[entrypoint] SQLite migration lock already exists at /config/.migrate.lock");
        console.error("[entrypoint] This usually means another container instance is migrating, or a previous run crashed.");
        console.error("[entrypoint] Ensure only one instance is running. If safe, delete /config/.migrate.lock and restart.");
      } else {
        console.error("[entrypoint] Failed to acquire SQLite migration lock in /config:", e?.message ?? e);
      }
      process.exit(1);
    }
  } else {
    // Postgres: use an advisory lock so only one migrator runs at a time.
  }

  // Use lightweight migrate script instead of drizzle-kit (saves ~150MB in Docker image)
  const runMigrate = () => run("node", ["scripts/migrate.mjs"]);
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


