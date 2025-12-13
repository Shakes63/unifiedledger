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
    verifyBackupCode: vi.fn(),
  };
});

import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { verifyTwoFactorToken, verifyBackupCode } from '@/lib/auth/two-factor-utils';

const TEST_USER_ID = 'user-123';

function createRequest(body: unknown): Request {
  return { json: async () => body } as Request;
}

describe('app/api/user/two-factor/disable/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthorized', async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new Error('Unauthorized'));

    const { POST } = await import('@/app/api/user/two-factor/disable/route');
    const res = await POST(createRequest({ token: '123456' }) as never);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data).toEqual({ error: 'Unauthorized' });
  });

  it('returns 400 when token missing', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: TEST_USER_ID });

    const { POST } = await import('@/app/api/user/two-factor/disable/route');
    const res = await POST(createRequest({}) as never);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('2FA verification code is required');
  });

  it('returns 400 when 2FA not enabled', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: TEST_USER_ID });
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              id: TEST_USER_ID,
              twoFactorEnabled: false,
              twoFactorSecret: 'BASE32',
            },
          ],
        }),
      }),
    } as unknown);

    const { POST } = await import('@/app/api/user/two-factor/disable/route');
    const res = await POST(createRequest({ token: '123456' }) as never);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Two-factor authentication is not enabled');
  });

  it('returns 400 when secret missing', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: TEST_USER_ID });
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              id: TEST_USER_ID,
              twoFactorEnabled: true,
              twoFactorSecret: null,
            },
          ],
        }),
      }),
    } as unknown);

    const { POST } = await import('@/app/api/user/two-factor/disable/route');
    const res = await POST(createRequest({ token: '123456' }) as never);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Two-factor authentication secret not found');
  });

  it('returns 400 when token invalid and no valid backup code', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: TEST_USER_ID });
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              id: TEST_USER_ID,
              twoFactorEnabled: true,
              twoFactorSecret: 'BASE32',
              twoFactorBackupCodes: JSON.stringify(['H1']),
            },
          ],
        }),
      }),
    } as unknown);

    vi.mocked(verifyTwoFactorToken).mockReturnValueOnce(false);
    vi.mocked(verifyBackupCode).mockReturnValueOnce(false);

    const { POST } = await import('@/app/api/user/two-factor/disable/route');
    const res = await POST(createRequest({ token: '000000' }) as never);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Invalid verification code');
  });

  it('disables 2FA when TOTP token is valid', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: TEST_USER_ID });
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              id: TEST_USER_ID,
              twoFactorEnabled: true,
              twoFactorSecret: 'BASE32',
              twoFactorBackupCodes: JSON.stringify(['H1']),
              twoFactorVerifiedAt: '2025-01-01T00:00:00.000Z',
            },
          ],
        }),
      }),
    } as unknown);

    vi.mocked(verifyTwoFactorToken).mockReturnValueOnce(true);

    const where = vi.fn(async () => undefined);
    const set = vi.fn(() => ({ where }));
    vi.mocked(db.update).mockReturnValueOnce({ set } as unknown);

    const { POST } = await import('@/app/api/user/two-factor/disable/route');
    const res = await POST(createRequest({ token: '123456' }) as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Two-factor authentication disabled successfully');

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
        twoFactorVerifiedAt: null,
        updatedAt: expect.any(Date),
      })
    );
  });

  it('accepts a valid backup code and clears 2FA', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: TEST_USER_ID });
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              id: TEST_USER_ID,
              twoFactorEnabled: true,
              twoFactorSecret: 'BASE32',
              twoFactorBackupCodes: JSON.stringify(['HASH1', 'HASH2']),
            },
          ],
        }),
      }),
    } as unknown);

    vi.mocked(verifyTwoFactorToken).mockReturnValueOnce(false);
    vi.mocked(verifyBackupCode).mockReturnValueOnce(true);

    // Route updates backup codes (removes used) and then disables 2FA
    const where1 = vi.fn(async () => undefined);
    const set1 = vi.fn(() => ({ where: where1 }));
    const where2 = vi.fn(async () => undefined);
    const set2 = vi.fn(() => ({ where: where2 }));
    vi.mocked(db.update).mockReturnValueOnce({ set: set1 } as unknown).mockReturnValueOnce({
      set: set2,
    } as unknown);

    const { POST } = await import('@/app/api/user/two-factor/disable/route');
    const res = await POST(createRequest({ token: 'BACKUPCODE' }) as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(set2).toHaveBeenCalledWith(
      expect.objectContaining({
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
        twoFactorVerifiedAt: null,
      })
    );
  });
});


