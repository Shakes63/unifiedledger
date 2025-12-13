/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/calendar-sync/disconnect/route';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/calendar/google-calendar', () => ({
  deleteEvents: vi.fn(),
}));

vi.mock('@/lib/calendar/ticktick-calendar', () => ({
  deleteTickTickTasks: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    delete: vi.fn(),
  },
}));

import { requireAuth } from '@/lib/auth-helpers';
import { deleteEvents as deleteGoogleEvents } from '@/lib/calendar/google-calendar';
import { deleteTickTickTasks } from '@/lib/calendar/ticktick-calendar';
import { db } from '@/lib/db';

function createRequest(body: unknown): Request {
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

function mockSelectWhere(rows: any[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  };
}

function mockDelete() {
  return {
    where: vi.fn().mockResolvedValue(undefined),
  };
}

describe('POST /api/calendar-sync/disconnect', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    (requireAuth as any).mockResolvedValue({ userId: 'user-1' });
    (db.delete as any).mockReturnValue(mockDelete());
    (deleteGoogleEvents as any).mockResolvedValue(undefined);
    (deleteTickTickTasks as any).mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
    consoleErrorSpy = null;
    vi.clearAllMocks();
  });

  it('returns 401 when unauthorized', async () => {
    (requireAuth as any).mockRejectedValue(new Error('Unauthorized'));
    const res = await POST(createRequest({ connectionId: 'conn-1' }));
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 400 when connectionId is missing', async () => {
    const res = await POST(createRequest({}));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe('connectionId is required');
  });

  it('returns 404 when connection not found (ownership check)', async () => {
    (db.select as any).mockReturnValueOnce(mockSelectLimit([]));
    const res = await POST(createRequest({ connectionId: 'conn-1' }));
    const data = await res.json();
    expect(res.status).toBe(404);
    expect(data.error).toBe('Connection not found');
  });

  it('deletes remote events using google deleteEvents when deleteRemoteEvents=true and provider=google', async () => {
    (db.select as any)
      .mockReturnValueOnce(
        mockSelectLimit([
          { id: 'conn-1', provider: 'google', calendarId: 'cal-1' },
        ])
      )
      .mockReturnValueOnce(
        mockSelectWhere([
          { externalEventId: 'evt-1' },
          { externalEventId: 'evt-2' },
        ])
      );

    const res = await POST(
      createRequest({ connectionId: 'conn-1', deleteRemoteEvents: true })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(deleteGoogleEvents).toHaveBeenCalledTimes(1);
    expect(deleteTickTickTasks).toHaveBeenCalledTimes(0);
    expect(db.delete).toHaveBeenCalledTimes(2); // calendarEvents then calendarConnections
  });

  it('deletes remote events using ticktick deleteTickTickTasks when deleteRemoteEvents=true and provider=ticktick', async () => {
    (db.select as any)
      .mockReturnValueOnce(
        mockSelectLimit([
          { id: 'conn-tt', provider: 'ticktick', calendarId: 'proj-1' },
        ])
      )
      .mockReturnValueOnce(
        mockSelectWhere([{ externalEventId: 'task-1' }])
      );

    const res = await POST(
      createRequest({ connectionId: 'conn-tt', deleteRemoteEvents: true })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(deleteTickTickTasks).toHaveBeenCalledTimes(1);
    expect(deleteGoogleEvents).toHaveBeenCalledTimes(0);
    expect(db.delete).toHaveBeenCalledTimes(2);
  });

  it('continues disconnect even if remote deletion throws', async () => {
    (deleteGoogleEvents as any).mockRejectedValue(new Error('boom'));

    (db.select as any)
      .mockReturnValueOnce(
        mockSelectLimit([
          { id: 'conn-1', provider: 'google', calendarId: 'cal-1' },
        ])
      )
      .mockReturnValueOnce(
        mockSelectWhere([{ externalEventId: 'evt-1' }])
      );

    const res = await POST(
      createRequest({ connectionId: 'conn-1', deleteRemoteEvents: true })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(db.delete).toHaveBeenCalledTimes(2);
  });
});


