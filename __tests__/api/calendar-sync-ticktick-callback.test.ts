/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/calendar/ticktick-calendar', () => ({
  exchangeTickTickCodeForTokens: vi.fn(),
  listTickTickProjects: vi.fn(),
  createTickTickProject: vi.fn(),
}));

vi.mock('@/lib/encryption/oauth-encryption', () => ({
  // Identity encryption for assertions — the real AES path is unit-tested
  // separately and needs a key env var we don't want in this suite.
  encryptToken: (t: string) => `enc(${t})`,
  decryptToken: (t: string) => t,
}));

vi.mock('@/lib/auth-helpers', () => ({ requireAuth: vi.fn() }));
vi.mock('@/lib/api/household-auth', () => ({ getAndVerifyHousehold: vi.fn() }));

vi.mock('@/lib/db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
}));

vi.mock('uuid', () => ({ v4: vi.fn() }));

// Faithful to next/navigation: redirect() THROWS a NEXT_REDIRECT error and
// never returns. Tests read the target off the thrown error.
class RedirectError extends Error {
  digest: string;
  target: string;
  constructor(url: string) {
    super('NEXT_REDIRECT');
    this.digest = `NEXT_REDIRECT;push;${url};`;
    this.target = url;
  }
}
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
}));

let cookieValue: string | undefined;
const cookieDelete = vi.fn();
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === 'ticktick_oauth_state' && cookieValue ? { value: cookieValue } : undefined,
    delete: cookieDelete,
  })),
}));

import { GET } from '@/app/api/calendar-sync/ticktick/callback/route';
import {
  exchangeTickTickCodeForTokens,
  listTickTickProjects,
  createTickTickProject,
} from '@/lib/calendar/ticktick-calendar';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

function createRequest(url: string): Request {
  return { url, headers: new Headers() } as unknown as Request;
}

function mockSelectLimit(rows: any[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(rows) }),
    }),
  };
}
const mockInsert = () => ({ values: vi.fn().mockResolvedValue(undefined) });
const mockUpdate = () => ({
  set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
});

async function redirectTarget(fn: Promise<unknown>): Promise<string> {
  try {
    await fn;
  } catch (err) {
    if (err instanceof RedirectError) return err.target;
    throw err;
  }
  throw new Error('Expected a redirect');
}

