/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/calendar-sync/ticktick/connect/route';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/api/household-auth', () => ({
  getAndVerifyHousehold: vi.fn(),
}));

vi.mock('@/lib/calendar/ticktick-calendar', () => ({
  getTickTickAuthUrl: vi.fn(),
  isTickTickConfigured: vi.fn(),
}));

vi.mock('uuid', () => ({
  v4: vi.fn(),
}));

const cookieSet = vi.fn();
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    set: cookieSet,
  })),
}));

import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { getTickTickAuthUrl, isTickTickConfigured } from '@/lib/calendar/ticktick-calendar';
import { v4 as uuidv4 } from 'uuid';

function createRequest(url: string): Request {
  return { url } as unknown as Request;
}

describe('GET /api/calendar-sync/ticktick/connect', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    (requireAuth as any).mockResolvedValue({ userId: 'user-1' });
    (getAndVerifyHousehold as any).mockResolvedValue({ householdId: 'hh-1', membership: { role: 'owner' } });
    (isTickTickConfigured as any).mockResolvedValue(true);
    (uuidv4 as any).mockReturnValue('state-1');
    (getTickTickAuthUrl as any).mockResolvedValue('https://ticktick.example/auth');
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
    consoleErrorSpy = null;
    vi.clearAllMocks();
  });

  it('returns 401 when unauthorized', async () => {
    (requireAuth as any).mockRejectedValue(new Error('Unauthorized'));
    const res = await GET(createRequest('http://localhost/api/calendar-sync/ticktick/connect'));
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 503 when TickTick is not configured', async () => {
    (isTickTickConfigured as any).mockResolvedValue(false);
    const res = await GET(createRequest('http://localhost/api/calendar-sync/ticktick/connect'));
    const data = await res.json();
    expect(res.status).toBe(503);
    expect(data.error).toBe('TickTick integration is not configured');
  });

  it('returns authUrl and writes ticktick_oauth_state cookie when configured', async () => {
    const res = await GET(createRequest('http://localhost/api/calendar-sync/ticktick/connect'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ authUrl: 'https://ticktick.example/auth' });
    expect(getTickTickAuthUrl).toHaveBeenCalledWith('state-1');

    expect(cookieSet).toHaveBeenCalledTimes(1);
    const [name, value, options] = cookieSet.mock.calls[0];
    expect(name).toBe('ticktick_oauth_state');
    expect(JSON.parse(value)).toEqual({ state: 'state-1', userId: 'user-1', householdId: 'hh-1' });
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });
  });
});


