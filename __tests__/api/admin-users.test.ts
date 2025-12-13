/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/owner-helpers', () => ({
  requireOwner: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock('@/lib/better-auth', () => ({
  auth: {
    api: {
      signUpEmail: vi.fn(),
    },
  },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'id-1'),
}));

import { requireOwner } from '@/lib/auth/owner-helpers';
import { db } from '@/lib/db';
import { auth } from '@/lib/better-auth';

function createReq(url: string, init?: RequestInit): Request {
  return new Request(url, init);
}

describe('app/api/admin/users/route - GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthorized', async () => {
    (requireOwner as any).mockRejectedValueOnce(new Error('Unauthorized'));
    const { GET } = await import('@/app/api/admin/users/route');
    const res = await GET(createReq('http://localhost/api/admin/users'));
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 403 when not owner', async () => {
    (requireOwner as any).mockRejectedValueOnce(new Error('Forbidden: Owner access required'));
    const { GET } = await import('@/app/api/admin/users/route');
    const res = await GET(createReq('http://localhost/api/admin/users'));
    const data = await res.json();
    expect(res.status).toBe(403);
    expect(data.error).toContain('Owner');
  });

  it('returns users list with householdCount and pagination fields', async () => {
    (requireOwner as any).mockResolvedValueOnce({ userId: 'owner-1', isOwner: true });

    // total count query
    (db.select as any)
      .mockReturnValueOnce({
        from: async () => [{ id: 'u1' }, { id: 'u2' }],
      })
      // users page query with .$dynamic
      .mockReturnValueOnce({
        from: () => ({
          $dynamic: () => ({
            limit: (limit: number) => ({
              offset: async (offset: number) => {
                expect(limit).toBe(2);
                expect(offset).toBe(0);
                return [
                  { id: 'u1', email: 'a@example.com', name: 'A', createdAt: '2025-01-01' },
                  { id: 'u2', email: 'b@example.com', name: 'B', createdAt: '2025-01-02' },
                ];
              },
            }),
          }),
        }),
      })
      // household count u1
      .mockReturnValueOnce({
        from: () => ({
          where: async () => [{ id: 'hm1' }],
        }),
      })
      // household count u2
      .mockReturnValueOnce({
        from: () => ({
          where: async () => [{ id: 'hm1' }, { id: 'hm2' }],
        }),
      });

    const { GET } = await import('@/app/api/admin/users/route');
    const res = await GET(createReq('http://localhost/api/admin/users?limit=2&offset=0'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.total).toBe(2);
    expect(data.limit).toBe(2);
    expect(data.offset).toBe(0);
    expect(data.users).toEqual([
      expect.objectContaining({ id: 'u1', householdCount: 1 }),
      expect.objectContaining({ id: 'u2', householdCount: 2 }),
    ]);
  });
});

describe('app/api/admin/users/route - POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthorized', async () => {
    (requireOwner as any).mockRejectedValueOnce(new Error('Unauthorized'));
    const { POST } = await import('@/app/api/admin/users/route');
    const res = await POST(
      createReq('http://localhost/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ email: 'a@example.com', password: 'password123' }),
      })
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing email/password', async () => {
    (requireOwner as any).mockResolvedValueOnce({ userId: 'owner-1', isOwner: true });
    const { POST } = await import('@/app/api/admin/users/route');
    const res = await POST(
      createReq('http://localhost/api/admin/users', { method: 'POST', body: JSON.stringify({}) })
    );
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain('Email and password');
  });

  it('returns 400 for invalid email', async () => {
    (requireOwner as any).mockResolvedValueOnce({ userId: 'owner-1', isOwner: true });
    const { POST } = await import('@/app/api/admin/users/route');
    const res = await POST(
      createReq('http://localhost/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ email: 'nope', password: 'password123' }),
      })
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for weak password', async () => {
    (requireOwner as any).mockResolvedValueOnce({ userId: 'owner-1', isOwner: true });
    const { POST } = await import('@/app/api/admin/users/route');
    const res = await POST(
      createReq('http://localhost/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ email: 'a@example.com', password: 'short' }),
      })
    );
    expect(res.status).toBe(400);
  });

  it('returns 409 when email already exists', async () => {
    (requireOwner as any).mockResolvedValueOnce({ userId: 'owner-1', isOwner: true });

    (db.select as any).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [{ id: 'u1' }],
        }),
      }),
    });

    const { POST } = await import('@/app/api/admin/users/route');
    const res = await POST(
      createReq('http://localhost/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ email: 'a@example.com', password: 'password123' }),
      })
    );
    expect(res.status).toBe(409);
  });

  it('returns 201 on success and optionally inserts household membership', async () => {
    (requireOwner as any).mockResolvedValueOnce({ userId: 'owner-1', isOwner: true });

    // email exists check -> empty
    (db.select as any)
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      })
      // household exists check
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: async () => [{ id: 'h1' }],
          }),
        }),
      })
      // existing membership check
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      });

    (auth.api.signUpEmail as any).mockResolvedValueOnce({
      user: { id: 'new-user', email: 'a@example.com', name: 'A' },
    });

    (db.insert as any).mockReturnValueOnce({
      values: async () => undefined,
    });

    const { POST } = await import('@/app/api/admin/users/route');
    const res = await POST(
      createReq('http://localhost/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'a@example.com',
          password: 'password123',
          name: 'A',
          householdId: 'h1',
          role: 'member',
        }),
      })
    );
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.id).toBe('new-user');
    expect(data.householdId).toBe('h1');
    expect(data.role).toBe('member');
    expect(db.insert).toHaveBeenCalledTimes(1);
  });
});


