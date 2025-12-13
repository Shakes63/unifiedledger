/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock('@/lib/encryption/oauth-encryption', () => ({
  decryptOAuthSecret: vi.fn(),
}));

import { decryptOAuthSecret } from '@/lib/encryption/oauth-encryption';
import { loadOAuthSettingsFromDatabase } from '@/lib/auth/load-oauth-settings';

function mockSelectWhere(rows: any[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  };
}

describe('loadOAuthSettingsFromDatabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (decryptOAuthSecret as any).mockImplementation((s: string) => `decrypted:${s}`);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no enabled settings exist', async () => {
    (db.select as any).mockReturnValueOnce(mockSelectWhere([]));
    const result = await loadOAuthSettingsFromDatabase();
    expect(result).toBeNull();
  });

  it('returns decrypted configs for providers', async () => {
    (db.select as any).mockReturnValueOnce(
      mockSelectWhere([
        { providerId: 'google', clientId: 'gid', clientSecret: 'enc-g' },
        { providerId: 'github', clientId: 'hid', clientSecret: 'enc-h' },
      ])
    );

    const result = await loadOAuthSettingsFromDatabase();
    expect(result).toEqual({
      google: { clientId: 'gid', clientSecret: 'decrypted:enc-g' },
      github: { clientId: 'hid', clientSecret: 'decrypted:enc-h' },
    });
  });

  it('skips a provider if decryption fails and returns null if none remain', async () => {
    (db.select as any).mockReturnValueOnce(
      mockSelectWhere([{ providerId: 'google', clientId: 'gid', clientSecret: 'enc-g' }])
    );
    (decryptOAuthSecret as any).mockImplementation(() => {
      throw new Error('bad key');
    });

    const result = await loadOAuthSettingsFromDatabase();
    expect(result).toBeNull();
  });

  it('continues when one provider fails decryption but others succeed', async () => {
    (db.select as any).mockReturnValueOnce(
      mockSelectWhere([
        { providerId: 'google', clientId: 'gid', clientSecret: 'enc-g' },
        { providerId: 'github', clientId: 'hid', clientSecret: 'enc-h' },
      ])
    );

    (decryptOAuthSecret as any).mockImplementation((enc: string) => {
      if (enc === 'enc-g') throw new Error('bad');
      return `ok:${enc}`;
    });

    const result = await loadOAuthSettingsFromDatabase();
    expect(result).toEqual({
      github: { clientId: 'hid', clientSecret: 'ok:enc-h' },
    });
  });
});


