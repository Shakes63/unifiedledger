/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const insertCalls: any[] = [];
const updateCalls: any[] = [];

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn((table: any) => ({
      values: vi.fn(async (vals: any) => {
        insertCalls.push({ table, vals });
        return undefined;
      }),
    })),
    update: vi.fn((table: any) => ({
      set: vi.fn((vals: any) => {
        updateCalls.push({ table, vals });
        return {
          where: vi.fn(async () => undefined),
        };
      }),
    })),
  },
}));

vi.mock('uuid', () => ({
  v4: vi
    .fn()
    .mockReturnValueOnce('settings-id')
    .mockReturnValueOnce('backup-id')
    .mockReturnValue('id'),
}));

vi.mock('@/lib/backups/backup-utils', () => ({
  generateBackupFilename: vi.fn(() => 'unifiedledger-backup-2025-01-01-000000.json'),
  saveBackupFile: vi.fn(async () => ({ filePath: '/tmp/backup.json', fileSize: 123 })),
}));

import { db } from '@/lib/db';
import { saveBackupFile } from '@/lib/backups/backup-utils';

function mockSelectWhere(rows: any[]) {
  return {
    from: () => ({
      where: async () => rows,
    }),
  };
}

describe('lib/backups/create-backup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertCalls.length = 0;
    updateCalls.length = 0;
  });

  it('creates default settings, writes file, and marks backup completed', async () => {
    // settings missing -> create defaults -> re-select settings
    (db.select as any)
      .mockReturnValueOnce(mockSelectWhere([]))
      .mockReturnValueOnce(mockSelectWhere([{ id: 'settings-id', format: 'json' }]));

    // Promise.all: 19 selects
    for (let i = 0; i < 19; i++) {
      (db.select as any).mockReturnValueOnce(mockSelectWhere([]));
    }

    const { createUserBackup } = await import('@/lib/backups/create-backup');

    const result = await createUserBackup('user-1', 'hh-1', 'json');

    expect(result.success).toBe(true);
    expect(result.backupId).toBe('backup-id');

    // wrote backup file
    expect(saveBackupFile).toHaveBeenCalledTimes(1);
    expect(saveBackupFile).toHaveBeenCalledWith(
      'user-1',
      'hh-1',
      'unifiedledger-backup-2025-01-01-000000.json',
      expect.stringContaining('"exportDate"')
    );

    // inserted settings + history
    expect(insertCalls.length).toBe(2);
    expect(insertCalls[0].vals).toEqual(expect.objectContaining({
      id: 'settings-id',
      userId: 'user-1',
      householdId: 'hh-1',
      retentionCount: 10,
      enabled: false,
    }));

    expect(insertCalls[1].vals).toEqual(expect.objectContaining({
      id: 'backup-id',
      userId: 'user-1',
      householdId: 'hh-1',
      filename: 'unifiedledger-backup-2025-01-01-000000.json',
      status: 'pending',
      format: 'json',
    }));

    // updated history -> completed and fileSize
    const completedUpdate = updateCalls.find(u => u.vals?.status === 'completed');
    expect(completedUpdate).toBeTruthy();
    expect(completedUpdate.vals).toEqual(expect.objectContaining({
      status: 'completed',
      fileSize: 123,
    }));
  });

  it('marks backup failed when data fetch errors', async () => {
    (db.select as any)
      .mockReturnValueOnce(mockSelectWhere([{ id: 'settings-id', format: 'json' }]))
      // Safety: if settings bootstrap re-queries, keep select chain valid
      .mockReturnValueOnce(mockSelectWhere([{ id: 'settings-id', format: 'json' }]))
      // Promise.all first select rejects
      .mockReturnValueOnce({
        from: () => ({
          where: async () => {
            throw new Error('boom');
          },
        }),
      });

    // Remaining Promise.all selects (won't run after reject, but keep mocks safe)
    for (let i = 0; i < 18; i++) {
      (db.select as any).mockReturnValueOnce(mockSelectWhere([]));
    }

    const { createUserBackup } = await import('@/lib/backups/create-backup');

    const result = await createUserBackup('user-1', 'hh-1', 'json');

    expect(result.success).toBe(false);
    expect(result.error).toContain('boom');

    // should NOT write file
    expect(saveBackupFile).not.toHaveBeenCalled();

    const failedUpdate = updateCalls.find(u => u.vals?.status === 'failed');
    expect(failedUpdate).toBeTruthy();
    expect(failedUpdate.vals).toEqual(expect.objectContaining({
      status: 'failed',
      errorMessage: 'boom',
    }));
  });
});
