#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function extractExportConstNames(source) {
  const names = new Set();
  const re = /^\s*export const\s+([A-Za-z0-9_]+)\s*=/gm;
  let m;
  while ((m = re.exec(source))) names.add(m[1]);
  return [...names].sort();
}

function main() {
  const sqlitePath = path.join(repoRoot, "lib/db/schema.sqlite.ts");
  const pgPath = path.join(repoRoot, "lib/db/schema.pg.ts");

  if (!fs.existsSync(sqlitePath)) throw new Error(`Missing ${sqlitePath}. Did you rename schema.ts -> schema.sqlite.ts?`);
  if (!fs.existsSync(pgPath)) throw new Error(`Missing ${pgPath}. Run scripts/generate-pg-schema.mjs first.`);

  const sqliteSource = fs.readFileSync(sqlitePath, "utf8");
  const names = extractExportConstNames(sqliteSource);
  if (names.length === 0) throw new Error("No exports found in schema.sqlite.ts");

  const lines = [];
  lines.push('import { getDatabaseDialectFromUrl } from "./dialect";');
  lines.push('import * as sqlite from "./schema.sqlite";');
  lines.push('import * as pg from "./schema.pg";');
  lines.push("");
  lines.push("const dialect = getDatabaseDialectFromUrl(process.env.DATABASE_URL);");
  lines.push("");

  for (const name of names) {
    lines.push(`export const ${name} = dialect === "postgresql" ? pg.${name} : sqlite.${name};`);
  }
  lines.push("");

  fs.writeFileSync(path.join(repoRoot, "lib/db/schema.ts"), lines.join("\n"), { encoding: "utf8" });
  console.log(`[generate-schema-facade] wrote lib/db/schema.ts with ${names.length} exports`);
}

main();


