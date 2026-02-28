import { afterEach, describe, expect, it, vi } from 'vitest';

describe('runInDatabaseTransaction', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('uses manual BEGIN/COMMIT path for sqlite clients with run()', async () => {
    const run = vi.fn(async () => undefined);
    const transaction = vi.fn();
    const dbMock = { run, transaction };

    vi.doMock('@/lib/db', () => ({ db: dbMock }));
    vi.doMock('@/lib/db/dialect', () => ({
      getCurrentDatabaseDialect: () => 'sqlite',
    }));

    const { runInDatabaseTransaction } = await import('@/lib/db/transaction-runner');
    const work = vi.fn(async (tx: unknown) => {
      expect(tx).toBe(dbMock);
      return 'ok';
    });

    const result = await runInDatabaseTransaction(work);

    expect(result).toBe('ok');
    expect(work).toHaveBeenCalledTimes(1);
    expect(transaction).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('uses manual ROLLBACK path for sqlite when work throws', async () => {
    const run = vi.fn(async () => undefined);
    const dbMock = { run };

    vi.doMock('@/lib/db', () => ({ db: dbMock }));
    vi.doMock('@/lib/db/dialect', () => ({
      getCurrentDatabaseDialect: () => 'sqlite',
    }));

    const { runInDatabaseTransaction } = await import('@/lib/db/transaction-runner');
    const expectedError = new Error('boom');

    await expect(runInDatabaseTransaction(async () => {
      throw expectedError;
    })).rejects.toThrow('boom');

    expect(run).toHaveBeenCalledTimes(2);
  });

  it('uses db.transaction callback for non-sqlite clients', async () => {
    const txMock = { txOnly: true };
    const transaction = vi.fn(async (callback: (tx: unknown) => Promise<number>) => callback(txMock));
    const dbMock = { transaction };

    vi.doMock('@/lib/db', () => ({ db: dbMock }));
    vi.doMock('@/lib/db/dialect', () => ({
      getCurrentDatabaseDialect: () => 'postgresql',
    }));

    const { runInDatabaseTransaction } = await import('@/lib/db/transaction-runner');
    const result = await runInDatabaseTransaction(async (tx) => {
      expect(tx).toBe(txMock);
      return 42;
    });

    expect(result).toBe(42);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('falls back to executing work directly when no tx methods exist', async () => {
    const dbMock = {};

    vi.doMock('@/lib/db', () => ({ db: dbMock }));
    vi.doMock('@/lib/db/dialect', () => ({
      getCurrentDatabaseDialect: () => 'postgresql',
    }));

    const { runInDatabaseTransaction } = await import('@/lib/db/transaction-runner');
    const result = await runInDatabaseTransaction(async (tx) => {
      expect(tx).toBe(dbMock);
      return 'direct';
    });

    expect(result).toBe('direct');
  });
});
