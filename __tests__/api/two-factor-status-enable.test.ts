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

// Keep QR generation deterministic and fast
vi.mock('@/lib/auth/two-factor-utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/two-factor-utils')>(
    '@/lib/auth/two-factor-utils'
  );
  return {
    ...actual,
    generateTwoFactorSecret: vi.fn(() => ({
      secret: 'BASE32SECRET',
      otpauthUrl: 'otpauth://totp/Unified%20Ledger:test@example.com?secret=BASE32SECRET',
    })),
    generateQRCode: vi.fn(async () => 'data:image/png;base64,QR'),
  };
});

import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

const TEST_USER_ID = 'user-123';

describe('app/api/user/two-factor/status/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthorized', async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new Error('Unauthorized'));

    const { GET } = await import('@/app/api/user/two-factor/status/route');
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data).toEqual({ error: 'Unauthorized' });
  });

  it('returns disabled status when user has 2FA off and no codes', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: TEST_USER_ID });

    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              twoFactorEnabled: false,
              twoFactorVerifiedAt: null,
              hasBackupCodes: null,
            },
          ],
        }),
      }),
    } as unknown);

    const { GET } = await import('@/app/api/user/two-factor/status/route');
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      enabled: false,
      verifiedAt: null,
      backupCodesCount: 0,
      isSetupComplete: false,
    });
  });

  it('returns enabled status and counts backup codes when JSON is valid', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: TEST_USER_ID });

    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              twoFactorEnabled: true,
              twoFactorVerifiedAt: '2025-01-01T00:00:00.000Z',
              hasBackupCodes: JSON.stringify(['h1', 'h2', 'h3']),
            },
          ],
        }),
      }),
    } as unknown);

    const { GET } = await import('@/app/api/user/two-factor/status/route');
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.enabled).toBe(true);
    expect(data.backupCodesCount).toBe(3);
    expect(data.verifiedAt).toBe('2025-01-01T00:00:00.000Z');
    expect(data.isSetupComplete).toBe(true);
  });

  it('returns backupCodesCount=0 when backup codes JSON is invalid', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: TEST_USER_ID });

    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              twoFactorEnabled: true,
              twoFactorVerifiedAt: null,
              hasBackupCodes: 'not-json',
            },
          ],
        }),
      }),
    } as unknown);

    const { GET } = await import('@/app/api/user/two-factor/status/route');
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.backupCodesCount).toBe(0);
  });
});

describe('app/api/user/two-factor/enable/route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthorized', async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new Error('Unauthorized'));

    const { POST } = await import('@/app/api/user/two-factor/enable/route');
    const res = await POST();
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data).toEqual({ error: 'Unauthorized' });
  });

  it('returns 400 when already enabled', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: TEST_USER_ID });

    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              id: TEST_USER_ID,
              email: 'test@example.com',
              twoFactorEnabled: true,
            },
          ],
        }),
      }),
    } as unknown);

    const { POST } = await import('@/app/api/user/two-factor/enable/route');
    const res = await POST();
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Two-factor authentication is already enabled');
  });

  it('returns secret/qrCode/otpauthUrl and stores secret when enabling', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ userId: TEST_USER_ID });

    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              id: TEST_USER_ID,
              email: 'test@example.com',
              twoFactorEnabled: false,
            },
          ],
        }),
      }),
    } as unknown);

    const where = vi.fn(async () => undefined);
    const set = vi.fn(() => ({ where }));
    vi.mocked(db.update).mockReturnValueOnce({ set } as unknown);

    const { POST } = await import('@/app/api/user/two-factor/enable/route');
    const res = await POST();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      secret: 'BASE32SECRET',
      qrCode: 'data:image/png;base64,QR',
      otpauthUrl: 'otpauth://totp/Unified%20Ledger:test@example.com?secret=BASE32SECRET',
    });

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        twoFactorSecret: 'BASE32SECRET',
        updatedAt: expect.any(Date),
      })
    );
    expect(where).toHaveBeenCalledTimes(1);
  });
});


