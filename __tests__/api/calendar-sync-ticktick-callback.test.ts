/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/calendar-sync/ticktick/callback/route';

vi.mock('@/lib/calendar/ticktick-calendar', () => ({
  exchangeTickTickCodeForTokens: vi.fn(),
  listTickTickProjects: vi.fn(),
  createTickTickProject: vi.fn(),
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

const redirectMock = vi.fn((url: string) => {
  // In Next.js, redirect() may throw in some contexts, but in this route we want
  // to assert the target URL without having it swallowed by the route's try/catch.
  return new Response(null, { status: 302, headers: { Location: url } });
});
vi.mock('next/navigation', () => ({
  redirect: (url: string) => redirectMock(url),
}));

let cookieValue: string | undefined;
const cookieDelete = vi.fn();
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      if (name !== 'ticktick_oauth_state') return undefined;
      return cookieValue ? { value: cookieValue } : undefined;
    },
    delete: cookieDelete,
  })),
}));

import {
  exchangeTickTickCodeForTokens,
  listTickTickProjects,
  createTickTickProject,
} from '@/lib/calendar/ticktick-calendar';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

function createRequest(url: string): Request {
  return { url } as unknown as Request;
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

function mockInsert() {
  return {
    values: vi.fn().mockResolvedValue(undefined),
  };
}

function mockUpdate() {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  };
}

async function expectRedirect(fn: Promise<unknown>): Promise<string> {
  const res = (await fn) as unknown;
  if (res instanceof Response) {
    const loc = res.headers.get('Location');
    if (!loc) throw new Error('Expected redirect response to have Location header');
    return loc;
  }
  throw new Error('Expected redirect Response');
}

