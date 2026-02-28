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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when DB has enabled provider config', async () => {
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


