/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/api/household-auth', () => ({
  getAndVerifyHousehold: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';

function createRequest(url: string): Request {
  return new Request(url, { method: 'GET', headers: { 'x-household-id': 'hh-1' } });
}

function mockSelectMany(rows: any[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockResolvedValue(rows),
          }),
        }),
      }),
    }),
  };
}

function mockSelectCount(count: number) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(Array.from({ length: count }, (_, i) => ({ id: `b${i}` }))),
    }),
  };
}

describe('GET /api/user/backups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as any).mockResolvedValue({ userId: 'user-1' });
    (getAndVerifyHousehold as any).mockResolvedValue({ householdId: 'hh-1' });

    (db.select as any)
      .mockReturnValueOnce(mockSelectMany([{ id: 'backup-1' }]))
      .mockReturnValueOnce(mockSelectCount(1));
  });

  it('returns 401 when unauthorized', async () => {
    (requireAuth as any).mockRejectedValue(new Error('Unauthorized'));
    const { GET } = await import('@/app/api/user/backups/route');

    const res = await GET(createRequest('http://localhost/api/user/backups') as any);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns backups list response shape', async () => {
    const { GET } = await import('@/app/api/user/backups/route');

    const res = await GET(createRequest('http://localhost/api/user/backups?limit=50&offset=0') as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(data.backups)).toBe(true);
    expect(data.total).toBe(1);
    expect(data.limit).toBe(50);
    expect(data.offset).toBe(0);
  });
});
