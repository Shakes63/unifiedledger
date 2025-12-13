/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET, POST } from '@/app/api/calendar-sync/calendars/route';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/calendar/google-calendar', () => ({
  listCalendars: vi.fn(),
  createCalendar: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

import { requireAuth } from '@/lib/auth-helpers';
import { listCalendars, createCalendar } from '@/lib/calendar/google-calendar';
import { db } from '@/lib/db';

function createGetRequest(url: string): Request {
  return { url } as unknown as Request;
}

function createPostRequest(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
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

describe('GET/POST /api/calendar-sync/calendars', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (requireAuth as any).mockResolvedValue({ userId: 'user-1' });
    (db.update as any).mockReturnValue(mockUpdate());
    (listCalendars as any).mockResolvedValue([]);
    (createCalendar as any).mockResolvedValue({ id: 'cal-new', summary: 'Unified Ledger' });
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
    consoleErrorSpy = null;
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('returns 401 when unauthorized', async () => {
      (requireAuth as any).mockRejectedValue(new Error('Unauthorized'));
      const res = await GET(createGetRequest('http://localhost/api/calendar-sync/calendars?connectionId=conn-1'));
      const data = await res.json();
      expect(res.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 400 when connectionId is missing', async () => {
      const res = await GET(createGetRequest('http://localhost/api/calendar-sync/calendars'));
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe('connectionId is required');
    });

    it('returns 404 when connection not found (ownership check)', async () => {
      (db.select as any).mockReturnValueOnce(mockSelectLimit([]));
      const res = await GET(createGetRequest('http://localhost/api/calendar-sync/calendars?connectionId=conn-1'));
      const data = await res.json();
      expect(res.status).toBe(404);
      expect(data.error).toBe('Connection not found');
    });

    it('returns calendars and selectedCalendarId when connection exists', async () => {
      (db.select as any).mockReturnValueOnce(mockSelectLimit([{ id: 'conn-1', calendarId: 'cal-2' }]));
      const calendars = [{ id: 'cal-1', summary: 'Primary' }, { id: 'cal-2', summary: 'Other' }];
      (listCalendars as any).mockResolvedValue(calendars);

      const res = await GET(createGetRequest('http://localhost/api/calendar-sync/calendars?connectionId=conn-1'));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data).toEqual({
        calendars,
        selectedCalendarId: 'cal-2',
      });
    });
  });

  describe('POST', () => {
    it('returns 401 when unauthorized', async () => {
      (requireAuth as any).mockRejectedValue(new Error('Unauthorized'));
      const res = await POST(createPostRequest({ connectionId: 'conn-1', calendarId: 'cal-1' }));
      const data = await res.json();
      expect(res.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 400 when connectionId is missing', async () => {
      const res = await POST(createPostRequest({ calendarId: 'cal-1' }));
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe('connectionId is required');
    });

    it('returns 404 when connection not found (ownership check)', async () => {
      (db.select as any).mockReturnValueOnce(mockSelectLimit([]));
      const res = await POST(createPostRequest({ connectionId: 'conn-1', calendarId: 'cal-1' }));
      const data = await res.json();
      expect(res.status).toBe(404);
      expect(data.error).toBe('Connection not found');
    });

    it('creates a new calendar when createNew=true and updates connection', async () => {
      (db.select as any).mockReturnValueOnce(mockSelectLimit([{ id: 'conn-1' }]));
      (createCalendar as any).mockResolvedValue({ id: 'cal-new', summary: 'Unified Ledger' });

      const res = await POST(
        createPostRequest({ connectionId: 'conn-1', createNew: true, calendarName: 'Unified Ledger' })
      );
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data).toEqual({ success: true, calendarId: 'cal-new', calendarName: 'Unified Ledger' });
      expect(createCalendar).toHaveBeenCalledTimes(1);
      expect(db.update).toHaveBeenCalledTimes(1);
    });

    it('resolves calendarName when calendarId provided but calendarName missing', async () => {
      (db.select as any).mockReturnValueOnce(mockSelectLimit([{ id: 'conn-1' }]));
      (listCalendars as any).mockResolvedValue([{ id: 'cal-1', summary: 'Primary' }]);

      const res = await POST(createPostRequest({ connectionId: 'conn-1', calendarId: 'cal-1' }));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data).toEqual({ success: true, calendarId: 'cal-1', calendarName: 'Primary' });
      expect(listCalendars).toHaveBeenCalledTimes(1);
    });
  });
});


