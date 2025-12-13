/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET, POST } from '@/app/api/admin/oauth-settings/route';
import { db } from '@/lib/db';
import { oauthSettings } from '@/lib/db/schema';

vi.mock('@/lib/auth/owner-helpers', () => ({
  requireOwner: vi.fn(),
}));

vi.mock('@/lib/encryption/oauth-encryption', () => ({
  encryptOAuthSecret: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('uuid', () => ({
  v4: vi.fn(),
}));

import { requireOwner } from '@/lib/auth/owner-helpers';
import { encryptOAuthSecret } from '@/lib/encryption/oauth-encryption';
import { v4 as uuidv4 } from 'uuid';

function createMockRequest(body?: any): any {
  return {
    json: async () => body ?? {},
  };
}

function mockSelectOrderBy(rows: any[]) {
  return {
    from: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockResolvedValue(rows),
    }),
  };
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

describe('Admin OAuth Settings API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireOwner as any).mockResolvedValue({ userId: 'owner-1', isOwner: true });
    (uuidv4 as any).mockReturnValue('uuid-1');
    (encryptOAuthSecret as any).mockReturnValue('encrypted-secret');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/admin/oauth-settings', () => {
    it('returns 401 when not authenticated', async () => {
      (requireOwner as any).mockRejectedValue(new Error('Unauthorized'));
      const res = await GET();
      const data = await res.json();
      expect(res.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 403 when not owner', async () => {
      (requireOwner as any).mockRejectedValue(new Error('Forbidden: Owner access required'));
      const res = await GET();
      const data = await res.json();
      expect(res.status).toBe(403);
      expect(data.error).toBe('Forbidden: Owner access required');
    });

    it('returns providers without secrets (write-only) and hasClientSecret flag', async () => {
      const rows = [
        {
          id: 'row-1',
          providerId: 'google',
          clientId: 'google-id',
          clientSecret: 'encrypted',
          enabled: true,
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
        {
          id: 'row-2',
          providerId: 'github',
          clientId: 'gh-id',
          clientSecret: '',
          enabled: false,
          createdAt: '2025-01-02T00:00:00.000Z',
          updatedAt: '2025-01-02T00:00:00.000Z',
        },
      ];

      (db.select as any).mockReturnValue(mockSelectOrderBy(rows));

      const res = await GET();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.providers).toHaveLength(2);
      expect(data.providers[0]).toEqual({
        id: 'row-1',
        providerId: 'google',
        clientId: 'google-id',
        hasClientSecret: true,
        enabled: true,
        createdAt: rows[0].createdAt,
        updatedAt: rows[0].updatedAt,
      });
      expect(data.providers[1].hasClientSecret).toBe(false);
      expect((data.providers[0] as any).clientSecret).toBeUndefined();
    });
  });

  describe('POST /api/admin/oauth-settings', () => {
    it('validates providerId presence', async () => {
      const res = await POST(createMockRequest({ clientId: 'x', clientSecret: 'y' }));
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe('providerId is required');
    });

    it('validates providerId allowed values', async () => {
      const res = await POST(createMockRequest({ providerId: 'facebook' }));
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe('providerId must be "google", "github", or "ticktick"');
    });

    it('requires clientId and clientSecret when enabling a new provider', async () => {
      (db.select as any).mockReturnValue(mockSelectLimit([]));

      const res = await POST(createMockRequest({ providerId: 'google', enabled: true, clientId: '  ' }));
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe('clientId is required');

      const res2 = await POST(createMockRequest({ providerId: 'google', enabled: true, clientId: 'google-id', clientSecret: '  ' }));
      const data2 = await res2.json();
      expect(res2.status).toBe(400);
      expect(data2.error).toBe('clientSecret is required');
    });

    it('cannot disable a provider with no saved settings', async () => {
      (db.select as any).mockReturnValue(mockSelectLimit([]));

      const res = await POST(createMockRequest({ providerId: 'github', enabled: false }));
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe('Cannot disable provider that has no saved settings');
    });

    it('returns 500 when secret encryption fails', async () => {
      (db.select as any).mockReturnValue(mockSelectLimit([]));
      (encryptOAuthSecret as any).mockImplementation(() => {
        throw new Error('boom');
      });

      const res = await POST(createMockRequest({ providerId: 'google', enabled: true, clientId: 'google-id', clientSecret: 'secret' }));
      const data = await res.json();
      expect(res.status).toBe(500);
      expect(data.error).toBe('Failed to encrypt client secret');
    });

    it('creates a new provider setting (secrets write-only)', async () => {
      (db.select as any).mockReturnValue(mockSelectLimit([]));

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 'uuid-1',
              providerId: 'google',
              clientId: 'google-id',
              clientSecret: 'encrypted-secret',
              enabled: true,
              createdAt: '2025-01-03T00:00:00.000Z',
              updatedAt: '2025-01-03T00:00:00.000Z',
            },
          ]),
        }),
      });
      (db.insert as any).mockImplementation(mockInsert);

      const res = await POST(createMockRequest({ providerId: 'google', enabled: true, clientId: 'google-id', clientSecret: 'secret' }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(encryptOAuthSecret).toHaveBeenCalledWith('secret');
      expect(mockInsert).toHaveBeenCalledWith(oauthSettings);
      expect(data.providerId).toBe('google');
      expect(data.clientId).toBe('google-id');
      expect(data.hasClientSecret).toBe(true);
      expect((data as any).clientSecret).toBeUndefined();
    });

    it('updates existing provider without requiring a new secret if one is already stored', async () => {
      (db.select as any).mockReturnValue(
        mockSelectLimit([
          {
            id: 'row-1',
            providerId: 'github',
            clientId: 'gh-old',
            clientSecret: 'encrypted-old',
            enabled: false,
          },
        ])
      );

      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: 'row-1',
                providerId: 'github',
                clientId: 'gh-old',
                clientSecret: 'encrypted-old',
                enabled: true,
                createdAt: '2025-01-01T00:00:00.000Z',
                updatedAt: '2025-01-04T00:00:00.000Z',
              },
            ]),
          }),
        }),
      });
      (db.update as any).mockImplementation(mockUpdate);

      const res = await POST(createMockRequest({ providerId: 'github', enabled: true }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(db.update).toHaveBeenCalledWith(oauthSettings);
      expect(data.enabled).toBe(true);
      expect(data.hasClientSecret).toBe(true);
      expect(encryptOAuthSecret).not.toHaveBeenCalled();
    });
  });
});


