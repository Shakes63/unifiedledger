/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/calendar-sync/google/status/route';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/api/household-auth', () => ({
  getAndVerifyHousehold: vi.fn(),
}));

vi.mock('@/lib/calendar/google-calendar', () => ({
  hasGoogleOAuthLinked: vi.fn(),
  listCalendarsForUser: vi.fn(),
  isGoogleCalendarConfigured: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import {
  hasGoogleOAuthLinked,
  listCalendarsForUser,
  isGoogleCalendarConfigured,
} from '@/lib/calendar/google-calendar';
import { db } from '@/lib/db';

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

describe('GET /api/calendar-sync/google/status', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (requireAuth as any).mockResolvedValue({ userId: 'user-1' });
    (getAndVerifyHousehold as any).mockResolvedValue({ householdId: 'hh-1', membership: { role: 'owner' } });
    (isGoogleCalendarConfigured as any).mockResolvedValue(true);
    (hasGoogleOAuthLinked as any).mockResolvedValue(true);
    (listCalendarsForUser as any).mockResolvedValue([]);
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
    consoleErrorSpy = null;
    vi.clearAllMocks();
  });

  it('returns 401 when unauthorized', async () => {
    (requireAuth as any).mockRejectedValue(new Error('Unauthorized'));
    const res = await GET(createRequest('http://localhost/api/calendar-sync/google/status'));
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns configured=false when Google OAuth is not configured', async () => {
    (isGoogleCalendarConfigured as any).mockResolvedValue(false);
    const res = await GET(createRequest('http://localhost/api/calendar-sync/google/status'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      configured: false,
      linked: false,
      calendars: [],
      selectedCalendarId: null,
      message: expect.stringContaining('Google OAuth not configured'),
    });
  });

  it('returns linked=false when user has not linked Google OAuth', async () => {
    (hasGoogleOAuthLinked as any).mockResolvedValue(false);
    const res = await GET(createRequest('http://localhost/api/calendar-sync/google/status'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      configured: true,
      linked: false,
      calendars: [],
      selectedCalendarId: null,
      message: 'Link your Google account to enable calendar sync.',
    });
  });

  it('returns calendars and selected connection/settings when linked', async () => {
    const calendars = [
      { id: 'cal-1', summary: 'Primary', primary: true },
      { id: 'cal-2', summary: 'Other' },
    ];
    (listCalendarsForUser as any).mockResolvedValue(calendars);

    (db.select as any)
      .mockReturnValueOnce(
        mockSelectLimit([
          { id: 'conn-1', calendarId: 'cal-2', calendarName: 'Other Calendar' },
        ])
      )
      .mockReturnValueOnce(
        mockSelectLimit([
          { id: 'settings-1', syncMode: 'direct', reminderMinutes: 1440 },
        ])
      );

    const res = await GET(createRequest('http://localhost/api/calendar-sync/google/status'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.configured).toBe(true);
    expect(data.linked).toBe(true);
    expect(data.calendars).toEqual(calendars);
    expect(data.selectedCalendarId).toBe('cal-2');
    expect(data.selectedCalendarName).toBe('Other Calendar');
    expect(data.connectionId).toBe('conn-1');
    expect(data.settings).toEqual({ id: 'settings-1', syncMode: 'direct', reminderMinutes: 1440 });
    expect(data.error).toBeNull();
  });

  it('returns error string when listCalendarsForUser fails (still linked)', async () => {
    (listCalendarsForUser as any).mockRejectedValue(new Error('boom'));

    (db.select as any)
      .mockReturnValueOnce(mockSelectLimit([])) // connection
      .mockReturnValueOnce(mockSelectLimit([])); // settings

    const res = await GET(createRequest('http://localhost/api/calendar-sync/google/status'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.configured).toBe(true);
    expect(data.linked).toBe(true);
    expect(data.calendars).toEqual([]);
    expect(data.selectedCalendarId).toBeNull();
    expect(data.connectionId).toBeNull();
    expect(data.settings).toBeNull();
    expect(data.error).toContain('boom');
  });
});


