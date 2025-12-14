/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/api/household-auth', () => ({
  getAndVerifyHousehold: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/lib/backups/backup-utils', () => ({
  readBackupFile: vi.fn(),
  deleteBackupFile: vi.fn(),
  // keep real exports (like splitByRetentionCount) out of this file's scope
}));

import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { readBackupFile, deleteBackupFile } from '@/lib/backups/backup-utils';

type BackupRecord = {
  id: string;
  userId: string;
  householdId: string;
  filename: string;
  fileSize: number;
  format: 'json' | 'csv';
  status: 'pending' | 'completed' | 'failed';
};

function createRequest(url: string): Request {
  return new Request(url, { method: 'GET', headers: { 'x-household-id': 'hh-1' } });
}

function mockSelectBackup(backupRows: BackupRecord[]) {
  return {
    from: () => ({
      where: () => ({
        limit: async () => backupRows,
      }),
    }),
  };
}

describe('app/api/user/backups/[id]/route - DELETE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as any).mockResolvedValue({ userId: 'user-1' });
    (getAndVerifyHousehold as any).mockResolvedValue({ householdId: 'hh-1' });
    (deleteBackupFile as any).mockResolvedValue(undefined);
    (db.delete as any).mockReturnValue({ where: async () => undefined });
  });

  it('returns 404 when backup belongs to another user (not found)', async () => {
    (db.select as any).mockReturnValueOnce(mockSelectBackup([]));

    const { DELETE } = await import('@/app/api/user/backups/[id]/route');

    const res = await DELETE(
      createRequest('http://localhost/api/user/backups/backup-1') as any,
      { params: Promise.resolve({ id: 'backup-1' }) } as any
    );

    const data = await res.json();
    expect(res.status).toBe(404);
    expect(data.error).toContain('not found');
  });

  it('returns 403 when user no longer has household access', async () => {
    const backup: BackupRecord = {
      id: 'backup-1',
      userId: 'user-1',
      householdId: 'hh-locked',
      filename: 'b.json',
      fileSize: 10,
      format: 'json',
      status: 'completed',
    };

    (db.select as any).mockReturnValueOnce(mockSelectBackup([backup]));
    (getAndVerifyHousehold as any).mockRejectedValueOnce(new Error('Unauthorized household'));

    const { DELETE } = await import('@/app/api/user/backups/[id]/route');

    const res = await DELETE(
      createRequest('http://localhost/api/user/backups/backup-1') as any,
      { params: Promise.resolve({ id: 'backup-1' }) } as any
    );

    const data = await res.json();
    expect(res.status).toBe(403);
    expect(data.error).toContain('Unauthorized');
  });

  it('deletes file (best-effort) and record on success', async () => {
    const backup: BackupRecord = {
      id: 'backup-1',
      userId: 'user-1',
      householdId: 'hh-1',
      filename: 'unifiedledger-backup.json',
      fileSize: 10,
      format: 'json',
      status: 'completed',
    };

    (db.select as any).mockReturnValueOnce(mockSelectBackup([backup]));

    const { DELETE } = await import('@/app/api/user/backups/[id]/route');

    const res = await DELETE(
      createRequest('http://localhost/api/user/backups/backup-1') as any,
      { params: Promise.resolve({ id: 'backup-1' }) } as any
    );

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(deleteBackupFile).toHaveBeenCalledWith('user-1', 'hh-1', 'unifiedledger-backup.json');
    expect(db.delete).toHaveBeenCalledTimes(1);
  });
});

describe('app/api/user/backups/[id]/download/route - GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as any).mockResolvedValue({ userId: 'user-1' });
    (getAndVerifyHousehold as any).mockResolvedValue({ householdId: 'hh-1' });
  });

  it('returns 404 when backup belongs to another user (not found)', async () => {
    (db.select as any).mockReturnValueOnce(mockSelectBackup([]));

    const { GET } = await import('@/app/api/user/backups/[id]/download/route');

    const res = await GET(
      createRequest('http://localhost/api/user/backups/backup-1/download') as any,
      { params: Promise.resolve({ id: 'backup-1' }) } as any
    );

    expect(res.status).toBe(404);
  });

  it('returns 400 when backup is not completed', async () => {
    const backup: BackupRecord = {
      id: 'backup-1',
      userId: 'user-1',
      householdId: 'hh-1',
      filename: 'b.json',
      fileSize: 10,
      format: 'json',
      status: 'pending',
    };

    (db.select as any).mockReturnValueOnce(mockSelectBackup([backup]));

    const { GET } = await import('@/app/api/user/backups/[id]/download/route');

    const res = await GET(
      createRequest('http://localhost/api/user/backups/backup-1/download') as any,
      { params: Promise.resolve({ id: 'backup-1' }) } as any
    );

    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain('not ready');
  });

  it('returns 403 when user no longer has household access', async () => {
    const backup: BackupRecord = {
      id: 'backup-1',
      userId: 'user-1',
      householdId: 'hh-locked',
      filename: 'b.json',
      fileSize: 10,
      format: 'json',
      status: 'completed',
    };

    (db.select as any).mockReturnValueOnce(mockSelectBackup([backup]));
    (getAndVerifyHousehold as any).mockRejectedValueOnce(new Error('Unauthorized household'));

    const { GET } = await import('@/app/api/user/backups/[id]/download/route');

    const res = await GET(
      createRequest('http://localhost/api/user/backups/backup-1/download') as any,
      { params: Promise.resolve({ id: 'backup-1' }) } as any
    );

    expect(res.status).toBe(403);
  });

  it('streams file content with attachment headers on success', async () => {
    const backup: BackupRecord = {
      id: 'backup-1',
      userId: 'user-1',
      householdId: 'hh-1',
      filename: 'unifiedledger-backup-2025-01-01-000000.json',
      fileSize: 15,
      format: 'json',
      status: 'completed',
    };

    (db.select as any).mockReturnValueOnce(mockSelectBackup([backup]));
    (readBackupFile as any).mockResolvedValueOnce('{"ok":true}');

    const { GET } = await import('@/app/api/user/backups/[id]/download/route');

    const res = await GET(
      createRequest('http://localhost/api/user/backups/backup-1/download') as any,
      { params: Promise.resolve({ id: 'backup-1' }) } as any
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('content-disposition')).toContain('attachment');

    const body = await res.text();
    expect(body).toContain('ok');
  });

  it('returns 404 when file is missing on disk', async () => {
    const backup: BackupRecord = {
      id: 'backup-1',
      userId: 'user-1',
      householdId: 'hh-1',
      filename: 'missing.json',
      fileSize: 15,
      format: 'json',
      status: 'completed',
    };

    (db.select as any).mockReturnValueOnce(mockSelectBackup([backup]));
    (readBackupFile as any).mockRejectedValueOnce(new Error('ENOENT'));

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { GET } = await import('@/app/api/user/backups/[id]/download/route');

    const res = await GET(
      createRequest('http://localhost/api/user/backups/backup-1/download') as any,
      { params: Promise.resolve({ id: 'backup-1' }) } as any
    );

    expect(res.status).toBe(404);
    consoleError.mockRestore();
  });
});
