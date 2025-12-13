import { describe, it, expect, vi, beforeEach } from 'vitest';

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

import { db } from '@/lib/db';
import { verifyTwoFactorToken, verifyBackupCode } from '@/lib/auth/two-factor-utils';

function createRequestWithJson(url: string, body: unknown): Request {
  return {
    url,
    json: async () => body,
  } as Request;
}

describe('app/api/user/two-factor/verify-login/route (GET check-required)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when email missing', async () => {
    const { GET } = await import('@/app/api/user/two-factor/verify-login/route');
    const req = new Request('http://localhost/api/user/two-factor/verify-login');
    const res = await GET(req as never);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe('Email is required');
  });

  it('returns 404 when user not found', async () => {
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [],
        }),
      }),
    } as unknown);

    const { GET } = await import('@/app/api/user/two-factor/verify-login/route');
    const req = new Request('http://localhost/api/user/two-factor/verify-login?email=test@example.com');
    const res = await GET(req as never);
    const data = await res.json();
    expect(res.status).toBe(404);
    expect(data.error).toBe('User not found');
  });

  it('returns required=true when twoFactorEnabled', async () => {
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              id: 'u1',
              email: 'test@example.com',
              twoFactorEnabled: true,
            },
          ],
        }),
      }),
    } as unknown);

    const { GET } = await import('@/app/api/user/two-factor/verify-login/route');
    const req = new Request('http://localhost/api/user/two-factor/verify-login?email=test@example.com');
    const res = await GET(req as never);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({ required: true, userId: 'u1' });
  });
});

describe('app/api/user/two-factor/verify-login/route (POST)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when email missing', async () => {
    const { POST } = await import('@/app/api/user/two-factor/verify-login/route');
    const res = await POST(createRequestWithJson('http://localhost/api/user/two-factor/verify-login', { token: '123456' }) as never);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe('Email is required');
  });

  it('returns 400 when token missing', async () => {
    const { POST } = await import('@/app/api/user/two-factor/verify-login/route');
    const res = await POST(createRequestWithJson('http://localhost/api/user/two-factor/verify-login', { email: 'test@example.com' }) as never);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe('Verification code is required');
  });

  it('returns 404 when user not found', async () => {
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [],
        }),
      }),
    } as unknown);

    const { POST } = await import('@/app/api/user/two-factor/verify-login/route');
    const res = await POST(
      createRequestWithJson('http://localhost/api/user/two-factor/verify-login', {
        email: 'test@example.com',
        token: '123456',
      }) as never
    );
    const data = await res.json();
    expect(res.status).toBe(404);
    expect(data.error).toBe('User not found');
  });

  it('returns 400 when 2FA not enabled', async () => {
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              id: 'u1',
              email: 'test@example.com',
              twoFactorEnabled: false,
            },
          ],
        }),
      }),
    } as unknown);

    const { POST } = await import('@/app/api/user/two-factor/verify-login/route');
    const res = await POST(
      createRequestWithJson('http://localhost/api/user/two-factor/verify-login', {
        email: 'test@example.com',
        token: '123456',
      }) as never
    );
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe('Two-factor authentication is not enabled for this account');
  });

  it('returns 400 when secret missing', async () => {
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              id: 'u1',
              email: 'test@example.com',
              twoFactorEnabled: true,
              twoFactorSecret: null,
            },
          ],
        }),
      }),
    } as unknown);

    const { POST } = await import('@/app/api/user/two-factor/verify-login/route');
    const res = await POST(
      createRequestWithJson('http://localhost/api/user/two-factor/verify-login', {
        email: 'test@example.com',
        token: '123456',
      }) as never
    );
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe('Two-factor authentication secret not found');
  });

  it('returns 400 when token invalid and backup code invalid', async () => {
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              id: 'u1',
              email: 'test@example.com',
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

    const { POST } = await import('@/app/api/user/two-factor/verify-login/route');
    const res = await POST(
      createRequestWithJson('http://localhost/api/user/two-factor/verify-login', {
        email: 'test@example.com',
        token: '000000',
      }) as never
    );
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe('Invalid verification code');
  });

  it('returns success when TOTP is valid', async () => {
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              id: 'u1',
              email: 'test@example.com',
              twoFactorEnabled: true,
              twoFactorSecret: 'BASE32',
              twoFactorBackupCodes: null,
            },
          ],
        }),
      }),
    } as unknown);

    vi.mocked(verifyTwoFactorToken).mockReturnValueOnce(true);

    const { POST } = await import('@/app/api/user/two-factor/verify-login/route');
    const res = await POST(
      createRequestWithJson('http://localhost/api/user/two-factor/verify-login', {
        email: 'test@example.com',
        token: '123456',
      }) as never
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.userId).toBe('u1');
  });

  it('accepts backup code, consumes it, and returns success', async () => {
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              id: 'u1',
              email: 'test@example.com',
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

    const where = vi.fn(async () => undefined);
    const set = vi.fn(() => ({ where }));
    vi.mocked(db.update).mockReturnValueOnce({ set } as unknown);

    const { POST } = await import('@/app/api/user/two-factor/verify-login/route');
    const res = await POST(
      createRequestWithJson('http://localhost/api/user/two-factor/verify-login', {
        email: 'test@example.com',
        token: 'BACKUPCODE',
      }) as never
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.userId).toBe('u1');
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        twoFactorBackupCodes: expect.any(String),
        updatedAt: expect.any(Date),
      })
    );
  });
});


