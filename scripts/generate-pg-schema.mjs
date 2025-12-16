#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function rewriteSqliteSchemaToPg(source) {
  let out = source;

  // Header + imports
  out = out.replace(
    /from 'drizzle-orm\/sqlite-core';/g,
    "from 'drizzle-orm/pg-core';"
  );
  out = out.replace(/sqliteTable/g, "pgTable");
  out = out.replace(/\breal\b/g, "doublePrecision");

  // Remove sqlite-only text enum option (`text('x', { enum: [...] })` -> `text('x')`)
  out = out.replace(/text\(\s*'([^']+)'\s*,\s*\{\s*enum:\s*\[[^\]]*]\s*}\s*\)/g, "text('$1')");

  // integer('x', { mode: 'boolean' }) -> boolean('x')
  out = out.replace(/integer\(\s*'([^']+)'\s*,\s*\{\s*mode:\s*'boolean'\s*}\s*\)/g, "boolean('$1')");

  // Replace sqliteNowIso constant with pgNowIso constant + ensure sql import exists.
  out = out.replace(/const sqliteNowIso = sql`[^`]*`;/g, "const pgNowIso = sql`(to_char((now() at time zone 'utc'),'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'))`;");
  out = out.replace(/sqliteNowIso/g, "pgNowIso");

  // If sqlite schema imported `sql` already, keep. If not, we'll add in auth-schema conversion separately.
  // Ensure pg boolean/doublePrecision/pgTable are imported.
  out = out.replace(
    /import\s*\{\s*([^}]+)\s*}\s*from 'drizzle-orm\/pg-core';/,
    (m, inner) => {
      const parts = inner
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const want = new Set(parts);
      want.add("pgTable");
      want.add("text");
      want.add("integer");
      want.add("doublePrecision");
      want.add("boolean");
      want.add("uniqueIndex");
      want.add("index");
      // preserve comments if present by filtering only identifiers
      const ordered = [
        "pgTable",
        "text",
        "integer",
        "doublePrecision",
        "boolean",
        "uniqueIndex",
        "index",
      ].filter((p) => want.has(p));
      return `import { ${ordered.join(", ")} } from 'drizzle-orm/pg-core';`;
    }
  );

  return out;
}

function rewriteAuthSchemaToPg(source) {
  let out = source;
  out = out.replace(/from "drizzle-orm\/sqlite-core";/g, 'from "drizzle-orm/pg-core";');
  out = out.replace(/sqliteTable/g, "pgTable");
  // sqlite integer({mode:'timestamp_ms'}) isn't supported in pg-core; use bigint ms for now.
  out = out.replace(/integer\("([^"]+)",\s*\{\s*mode:\s*"timestamp_ms"\s*}\)/g, 'bigint("$1", { mode: "number" })');
  out = out.replace(/integer\("([^"]+)",\s*\{\s*mode:\s*"boolean"\s*}\)/g, 'boolean("$1")');
  // keep plain integer() where used for expiresAt? convert to bigint for consistency
  out = out.replace(/integer\("expires_at",\s*\{\s*mode:\s*"timestamp_ms"\s*}\)/g, 'bigint("expires_at", { mode: "number" })');
  out = out.replace(/integer\("last_activity_at",\s*\{\s*mode:\s*"timestamp_ms"\s*}\)/g, 'bigint("last_activity_at", { mode: "number" })');
  // Ensure imports contain required builders
  out = out.replace(
    /import\s*\{\s*([^}]+)\s*}\s*from "drizzle-orm\/pg-core";/,
    () => 'import { pgTable, text, boolean, bigint } from "drizzle-orm/pg-core";'
  );
  // Replace unixepoch(...) with now() ms approximation in postgres
  out = out.replace(/sql`\(cast\(unixepoch\('subsecond'\) \* 1000 as integer\)\)`/g, "sql`(cast(extract(epoch from now()) * 1000 as bigint))`");
  return out;
}

function writeFile(target, contents) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents, { encoding: "utf8" });
}

function main() {
  const sqliteSchemaPath = path.join(repoRoot, "lib/db/schema.sqlite.ts");
  const sqliteSchemaFallback = path.join(repoRoot, "lib/db/schema.ts");

  const sourcePath = fs.existsSync(sqliteSchemaPath) ? sqliteSchemaPath : sqliteSchemaFallback;
  const sqliteSource = fs.readFileSync(sourcePath, "utf8");

  const pgSchema = rewriteSqliteSchemaToPg(sqliteSource);
  writeFile(path.join(repoRoot, "lib/db/schema.pg.ts"), pgSchema);

  const authSqlite = fs.readFileSync(path.join(repoRoot, "auth-schema.ts"), "utf8");
  const authPg = rewriteAuthSchemaToPg(authSqlite);
  writeFile(path.join(repoRoot, "auth-schema.pg.ts"), authPg);

  console.log("[generate-pg-schema] wrote lib/db/schema.pg.ts and auth-schema.pg.ts");
}

main();


