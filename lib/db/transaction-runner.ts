import { sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { getCurrentDatabaseDialect } from '@/lib/db/dialect';

/**
 * Runs a unit of work inside a real database transaction.
 *
 * SQLite (better-sqlite3): the driver is a SINGLE synchronous connection shared by
 * the whole process. Our unit-of-work callbacks are async (they `await` drizzle
 * queries), so we cannot use better-sqlite3's native synchronous `db.transaction()`
 * — an async callback returns a pending promise at its first `await`, at which
 * point better-sqlite3 immediately COMMITs and every later statement runs in
 * autocommit (audit finding H-DB-4). Instead we issue manual BEGIN IMMEDIATE /
 * COMMIT and SERIALIZE every transactional unit through an async mutex, so two
 * concurrent requests can never interleave their statements into the same open
 * transaction — the C-ATOM-1 corruption where one request's ROLLBACK discarded
 * another request's half-written work, or a second BEGIN threw "transaction within
 * a transaction". Nested calls join the active transaction instead of opening a
 * new one.
 *
 * PostgreSQL: uses the driver's native transaction (real connection-per-tx).
 */

type TransactionalDb = {
  transaction?: (callback: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
  run?: (query: unknown) => Promise<unknown>;
};

// Async mutex: a promise chain that serializes SQLite transactions.
let sqliteTxChain: Promise<unknown> = Promise.resolve();
// True while a SQLite BEGIN...COMMIT is open, so nested calls join it.
let sqliteInTransaction = false;

async function runSqliteTransaction<T>(
  run: (query: unknown) => Promise<unknown>,
  work: (tx: typeof db) => Promise<T>
): Promise<T> {
  // Already inside an open transaction (nested call): join it. Do NOT issue a
  // nested BEGIN and do NOT take the mutex again (that would self-deadlock).
  if (sqliteInTransaction) {
    return work(db);
  }

  // Take our place in the serialization queue before awaiting the prior holder,
  // so the next caller waits on us (standard async-mutex handoff).
  const prior = sqliteTxChain;
  let release!: () => void;
  sqliteTxChain = new Promise<void>((resolve) => {
    release = resolve;
  });

  try {
    await prior;
  } catch {
    // A prior transaction's failure must not poison the queue for us.
  }

  sqliteInTransaction = true;
  try {
    await run(sql.raw('BEGIN IMMEDIATE'));
    try {
      const result = await work(db);
      await run(sql.raw('COMMIT'));
      return result;
    } catch (error) {
      try {
        await run(sql.raw('ROLLBACK'));
      } catch {
        // Best-effort rollback; surface the original error.
      }
      throw error;
    }
  } finally {
    sqliteInTransaction = false;
    release();
  }
}

export async function runInDatabaseTransaction<T>(
  work: (tx: typeof db) => Promise<T>
): Promise<T> {
  const isSqlite = getCurrentDatabaseDialect() === 'sqlite';
  const dbWithTx = db as unknown as TransactionalDb;

  if (isSqlite && typeof dbWithTx.run === 'function') {
    return runSqliteTransaction(dbWithTx.run.bind(dbWithTx), work);
  }

  if (typeof dbWithTx.transaction === 'function') {
    return dbWithTx.transaction(async (tx) => {
      return work(tx as typeof db);
    }) as Promise<T>;
  }

  return work(db);
}