describe('GET /api/calendar-sync/ticktick/callback', () => {
  const originalAppUrl = process.env.APP_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_URL = 'http://app.local';

    cookieValue = undefined;
    // Important: clearAllMocks() does NOT reset mockReturnValueOnce queues.
    // Reset any mocks where we rely on call-order return values.
    (uuidv4 as any).mockReset();
    (db.select as any).mockReset();
    (db.insert as any).mockReset();
    (db.update as any).mockReset();
    (exchangeTickTickCodeForTokens as any).mockReset();
    (listTickTickProjects as any).mockReset();
    (createTickTickProject as any).mockReset();

    (uuidv4 as any)
      .mockReturnValueOnce('conn-uuid-1')
      .mockReturnValueOnce('settings-uuid-1');

    (db.insert as any).mockReturnValue(mockInsert());
    (db.update as any).mockReturnValue(mockUpdate());

    (exchangeTickTickCodeForTokens as any).mockResolvedValue({
      accessToken: 'at',
      refreshToken: 'rt',
      expiresAt: '2099-01-01T00:00:00.000Z',
      tokenType: 'Bearer',
      scope: 'tasks:read tasks:write',
    });

    (listTickTickProjects as any).mockResolvedValue([{ id: 'proj-1', name: 'Unified Ledger' }]);
    (createTickTickProject as any).mockResolvedValue({ id: 'proj-new', name: 'Unified Ledger' });
  });

  afterEach(() => {
    process.env.APP_URL = originalAppUrl;
    vi.clearAllMocks();
  });

  it('redirects with calendarError when error query param present', async () => {
    const url = 'http://localhost/api/calendar-sync/ticktick/callback?error=access_denied&state=s&code=c';
    const redirectUrl = await expectRedirect(GET(createRequest(url)));
    expect(redirectUrl).toBe('http://app.local/dashboard/settings?tab=data&calendarError=access_denied');
  });

  it('redirects with missing_params when code/state missing', async () => {
    const url = 'http://localhost/api/calendar-sync/ticktick/callback?state=s';
    const redirectUrl = await expectRedirect(GET(createRequest(url)));
    expect(redirectUrl).toBe('http://app.local/dashboard/settings?tab=data&calendarError=missing_params');
  });

  it('redirects with state_expired when state cookie missing', async () => {
    const url = 'http://localhost/api/calendar-sync/ticktick/callback?state=s&code=c';
    const redirectUrl = await expectRedirect(GET(createRequest(url)));
    expect(redirectUrl).toBe('http://app.local/dashboard/settings?tab=data&calendarError=state_expired');
  });

  it('redirects with state_mismatch when cookie state does not match query', async () => {
    cookieValue = JSON.stringify({ state: 'cookie-s', userId: 'user-1', householdId: 'hh-1' });
    const url = 'http://localhost/api/calendar-sync/ticktick/callback?state=query-s&code=c';
    const redirectUrl = await expectRedirect(GET(createRequest(url)));
    expect(redirectUrl).toBe('http://app.local/dashboard/settings?tab=data&calendarError=state_mismatch');
  });

  it('upserts existing connection, selects Unified Ledger project if present, and redirects success', async () => {
    cookieValue = JSON.stringify({ state: 's', userId: 'user-1', householdId: 'hh-1' });

    // existing connection found -> update
    (db.select as any)
      .mockReturnValueOnce(mockSelectLimit([{ id: 'conn-existing', refreshToken: 'old-rt' }]));

    const url = 'http://localhost/api/calendar-sync/ticktick/callback?state=s&code=c';
    const redirectUrl = await expectRedirect(GET(createRequest(url)));

    expect(cookieDelete).toHaveBeenCalledWith('ticktick_oauth_state');
    expect(exchangeTickTickCodeForTokens).toHaveBeenCalledTimes(1);
    expect(db.update).toHaveBeenCalledTimes(2); // update connection + set project
    expect(db.insert).toHaveBeenCalledTimes(0);
    expect(listTickTickProjects).toHaveBeenCalledWith('conn-existing');
    expect(redirectUrl).toBe('http://app.local/dashboard/settings?tab=data&calendarConnected=ticktick');
  });

  it('creates new connection + default settings when missing and redirects success', async () => {
    cookieValue = JSON.stringify({ state: 's', userId: 'user-1', householdId: 'hh-1' });

    // existing connection: none
    // existing settings: none
    (db.select as any)
      .mockReturnValueOnce(mockSelectLimit([]))
      .mockReturnValueOnce(mockSelectLimit([]));

    const url = 'http://localhost/api/calendar-sync/ticktick/callback?state=s&code=c';
    const redirectUrl = await expectRedirect(GET(createRequest(url)));

    expect(db.insert).toHaveBeenCalledTimes(2); // connection + settings
    expect(db.update).toHaveBeenCalledTimes(1); // set project (if found)
    expect(listTickTickProjects).toHaveBeenCalledWith('conn-uuid-1');
    expect(redirectUrl).toBe('http://app.local/dashboard/settings?tab=data&calendarConnected=ticktick');
  });

  it('falls back to creating project if Unified Ledger not present; if create fails, uses first project', async () => {
    cookieValue = JSON.stringify({ state: 's', userId: 'user-1', householdId: 'hh-1' });

    (db.select as any)
      .mockReturnValueOnce(mockSelectLimit([]))
      .mockReturnValueOnce(mockSelectLimit([]));

    (listTickTickProjects as any).mockResolvedValue([{ id: 'proj-a', name: 'A' }]);
    (createTickTickProject as any).mockRejectedValue(new Error('create failed'));

    const url = 'http://localhost/api/calendar-sync/ticktick/callback?state=s&code=c';
    const redirectUrl = await expectRedirect(GET(createRequest(url)));

    expect(createTickTickProject).toHaveBeenCalledTimes(1);
    expect(db.update).toHaveBeenCalledTimes(1); // set project to fallback
    expect(redirectUrl).toBe('http://app.local/dashboard/settings?tab=data&calendarConnected=ticktick');
  });

  it('redirects callback_failed on unexpected exception', async () => {
    cookieValue = JSON.stringify({ state: 's', userId: 'user-1', householdId: 'hh-1' });
    (exchangeTickTickCodeForTokens as any).mockRejectedValue(new Error('boom'));

    // existing connection select
    (db.select as any).mockReturnValueOnce(mockSelectLimit([]));

    const url = 'http://localhost/api/calendar-sync/ticktick/callback?state=s&code=c';
    const redirectUrl = await expectRedirect(GET(createRequest(url)));
    expect(redirectUrl).toBe('http://app.local/dashboard/settings?tab=data&calendarError=callback_failed');
  });
});


