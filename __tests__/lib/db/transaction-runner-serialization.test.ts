import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';

/**
 * Real-DB verification of runInDatabaseTransaction's transactional guarantees (RC-1,
 * C-ATOM-1): serialization of concurrent transactions (no lost updates through
 * read-modify-write), rollback on error, and nesting (a nested call joins the active
 * transaction instead of opening a second BEGIN). Operates on an isolated scratch
 * table so it never touches application data.
 */

const TABLE = 'tx_runner_test_counter';

async function readCounter(): Promise<number> {
  const row = (await db.get(
    sql.raw(`SELECT value AS value FROM ${TABLE} WHERE id = 1`)
  )) as { value: number } | undefined;
  return row ? Number(row.value) : 0;
}

describe('runInDatabaseTransaction serialization (SQLite)', () => {
  beforeAll(async () => {
    await db.run(
      sql.raw(`CREATE TABLE IF NOT EXISTS ${TABLE} (id INTEGER PRIMARY KEY, value INTEGER NOT NULL)`)
    );
  });

  afterAll(async () => {
    await db.run(sql.raw(`DROP TABLE IF EXISTS ${TABLE}`));
  });

  beforeEach(async () => {
    await db.run(sql.raw(`DELETE FROM ${TABLE}`));
    await db.run(sql.raw(`INSERT INTO ${TABLE} (id, value) VALUES (1, 0)`));
  });

  it('serializes concurrent read-modify-write transactions with no lost updates', async () => {
    const N = 25;
    await Promise.all(
      Array.from({ length: N }, () =>
        runInDatabaseTransaction(async () => {
          // Deliberate read-modify-write in JS: interleaving would yield < N.
          const current = await readCounter();
          await db.run(sql.raw(`UPDATE ${TABLE} SET value = ${current + 1} WHERE id = 1`));
        })
      )
    );
    expect(await readCounter()).toBe(N);
  });

  it('rolls back all writes when the unit of work throws', async () => {
    await expect(
      runInDatabaseTransaction(async () => {
        await db.run(sql.raw(`UPDATE ${TABLE} SET value = 999 WHERE id = 1`));
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
    expect(await readCounter()).toBe(0);
  });

  it('supports nesting: a nested call joins the active transaction', async () => {
    await runInDatabaseTransaction(async () => {
      await db.run(sql.raw(`UPDATE ${TABLE} SET value = 1 WHERE id = 1`));
      await runInDatabaseTransaction(async () => {
        await db.run(sql.raw(`UPDATE ${TABLE} SET value = 2 WHERE id = 1`));
      });
    });
    expect(await readCounter()).toBe(2);
  });

  it('a failed transaction does not poison the serialization queue', async () => {
    await expect(
      runInDatabaseTransaction(async () => {
        await db.run(sql.raw(`UPDATE ${TABLE} SET value = 5 WHERE id = 1`));
        throw new Error('fail');
      })
    ).rejects.toThrow('fail');

    await runInDatabaseTransaction(async () => {
      const current = await readCounter();
      await db.run(sql.raw(`UPDATE ${TABLE} SET value = ${current + 10} WHERE id = 1`));
    });
    expect(await readCounter()).toBe(10);
  });
});
