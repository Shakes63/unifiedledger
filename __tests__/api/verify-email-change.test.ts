/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/auth/verify-email-change/route';

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { db } from '@/lib/db';

function createRequest(url: string): Request {
  return new Request(url, { method: 'GET' });
}

function mockSelectLimit(rows: any[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

describe('GET /api/auth/verify-email-change', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (db.delete as any).mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    (db.update as any).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
  });

  it('redirects to settings with invalid_token when token missing', async () => {
    const res = await GET(createRequest('http://localhost/api/auth/verify-email-change') as any);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.headers.get('location')).toContain('/dashboard/settings');
    expect(res.headers.get('location')).toContain('error=invalid_token');
  });

  it('redirects to settings with invalid_token when token not found', async () => {
    (db.select as any).mockReturnValueOnce(mockSelectLimit([]));

    const res = await GET(createRequest('http://localhost/api/auth/verify-email-change?token=bad') as any);
    expect(res.headers.get('location')).toContain('error=invalid_token');
  });

  it('redirects to settings with token_expired when verification is expired', async () => {
    (db.select as any).mockReturnValueOnce(
      mockSelectLimit([
        { id: 'v1', identifier: 'email-change:user-1', value: 'tok', expiresAt: new Date(0) },
      ])
    );

    const res = await GET(createRequest('http://localhost/api/auth/verify-email-change?token=tok') as any);
    expect(res.headers.get('location')).toContain('error=token_expired');
    expect(db.delete).toHaveBeenCalled();
  });

  it('completes email change and redirects to /email-verified when valid', async () => {
    // verification record
    (db.select as any)
      .mockReturnValueOnce(
        mockSelectLimit([
          {
            id: 'v1',
            identifier: 'email-change:user-1',
            value: 'tok',
            expiresAt: new Date(Date.now() + 60_000),
          },
        ])
      )
      // user record with pendingEmail
      .mockReturnValueOnce(
        mockSelectLimit([
          { id: 'user-1', pendingEmail: 'new@example.com', email: 'old@example.com' },
        ])
      );

    const res = await GET(createRequest('http://localhost/api/auth/verify-email-change?token=tok') as any);

    expect(res.headers.get('location')).toContain('/email-verified');
    expect(res.headers.get('location')).toContain('email_changed=true');
    expect(db.update).toHaveBeenCalled();
    expect(db.delete).toHaveBeenCalled();
  });
});
