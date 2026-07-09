#!/usr/bin/env node
/**
 * Migration-journal consistency gate (Phase 4 durability).
 *
 * drizzle-kit's `generate` reconstructs migrations from a snapshot in
 * meta/_journal.json. When a .sql file and its journal entry drift apart —
 * an orphan file with no entry, an entry with no file, a gap or duplicate in
 * the idx sequence — `generate` goes interactive/broken and silently stops
 * emitting migrations. (That is exactly how the old dual-dialect Postgres
 * schema forked and fell behind before Postgres support was removed.) This
 * script fails CI the moment the journal stops matching its files, so the
 * drift is caught at the commit that introduces it rather than months later
 * at a broken `generate`.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// DRIZZLE_ROOT lets tests point the verifier at a fixture tree; defaults to the repo.
const root = process.env.DRIZZLE_ROOT
  ? process.env.DRIZZLE_ROOT
  : join(dirname(fileURLToPath(import.meta.url)), '..', 'drizzle');
const DIALECTS = [{ name: 'sqlite', dir: join(root, 'sqlite') }];

const errors = [];
const warnings = [];
const counts = {};

for (const { name, dir } of DIALECTS) {
  const journalPath = join(dir, 'meta', '_journal.json');
  if (!existsSync(dir) || !existsSync(journalPath)) {
    errors.push(`[${name}] no migration dir or _journal.json at ${dir}`);
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

// A leftover drizzle/postgres directory would mean pg artifacts crept back in
// without the runtime to use them — flag it so it gets cleaned up or questioned.
if (existsSync(join(root, 'postgres'))) {
  warnings.push(
    'drizzle/postgres exists but Postgres support was removed — delete it or ask why it returned.'
  );
}

for (const w of warnings) console.warn(`⚠️  ${w}`);

if (errors.length > 0) {
  console.error('\n❌ Migration journal is inconsistent:\n');
  for (const e of errors) console.error(`   • ${e}`);
  console.error('\nFix the journal/files before committing so drizzle-kit generate stays usable.\n');
  process.exit(1);
}

console.log(`✅ Migration journal consistent (sqlite: ${counts.sqlite ?? '—'} migrations).`);
