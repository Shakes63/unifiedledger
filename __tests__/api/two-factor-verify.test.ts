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
    verifyTwoFactorToken: vi.fn(),
    generateBackupCodes: vi.fn(),
  };
});

import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { verifyTwoFactorToken, generateBackupCodes } from '@/lib/auth/two-factor-utils';

const TEST_USER_ID = 'user-123';

function createRequest(body: unknown): Request {
  return { json: async () => body } as Request;
}

describe('app/api/user/two-factor/verify/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthorized', async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new Error('Unauthorized'));

    const { POST } = await import('@/app/api/user/two-factor/verify/route');
    const res = await POST(createRequest({ token: '123456' }) as never);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data).toEqual({ error: 'Unauthorized' });
  });

  it('returns 400 when token is missing', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: TEST_USER_ID });

    const { POST } = await import('@/app/api/user/two-factor/verify/route');
    const res = await POST(createRequest({}) as never);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Verification token is required');
  });

  it('returns 400 when setup not started (no secret)', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: TEST_USER_ID });

    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              id: TEST_USER_ID,
              twoFactorSecret: null,
              twoFactorEnabled: false,
            },
          ],
        }),
      }),
    } as unknown);

    const { POST } = await import('@/app/api/user/two-factor/verify/route');
    const res = await POST(createRequest({ token: '123456' }) as never);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Two-factor authentication setup not started');
  });

  it('returns 400 when already enabled', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: TEST_USER_ID });

    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              id: TEST_USER_ID,
              twoFactorSecret: 'BASE32',
              twoFactorEnabled: true,
            },
          ],
        }),
      }),
    } as unknown);

    const { POST } = await import('@/app/api/user/two-factor/verify/route');
    const res = await POST(createRequest({ token: '123456' }) as never);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Two-factor authentication is already enabled');
  });

  it('returns 400 when verification token is invalid', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: TEST_USER_ID });
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              id: TEST_USER_ID,
              twoFactorSecret: 'BASE32',
              twoFactorEnabled: false,
            },
          ],
        }),
      }),
    } as unknown);

    vi.mocked(verifyTwoFactorToken).mockReturnValueOnce(false);

    const { POST } = await import('@/app/api/user/two-factor/verify/route');
    const res = await POST(createRequest({ token: '000000' }) as never);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Invalid verification code');
  });

  it('enables 2FA and returns plaintext backup codes once when token valid', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: TEST_USER_ID });

    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              id: TEST_USER_ID,
              twoFactorSecret: 'BASE32',
              twoFactorEnabled: false,
            },
          ],
        }),
      }),
    } as unknown);

    vi.mocked(verifyTwoFactorToken).mockReturnValueOnce(true);
    vi.mocked(generateBackupCodes).mockReturnValueOnce({
      plaintextCodes: ['CODE1', 'CODE2'],
      hashedCodes: ['HASH1', 'HASH2'],
    });

    const where = vi.fn(async () => undefined);
    const set = vi.fn(() => ({ where }));
    vi.mocked(db.update).mockReturnValueOnce({ set } as unknown);

    const { POST } = await import('@/app/api/user/two-factor/verify/route');
    const res = await POST(createRequest({ token: '123456' }) as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.backupCodes).toEqual(['CODE1', 'CODE2']);
    expect(data.message).toBe('Two-factor authentication enabled successfully');

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        twoFactorEnabled: true,
        twoFactorBackupCodes: JSON.stringify(['HASH1', 'HASH2']),
        twoFactorVerifiedAt: expect.any(Date),
        updatedAt: expect.any(Date),
      })
    );
    expect(where).toHaveBeenCalledTimes(1);
  });
});


