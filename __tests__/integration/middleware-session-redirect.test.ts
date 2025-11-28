import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import middleware from '@/middleware';
import type { NextRequest } from 'next/server';

// Type for validation result matching session-utils (used by mockedValidateSession)
interface _MockValidationResult {
  valid: boolean;
  reason?: 'expired' | 'inactive' | 'not_found';
  session?: {
    id: string;
    lastActivityAt: Date | null;
    rememberMe: boolean;
  };
  userId?: string;
}

// Mock session-utils used by middleware
vi.mock('@/lib/session-utils', () => {
  return {
    validateSession: vi.fn(),
    updateSessionActivity: vi.fn().mockResolvedValue(undefined),
    deleteSessionByToken: vi.fn().mockResolvedValue(undefined),
  };
});

const { validateSession } = await import('@/lib/session-utils');
const mockedValidateSession = validateSession as MockedFunction<typeof validateSession>;

function createRequest(pathname: string, cookies: Record<string, string> = {}): NextRequest {
  const cookieStore = new Map(Object.entries(cookies));
  return {
    url: `https://example.com${pathname}`,
    nextUrl: { pathname },
    cookies: {
      get: (name: string) => {
        const value = cookieStore.get(name);
        return value ? { name, value } : undefined;
      },
    },
  } as unknown as NextRequest;
}

describe('middleware session redirect logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete (process.env as NodeJS.ProcessEnv & { SESSION_DEBUG?: string }).SESSION_DEBUG;
  });

  it('redirects unauthenticated protected route to sign-in with callback', async () => {
    mockedValidateSession.mockResolvedValue({ valid: false, reason: 'not_found' });
    const request = createRequest('/dashboard');
    const res = await middleware(request);
    expect(res?.status).toBe(307);
    expect(res?.headers.get('location')).toBe('https://example.com/sign-in?callbackUrl=%2Fdashboard');
  });

  it('allows access with valid session_token fallback cookie', async () => {
    mockedValidateSession.mockResolvedValue({
      valid: true,
      session: { id: 's1', lastActivityAt: new Date(), rememberMe: false },
      userId: 'u1',
    });
    const request = createRequest('/dashboard', {
      'better-auth.session_token': 'token-abc',
    });
    const res = await middleware(request);
    // NextResponse.next() returns 200 response with no redirect location
    expect(res?.status).toBe(200);
    expect(res?.headers.get('location')).toBeNull();
  });

  it('redirects with reason=expired when session is expired', async () => {
    mockedValidateSession.mockResolvedValue({
      valid: false,
      reason: 'expired',
      session: { id: 's1', lastActivityAt: new Date(Date.now() - 3600_000), rememberMe: false },
      userId: 'u1',
    });
    // Provide a plausible base64url-encoded cookie body with no token so fallback uses token cookie
    const fakePayload = Buffer.from(JSON.stringify({ session: { session: {} } })).toString('base64url');
    const request = createRequest('/dashboard', {
      'better-auth.session_data': fakePayload,
      'better-auth.session_token': 'token-expired',
    });
    const res = await middleware(request);
    expect(res?.status).toBe(307);
    expect(res?.headers.get('location')).toBe(
      'https://example.com/sign-in?callbackUrl=%2Fdashboard&reason=expired',
    );
  });

  it('redirects with reason=timeout when session inactive', async () => {
    mockedValidateSession.mockResolvedValue({
      valid: false,
      reason: 'inactive',
      session: { id: 's1', lastActivityAt: new Date(Date.now() - 10 * 60_000), rememberMe: false },
      userId: 'u1',
    });
    const payload = Buffer.from(JSON.stringify({ session: { session: { token: 't-inactive' } } })).toString('base64url');
    const request = createRequest('/dashboard', {
      'better-auth.session_data': payload,
    });
    const res = await middleware(request);
    expect(res?.status).toBe(307);
    expect(res?.headers.get('location')).toBe(
      'https://example.com/sign-in?callbackUrl=%2Fdashboard&reason=timeout',
    );
  });

  it('handles malformed session_data cookie gracefully (redirects to sign-in)', async () => {
    mockedValidateSession.mockResolvedValue({ valid: false, reason: 'not_found' });
    const request = createRequest('/dashboard', {
      // Intentionally malformed (not base64/base64url)
      'better-auth.session_data': '!!!not-valid!!!',
    });
    const res = await middleware(request);
    expect(res?.status).toBe(307);
    expect(res?.headers.get('location')).toBe('https://example.com/sign-in?callbackUrl=%2Fdashboard');
  });

  it('redirects auth pages to /dashboard when already authenticated', async () => {
    mockedValidateSession.mockResolvedValue({
      valid: true,
      session: { id: 's1', lastActivityAt: new Date(), rememberMe: false },
      userId: 'u1',
    });
    const payload = Buffer.from(JSON.stringify({ session: { session: { token: 't1' } } })).toString('base64url');
    const request = createRequest('/sign-in', {
      'better-auth.session_data': payload,
    });
    const res = await middleware(request);
    expect(res?.status).toBe(307);
    expect(res?.headers.get('location')).toBe('https://example.com/dashboard');
  });

  it('does not redirect when rememberMe is true and session is valid', async () => {
    mockedValidateSession.mockResolvedValue({
      valid: true,
      session: { id: 's2', lastActivityAt: null, rememberMe: true },
      userId: 'u2',
    });
    const payload = Buffer.from(JSON.stringify({ session: { session: { token: 't-rm' } } })).toString('base64url');
    const request = createRequest('/dashboard', {
      'better-auth.session_data': payload,
    });
    const res = await middleware(request);
    expect(res?.status).toBe(200);
    expect(res?.headers.get('location')).toBeNull();
  });
});


