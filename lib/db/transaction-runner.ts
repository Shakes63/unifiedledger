import { sql } from 'drizzle-orm';

import { db } from '@/lib/db';

/**
 * Runs a transaction using the database client's transaction API when available.
 * Falls back to manual BEGIN/COMMIT when only raw run support exists.
 */
export async function runInDatabaseTransaction<T>(
  work: (tx: typeof db) => Promise<T>
): Promise<T> {
  const dbWithTx = db as unknown as {
    transaction?: (callback: (tx: unknown) => Promise<T>) => Promise<T>;
    run?: (query: unknown) => Promise<unknown>;
  };

  if (typeof dbWithTx.transaction === 'function') {
    return dbWithTx.transaction(async (tx) => {
      return work(tx as typeof db);
    });
  }

  if (typeof dbWithTx.run === 'function') {
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

  return work(db);
}