describe('GET /api/calendar-sync/ticktick/callback', () => {
  const originalAppUrl = process.env.APP_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_URL = 'http://app.local';
    cookieValue = undefined;

    (uuidv4 as any).mockReset();
    (db.select as any).mockReset();
    (db.insert as any).mockReset();
    (db.update as any).mockReset();
    (exchangeTickTickCodeForTokens as any).mockReset();
    (listTickTickProjects as any).mockReset();
    (createTickTickProject as any).mockReset();
    (requireAuth as any).mockReset();
    (getAndVerifyHousehold as any).mockReset();

    (requireAuth as any).mockResolvedValue({ userId: 'user-1' });
    (getAndVerifyHousehold as any).mockResolvedValue({ householdId: 'hh-1' });

    (uuidv4 as any).mockReturnValueOnce('conn-uuid-1').mockReturnValueOnce('settings-uuid-1');
    (db.insert as any).mockReturnValue(mockInsert());
    (db.update as any).mockReturnValue(mockUpdate());

    (exchangeTickTickCodeForTokens as any).mockResolvedValue({
      accessToken: 'at',
      refreshToken: 'rt',
      expiresAt: '2099-01-01T00:00:00.000Z',
      tokenType: 'Bearer',
    });
    (listTickTickProjects as any).mockResolvedValue([{ id: 'proj-1', name: 'Unified Ledger' }]);
    (createTickTickProject as any).mockResolvedValue({ id: 'proj-new', name: 'Unified Ledger' });
  });

  afterEach(() => {
    process.env.APP_URL = originalAppUrl;
    vi.clearAllMocks();
  });

  it('redirects with calendarError when error query param present', async () => {
    const url = 'http://localhost/cb?error=access_denied&state=s&code=c';
    expect(await redirectTarget(GET(createRequest(url)))).toBe(
      'http://app.local/dashboard/settings?tab=data&calendarError=access_denied'
    );
  });

  it('redirects with missing_params when code/state missing', async () => {
    const url = 'http://localhost/cb?state=s';
    expect(await redirectTarget(GET(createRequest(url)))).toBe(
      'http://app.local/dashboard/settings?tab=data&calendarError=missing_params'
    );
  });

  it('SEC1: identity comes from the session, not the cookie — 401 becomes unauthorized redirect', async () => {
    (requireAuth as any).mockRejectedValue(new Error('Unauthorized'));
    cookieValue = JSON.stringify({ state: 's', userId: 'victim', householdId: 'victim-hh' });
    const url = 'http://localhost/cb?state=s&code=c';
    expect(await redirectTarget(GET(createRequest(url)))).toBe(
      'http://app.local/dashboard/settings?tab=data&calendarError=unauthorized'
    );
    expect(exchangeTickTickCodeForTokens).not.toHaveBeenCalled();
  });

  it('SEC1: a state cookie minted for a DIFFERENT user is rejected', async () => {
    // Session is user-1, but the cookie claims victim — reject.
    cookieValue = JSON.stringify({ state: 's', userId: 'victim', householdId: 'victim-hh' });
    const url = 'http://localhost/cb?state=s&code=c';
    expect(await redirectTarget(GET(createRequest(url)))).toBe(
      'http://app.local/dashboard/settings?tab=data&calendarError=state_mismatch'
    );
    expect(exchangeTickTickCodeForTokens).not.toHaveBeenCalled();
  });

  it('redirects with state_expired when state cookie missing', async () => {
    const url = 'http://localhost/cb?state=s&code=c';
    expect(await redirectTarget(GET(createRequest(url)))).toBe(
      'http://app.local/dashboard/settings?tab=data&calendarError=state_expired'
    );
  });

  it('creates a new connection with ENCRYPTED tokens bound to the SESSION user, redirects success', async () => {
    cookieValue = JSON.stringify({ state: 's', userId: 'user-1', householdId: 'hh-1' });
    const insertSpy = mockInsert();
    (db.insert as any).mockReturnValue(insertSpy);
    (db.select as any)
      .mockReturnValueOnce(mockSelectLimit([])) // no existing connection
      .mockReturnValueOnce(mockSelectLimit([])); // no existing settings

    const url = 'http://localhost/cb?state=s&code=c';
    const target = await redirectTarget(GET(createRequest(url)));

    expect(target).toBe('http://app.local/dashboard/settings?tab=data&calendarConnected=ticktick');
    // Tokens stored encrypted, bound to the session user.
    const inserted = insertSpy.values.mock.calls[0][0];
    expect(inserted.userId).toBe('user-1');
    expect(inserted.householdId).toBe('hh-1');
    expect(inserted.accessToken).toBe('enc(at)');
    expect(inserted.refreshToken).toBe('enc(rt)');
    expect(cookieDelete).toHaveBeenCalledWith('ticktick_oauth_state');
  });

  it('SY3: a successful connection redirects to success, not callback_failed', async () => {
    cookieValue = JSON.stringify({ state: 's', userId: 'user-1', householdId: 'hh-1' });
    (db.select as any).mockReturnValueOnce(
      mockSelectLimit([{ id: 'conn-existing', refreshToken: 'enc(old)' }])
    );
    const url = 'http://localhost/cb?state=s&code=c';
    expect(await redirectTarget(GET(createRequest(url)))).toBe(
      'http://app.local/dashboard/settings?tab=data&calendarConnected=ticktick'
    );
  });

  it('redirects callback_failed on an unexpected exception', async () => {
    cookieValue = JSON.stringify({ state: 's', userId: 'user-1', householdId: 'hh-1' });
    (exchangeTickTickCodeForTokens as any).mockRejectedValue(new Error('boom'));
    (db.select as any).mockReturnValueOnce(mockSelectLimit([]));
    const url = 'http://localhost/cb?state=s&code=c';
    expect(await redirectTarget(GET(createRequest(url)))).toBe(
      'http://app.local/dashboard/settings?tab=data&calendarError=callback_failed'
    );
  });
});
