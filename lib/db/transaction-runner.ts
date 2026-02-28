import { sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { getCurrentDatabaseDialect } from '@/lib/db/dialect';

/**
 * Runs a transaction using the strategy that matches the active database engine.
 * - SQLite: manual BEGIN/COMMIT to support async unit-of-work callbacks.
 * - PostgreSQL: Drizzle transaction callback.
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
