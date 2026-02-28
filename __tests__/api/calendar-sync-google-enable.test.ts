/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/calendar-sync/google/enable/route';

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

vi.mock('uuid', () => ({
  v4: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
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
import { v4 as uuidv4 } from 'uuid';

function createRequest(body: unknown): Request {
  return {
    json: async () => body,
  } as unknown as Request;
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

function mockUpdate() {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  };
}

function mockInsert() {
  return {
    values: vi.fn().mockResolvedValue(undefined),
  };
}

describe('POST /api/calendar-sync/google/enable', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    (requireAuth as any).mockResolvedValue({ userId: 'user-1' });
    (getAndVerifyHousehold as any).mockResolvedValue({ householdId: 'hh-1', membership: { role: 'owner' } });
    (isGoogleCalendarConfigured as any).mockResolvedValue(true);
    (hasGoogleOAuthLinked as any).mockResolvedValue(true);
    (listCalendarsForUser as any).mockResolvedValue([]);
    let uuidCall = 0;
    (uuidv4 as any).mockImplementation(() => {
      uuidCall += 1;
      if (uuidCall === 1) return 'uuid-conn-1';
      if (uuidCall === 2) return 'uuid-settings-1';
      return `uuid-${uuidCall}`;
    });

    (db.update as any).mockReturnValue(mockUpdate());
    (db.insert as any).mockReturnValue(mockInsert());
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
    consoleErrorSpy = null;
    vi.clearAllMocks();
  });

  it('returns 401 when unauthorized', async () => {
    (requireAuth as any).mockRejectedValue(new Error('Unauthorized'));
    const res = await POST(createRequest({}));
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 503 when Google OAuth is not configured', async () => {
    (isGoogleCalendarConfigured as any).mockResolvedValue(false);
    const res = await POST(createRequest({}));
    const data = await res.json();
    expect(res.status).toBe(503);
    expect(data.error).toBe('Google OAuth not configured');
  });

  it('returns 400 when user has not linked Google OAuth', async () => {
    (hasGoogleOAuthLinked as any).mockResolvedValue(false);
    const res = await POST(createRequest({}));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain('Google account not linked');
  });

  it('creates a new connection and default settings; picks primary calendar when no calendarId provided', async () => {
    const calendars = [
      { id: 'cal-1', summary: 'Primary', primary: true },
      { id: 'cal-2', summary: 'Other' },
    ];
    (listCalendarsForUser as any).mockResolvedValue(calendars);

    // existing connection + existing settings: none
    (db.select as any)
      .mockReturnValueOnce(mockSelectLimit([]))
      .mockReturnValueOnce(mockSelectLimit([]));

    const res = await POST(createRequest({}));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      success: true,
      connectionId: 'uuid-conn-1',
      calendarId: 'cal-1',
      calendarName: 'Primary',
    });

    // Should insert connection
    expect(db.insert).toHaveBeenCalledTimes(2);
  });

  it('creates connection; selects first calendar when no primary exists', async () => {
    const calendars = [
      { id: 'cal-a', summary: 'A' },
      { id: 'cal-b', summary: 'B' },
    ];
    (listCalendarsForUser as any).mockResolvedValue(calendars);

    (db.select as any)
      .mockReturnValueOnce(mockSelectLimit([]))
      .mockReturnValueOnce(mockSelectLimit([]));

    const res = await POST(createRequest({}));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.calendarId).toBe('cal-a');
    expect(data.calendarName).toBe('A');
  });

  it('uses provided calendarId and resolves calendarName when possible', async () => {
    const calendars = [
      { id: 'cal-1', summary: 'Primary', primary: true },
      { id: 'cal-2', summary: 'Selected' },
    ];
    (listCalendarsForUser as any).mockResolvedValue(calendars);

    (db.select as any)
      .mockReturnValueOnce(mockSelectLimit([]))
      .mockReturnValueOnce(mockSelectLimit([]));

    const res = await POST(createRequest({ calendarId: 'cal-2' }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.calendarId).toBe('cal-2');
    expect(data.calendarName).toBe('Selected');
  });

  it('updates existing connection instead of inserting; still creates settings if missing', async () => {
    (db.select as any)
      .mockReturnValueOnce(mockSelectLimit([{ id: 'conn-1' }])) // existing connection
      .mockReturnValueOnce(mockSelectLimit([])); // settings missing

    const res = await POST(createRequest({ calendarId: 'cal-9' }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.connectionId).toBe('conn-1');
    expect(data.calendarId).toBe('cal-9');

    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it('does not crash when calendar lookup fails; still enables sync', async () => {
    (listCalendarsForUser as any).mockRejectedValue(new Error('boom'));

    (db.select as any)
      .mockReturnValueOnce(mockSelectLimit([]))
      .mockReturnValueOnce(mockSelectLimit([]));

    const res = await POST(createRequest({}));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    // Calendar may be null/undefined since lookup failed
    expect(data.connectionId).toBe('uuid-conn-1');
  });

  it('does not insert default settings when settings already exist', async () => {
    (db.select as any)
      .mockReturnValueOnce(mockSelectLimit([])) // no existing connection
      .mockReturnValueOnce(mockSelectLimit([{ id: 'settings-1' }])); // settings exist

    const res = await POST(createRequest({ calendarId: 'cal-x' }));
    expect(res.status).toBe(200);

    // Only connection insert should happen
    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  it('updates existing connection and does not insert settings when settings already exist', async () => {
    (db.select as any)
      .mockReturnValueOnce(mockSelectLimit([{ id: 'conn-1' }])) // existing connection
      .mockReturnValueOnce(mockSelectLimit([{ id: 'settings-1' }])); // settings exist

    const res = await POST(createRequest({ calendarId: 'cal-x' }));
    expect(res.status).toBe(200);

    expect(db.update).toHaveBeenCalledTimes(1);
    expect(db.insert).toHaveBeenCalledTimes(0);
  });
});


