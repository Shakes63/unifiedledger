import { sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { getCurrentDatabaseDialect } from '@/lib/db/dialect';

/**
 * Runs a transaction in a way that is compatible with both:
 * - SQLite (better-sqlite3): manual BEGIN/COMMIT around shared connection work.
 * - Postgres: native Drizzle transaction callback.
 */
export async function runInDatabaseTransaction<T>(
  work: (tx: typeof db) => Promise<T>
): Promise<T> {
  const isSqlite = getCurrentDatabaseDialect() === 'sqlite';
  const dbWithTx = db as unknown as {
    transaction?: (callback: (tx: unknown) => Promise<T>) => Promise<T>;
    run?: (query: unknown) => Promise<unknown>;
  };

  if (isSqlite && typeof dbWithTx.run === 'function') {
    await dbWithTx.run(sql.raw('BEGIN IMMEDIATE'));
    try {
      const result = await work(db);
      await dbWithTx.run(sql.raw('COMMIT'));
      return result;
    } catch (error) {
      try {
        await dbWithTx.run(sql.raw('ROLLBACK'));
      } catch {
        // Best-effort rollback.
      }
      throw error;
    }
  }

  if (typeof dbWithTx.transaction === 'function') {
    return dbWithTx.transaction(async (tx) => {
      return work(tx as typeof db);
    });
  }

  return work(db);
}
