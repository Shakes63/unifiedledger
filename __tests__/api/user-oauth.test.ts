/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET as GET_AVAILABLE } from '@/app/api/user/oauth/available/route';
import { POST as POST_LINK } from '@/app/api/user/oauth/link/[provider]/route';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/auth/oauth-provider-config', () => ({
  isOAuthLoginProviderConfigured: vi.fn(),
}));

import { requireAuth } from '@/lib/auth-helpers';
import { isOAuthLoginProviderConfigured } from '@/lib/auth/oauth-provider-config';

function createMockParams(provider: string) {
  return Promise.resolve({ provider });
}

describe('User OAuth API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/user/oauth/available', () => {
    it('returns providers with enabled flags based on configuration', async () => {
      (isOAuthLoginProviderConfigured as any)
        .mockResolvedValueOnce(true) // google
        .mockResolvedValueOnce(false); // github

      const res = await GET_AVAILABLE();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.providers).toEqual([
        {
          id: 'google',
          name: 'Google',
          icon: 'google',
          enabled: true,
          description: 'Sign in with your Google account',
        },
        {
          id: 'github',
          name: 'GitHub',
          icon: 'github',
          enabled: false,
          description: 'Sign in with your GitHub account',
        },
      ]);
    });

    it('returns 500 if config check throws', async () => {
      (isOAuthLoginProviderConfigured as any).mockRejectedValue(new Error('db down'));
      const res = await GET_AVAILABLE();
      const data = await res.json();
      expect(res.status).toBe(500);
      expect(data.error).toBe('Failed to fetch available providers');
    });
  });

  describe('POST /api/user/oauth/link/[provider]', () => {
    it('returns 401 if not authenticated', async () => {
      (requireAuth as any).mockRejectedValue(new Error('Unauthorized'));
      const res = await POST_LINK({} as Request, { params: createMockParams('google') });
      const data = await res.json();
      expect(res.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('validates provider name', async () => {
      (requireAuth as any).mockResolvedValue({ userId: 'user-1' });
      const res = await POST_LINK({} as Request, { params: createMockParams('facebook') });
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe('Invalid provider. Supported providers: google, github');
    });

    it('returns 400 if provider is not configured', async () => {
      (requireAuth as any).mockResolvedValue({ userId: 'user-1' });
      (isOAuthLoginProviderConfigured as any).mockResolvedValue(false);

      const res = await POST_LINK({} as Request, { params: createMockParams('github') });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('github OAuth is not configured');
    });

    it('returns success when provider is configured', async () => {
      (requireAuth as any).mockResolvedValue({ userId: 'user-1' });
      (isOAuthLoginProviderConfigured as any).mockResolvedValue(true);

      const res = await POST_LINK({} as Request, { params: createMockParams('google') });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.providerId).toBe('google');
    });
  });
});


