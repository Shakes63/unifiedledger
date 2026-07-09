#!/usr/bin/env node
/**
 * Migration-journal consistency gate (Phase 4 durability).
 *
 * drizzle-kit's `generate` reconstructs migrations from a snapshot in
 * meta/_journal.json. When a .sql file and its journal entry drift apart —
 * an orphan file with no entry, an entry with no file, a gap or duplicate in
 * the idx sequence — `generate` goes interactive/broken and silently stops
 * emitting migrations. That is exactly how the Postgres schema forked and
 * fell behind SQLite (it is missing the entity, bill-v2, and money-cents
 * migrations). This script fails CI the moment either dialect's journal stops
 * matching its files, so the drift is caught at the commit that introduces it
 * rather than months later at a broken `generate`.
 *
 * It verifies each dialect INTERNALLY (files <-> journal, contiguous idx). It
 * does NOT try to reconcile Postgres against SQLite — that needs a live
 * Postgres and hand-authored catch-up migrations (tracked as C-DB-1). The
 * cross-dialect lag is reported as a non-fatal warning so it stays visible.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// DRIZZLE_ROOT lets tests point the verifier at a fixture tree; defaults to the repo.
const root = process.env.DRIZZLE_ROOT
  ? process.env.DRIZZLE_ROOT
  : join(dirname(fileURLToPath(import.meta.url)), '..', 'drizzle');
const DIALECTS = [
  { name: 'sqlite', dir: join(root, 'sqlite') },
  { name: 'postgres', dir: join(root, 'postgres') },
];

const errors = [];
const warnings = [];
const counts = {};

for (const { name, dir } of DIALECTS) {
  const journalPath = join(dir, 'meta', '_journal.json');
  if (!existsSync(dir) || !existsSync(journalPath)) {
    warnings.push(`[${name}] no migration dir or _journal.json; skipping`);
    continue;
  }

  const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
  const entries = journal.entries ?? [];
  const sqlFiles = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const entryTags = new Set(entries.map((e) => e.tag));
  const fileTags = new Set(sqlFiles.map((f) => f.replace(/\.sql$/, '')));

  // Every journal entry must have a .sql file.
  for (const e of entries) {
    if (!fileTags.has(e.tag)) {
      errors.push(`[${name}] journal entry "${e.tag}" (idx ${e.idx}) has no matching .sql file`);
    }
  }
  // Every .sql file must have a journal entry (orphan files are the drift signal).
  for (const tag of fileTags) {
    if (!entryTags.has(tag)) {
      errors.push(`[${name}] migration file "${tag}.sql" has no entry in _journal.json`);
    }
  }
  // idx must be contiguous 0..n-1 with no gaps or duplicates.
  const indices = entries.map((e) => e.idx).sort((a, b) => a - b);
  for (let i = 0; i < indices.length; i++) {
    if (indices[i] !== i) {
      errors.push(`[${name}] journal idx sequence is not contiguous at position ${i} (got ${indices[i]})`);
      break;
    }
  }

  counts[name] = fileTags.size;
}

// Cross-dialect lag: non-fatal, but keep it loud so nobody forgets Postgres.
if (counts.sqlite != null && counts.postgres != null && counts.sqlite !== counts.postgres) {
  warnings.push(
    `postgres has ${counts.postgres} migrations but sqlite has ${counts.sqlite} — ` +
      `the dialects have forked. Reconcile Postgres before switching dialects (C-DB-1).`
  );
}

for (const w of warnings) console.warn(`⚠️  ${w}`);

if (errors.length > 0) {
  console.error('\n❌ Migration journal is inconsistent:\n');
  for (const e of errors) console.error(`   • ${e}`);
  console.error('\nFix the journal/files before committing so drizzle-kit generate stays usable.\n');
  process.exit(1);
}

console.log(
  `✅ Migration journals consistent (sqlite: ${counts.sqlite ?? '—'}, postgres: ${counts.postgres ?? '—'} migrations).`
);
