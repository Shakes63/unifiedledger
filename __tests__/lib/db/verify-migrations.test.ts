import { afterEach, describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

/**
 * The migration-journal gate (scripts/verify-migrations.mjs) is what catches the
 * drizzle-kit snapshot drift that forked the Postgres schema. These tests build
 * throwaway drizzle trees and assert the gate passes on a consistent one and
 * fails on each drift shape.
 */
const SCRIPT = path.join(process.cwd(), 'scripts', 'verify-migrations.mjs');

function writeDialect(
  root: string,
  dialect: string,
  tags: string[],
  { journalTags, indices }: { journalTags?: string[]; indices?: number[] } = {}
) {
  const dir = path.join(root, dialect);
  fs.mkdirSync(path.join(dir, 'meta'), { recursive: true });
  for (const tag of tags) {
    fs.writeFileSync(path.join(dir, `${tag}.sql`), '-- noop\n');
  }
  const entryTags = journalTags ?? tags;
  const entries = entryTags.map((tag, i) => ({
    idx: indices ? indices[i] : i,
    version: '6',
    when: 1700000000000 + i,
    tag,
    breakpoints: true,
  }));
  fs.writeFileSync(
    path.join(dir, 'meta', '_journal.json'),
    JSON.stringify({ version: '7', dialect, entries }, null, 2)
  );
}

function run(root: string) {
  return spawnSync('node', [SCRIPT], {
    env: { ...process.env, DRIZZLE_ROOT: root },
    encoding: 'utf8',
  });
}

describe('verify-migrations gate', () => {
  const cleanup: string[] = [];
  afterEach(() => {
    for (const p of cleanup) fs.rmSync(p, { recursive: true, force: true });
    cleanup.length = 0;
  });

  function tmpRoot() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ul-migverify-'));
    cleanup.push(dir);
    return dir;
  }

  it('passes when files and journal agree', () => {
    const root = tmpRoot();
    writeDialect(root, 'sqlite', ['0000_init', '0001_next']);
    writeDialect(root, 'postgres', ['0000_init', '0001_next']);
    const res = run(root);
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/consistent/);
  });

  it('fails when a .sql file has no journal entry (orphan file)', () => {
    const root = tmpRoot();
    // File 0002 exists on disk but the journal only knows about 0000/0001.
    writeDialect(root, 'sqlite', ['0000_init', '0001_next', '0002_orphan'], {
      journalTags: ['0000_init', '0001_next'],
    });
    writeDialect(root, 'postgres', ['0000_init', '0001_next']);
    const res = run(root);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/0002_orphan\.sql.*no entry/);
  });

  it('fails when a journal entry has no .sql file', () => {
    const root = tmpRoot();
    writeDialect(root, 'sqlite', ['0000_init'], {
      journalTags: ['0000_init', '0001_missing'],
    });
    writeDialect(root, 'postgres', ['0000_init', '0001_missing']);
    const res = run(root);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/0001_missing.*no matching \.sql/);
  });

  it('fails when the idx sequence is not contiguous', () => {
    const root = tmpRoot();
    writeDialect(root, 'sqlite', ['0000_init', '0001_next'], { indices: [0, 2] });
    writeDialect(root, 'postgres', ['0000_init', '0001_next']);
    const res = run(root);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/not contiguous/);
  });

  it('warns but still passes when the dialects have a different migration count', () => {
    const root = tmpRoot();
    writeDialect(root, 'sqlite', ['0000_init', '0001_next', '0002_more']);
    writeDialect(root, 'postgres', ['0000_init', '0001_next']);
    const res = run(root);
    expect(res.status).toBe(0);
    expect(res.stderr).toMatch(/forked/);
  });
});
