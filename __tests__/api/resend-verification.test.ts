/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    delete: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock('@/lib/email/email-service', () => ({
  sendVerificationEmail: vi.fn(),
}));

vi.mock('@/lib/email/email-config', () => ({
  getAppUrl: vi.fn(),
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn(),
}));

import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { sendVerificationEmail } from '@/lib/email/email-service';
import { getAppUrl } from '@/lib/email/email-config';
import { nanoid } from 'nanoid';

describe('POST /api/user/resend-verification', () => {
  let originalDateNow: (() => number) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    (requireAuth as any).mockResolvedValue({ userId: 'user-1' });
    (getAppUrl as any).mockReturnValue('http://localhost:3000');

    // Deterministic nanoid behavior
    (nanoid as any).mockImplementation((len?: number) => {
      if (len === 32) return 'token-32';
      return 'id-1';
    });

    // Default db chains
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { id: 'user-1', email: 'test@example.com', name: 'Test', emailVerified: false },
          ]),
        }),
      }),
    });

    (db.delete as any).mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    (db.insert as any).mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });

    (sendVerificationEmail as any).mockResolvedValue(undefined);

    // Freeze time so we can control rate-limit reset windows
    originalDateNow = Date.now;
    Date.now = vi.fn(() => 1734048000000) as any; // 2024-12-13T00:00:00.000Z
  });

  afterEach(() => {
    if (originalDateNow) Date.now = originalDateNow;
    originalDateNow = null;
    vi.clearAllMocks();
  });

  it('returns 401 when unauthorized', async () => {
    (requireAuth as any).mockRejectedValue(new Error('Unauthorized'));
    const { POST } = await import('@/app/api/user/resend-verification/route');

    const res = await POST();
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 404 when user not found', async () => {
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const { POST } = await import('@/app/api/user/resend-verification/route');
    const res = await POST();
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe('User not found');
  });

  it('returns 400 when email already verified', async () => {
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { id: 'user-1', email: 'test@example.com', name: 'Test', emailVerified: true },
          ]),
        }),
      }),
    });

    const { POST } = await import('@/app/api/user/resend-verification/route');
    const res = await POST();
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Email already verified');
  });

  it('enforces rate limit of 3 requests per hour', async () => {
    const { POST } = await import('@/app/api/user/resend-verification/route');

    const r1 = await POST();
    expect(r1.status).toBe(200);

    const r2 = await POST();
    expect(r2.status).toBe(200);

    const r3 = await POST();
    expect(r3.status).toBe(200);

    const r4 = await POST();
    const d4 = await r4.json();
    expect(r4.status).toBe(429);
    expect(d4.error).toContain('Too many requests');

    expect(sendVerificationEmail).toHaveBeenCalledTimes(3);
  });
});
