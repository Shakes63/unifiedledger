import { afterEach, describe, expect, it, vi } from 'vitest';

describe('runInDatabaseTransaction', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('wraps work in BEGIN IMMEDIATE / COMMIT', async () => {
    const run = vi.fn(async () => undefined);
    const dbMock = { run };

    vi.doMock('@/lib/db', () => ({ db: dbMock }));

    const { runInDatabaseTransaction } = await import('@/lib/db/transaction-runner');
    const work = vi.fn(async (tx: unknown) => {
      expect(tx).toBe(dbMock);
      return 'ok';
    });

    const result = await runInDatabaseTransaction(work);

    expect(result).toBe('ok');
    expect(work).toHaveBeenCalledTimes(1);
    // BEGIN IMMEDIATE + COMMIT
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('ROLLBACKs and rethrows when work throws', async () => {
    const run = vi.fn(async () => undefined);
    const dbMock = { run };

    vi.doMock('@/lib/db', () => ({ db: dbMock }));

    const { runInDatabaseTransaction } = await import('@/lib/db/transaction-runner');
    const expectedError = new Error('boom');

    await expect(runInDatabaseTransaction(async () => {
      throw expectedError;
    })).rejects.toThrow('boom');

    // BEGIN IMMEDIATE + ROLLBACK
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('nested calls join the open transaction instead of issuing a second BEGIN', async () => {
    const run = vi.fn(async () => undefined);
    const dbMock = { run };

    vi.doMock('@/lib/db', () => ({ db: dbMock }));

    const { runInDatabaseTransaction } = await import('@/lib/db/transaction-runner');

    const result = await runInDatabaseTransaction(async () => {
      // Nested unit of work: must not BEGIN again (that would throw
      // "transaction within a transaction") and must not deadlock the mutex.
      return runInDatabaseTransaction(async () => 'nested-ok');
    });

    expect(result).toBe('nested-ok');
    // Only the OUTER transaction's BEGIN IMMEDIATE + COMMIT.
    expect(run).toHaveBeenCalledTimes(2);
  });
});
