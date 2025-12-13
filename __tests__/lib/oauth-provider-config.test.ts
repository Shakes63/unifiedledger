/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

import { db } from '@/lib/db';
import { isOAuthLoginProviderConfigured } from '@/lib/auth/oauth-provider-config';

function mockSelectLimit(rows: any[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

describe('isOAuthLoginProviderConfigured', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...envBackup };
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
  });

  afterEach(() => {
    process.env = { ...envBackup };
    vi.clearAllMocks();
  });

  it('returns true when env vars are set (google)', async () => {
    process.env.GOOGLE_CLIENT_ID = 'gid';
    process.env.GOOGLE_CLIENT_SECRET = 'gsecret';

    const ok = await isOAuthLoginProviderConfigured('google');
    expect(ok).toBe(true);
    expect(db.select).not.toHaveBeenCalled();
  });

  it('returns true when env vars are set (github)', async () => {
    process.env.GITHUB_CLIENT_ID = 'hid';
    process.env.GITHUB_CLIENT_SECRET = 'hsecret';

    const ok = await isOAuthLoginProviderConfigured('github');
    expect(ok).toBe(true);
    expect(db.select).not.toHaveBeenCalled();
  });

  it('falls back to DB when env vars are missing', async () => {
    (db.select as any).mockReturnValueOnce(mockSelectLimit([{ clientId: 'x', clientSecret: 'y' }]));

    const ok = await isOAuthLoginProviderConfigured('google');
    expect(ok).toBe(true);
  });

  it('returns false when DB has no enabled config', async () => {
    (db.select as any).mockReturnValueOnce(mockSelectLimit([]));
    const ok = await isOAuthLoginProviderConfigured('github');
    expect(ok).toBe(false);
  });

  it('returns false when DB record is missing id/secret', async () => {
    (db.select as any).mockReturnValueOnce(mockSelectLimit([{ clientId: 'x', clientSecret: '' }]));
    const ok = await isOAuthLoginProviderConfigured('github');
    expect(ok).toBe(false);
  });
});


