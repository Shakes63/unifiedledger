import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/auth/two-factor-utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/two-factor-utils')>(
    '@/lib/auth/two-factor-utils'
  );
  return {
    ...actual,
    generateBackupCodes: vi.fn(),
  };
});

import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { generateBackupCodes } from '@/lib/auth/two-factor-utils';

const TEST_USER_ID = 'user-123';

describe('app/api/user/two-factor/backup-codes/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthorized', async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new Error('Unauthorized'));

    const { GET } = await import('@/app/api/user/two-factor/backup-codes/route');
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data).toEqual({ error: 'Unauthorized' });
  });

  it('returns 400 when 2FA is not enabled', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: TEST_USER_ID });
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              id: TEST_USER_ID,
              twoFactorEnabled: false,
            },
          ],
        }),
      }),
    } as unknown);

    const { GET } = await import('@/app/api/user/two-factor/backup-codes/route');
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Two-factor authentication is not enabled');
  });

  it('returns new plaintext codes and stores new hashed codes (invalidating old)', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: TEST_USER_ID });
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              id: TEST_USER_ID,
              twoFactorEnabled: true,
              twoFactorBackupCodes: JSON.stringify(['OLD1']),
            },
          ],
        }),
      }),
    } as unknown);

    vi.mocked(generateBackupCodes).mockReturnValueOnce({
      plaintextCodes: ['NEWCODE1', 'NEWCODE2'],
      hashedCodes: ['NEWHASH1', 'NEWHASH2'],
    });

    const where = vi.fn(async () => undefined);
    const set = vi.fn(() => ({ where }));
    vi.mocked(db.update).mockReturnValueOnce({ set } as unknown);

    const { GET } = await import('@/app/api/user/two-factor/backup-codes/route');
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.backupCodes).toEqual(['NEWCODE1', 'NEWCODE2']);
    expect(data.message).toBe('New backup codes generated. Old codes are no longer valid.');

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        twoFactorBackupCodes: JSON.stringify(['NEWHASH1', 'NEWHASH2']),
        updatedAt: expect.any(Date),
      })
    );
    expect(where).toHaveBeenCalledTimes(1);
  });
});


