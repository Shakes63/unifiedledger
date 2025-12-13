/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

import { db } from '@/lib/db';

// Import after mocks
import {
  isTickTickConfigured,
  getValidTickTickAccessToken,
  createTickTickTask,
} from '@/lib/calendar/ticktick-calendar';

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

describe('lib/calendar/ticktick-calendar', () => {
  const originalEnv = { ...process.env };
  let fetchSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };

    // Ensure DB credential lookup returns "not found" so env creds are used.
    (db.select as any).mockReturnValue(mockSelectLimit([]));
    (db.update as any).mockReturnValue(mockUpdate());

    fetchSpy = vi.fn();
    // @ts-expect-error - override global fetch for tests
    global.fetch = fetchSpy;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it('isTickTickConfigured returns true when env vars are set', async () => {
    process.env.TICKTICK_CLIENT_ID = 'id';
    process.env.TICKTICK_CLIENT_SECRET = 'secret';
    const ok = await isTickTickConfigured();
    expect(ok).toBe(true);
  });

  it('isTickTickConfigured returns false when credentials are missing', async () => {
    delete process.env.TICKTICK_CLIENT_ID;
    delete process.env.TICKTICK_CLIENT_SECRET;
    const ok = await isTickTickConfigured();
    expect(ok).toBe(false);
  });

  it('getValidTickTickAccessToken returns current access token when not expired', async () => {
    (db.select as any).mockReturnValueOnce(
      mockSelectLimit([
        {
          id: 'conn-1',
          accessToken: 'at-1',
          refreshToken: 'rt-1',
          tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1h
        },
      ])
    );

    const token = await getValidTickTickAccessToken('conn-1');
    expect(token).toBe('at-1');
    expect(db.update).toHaveBeenCalledTimes(0);
  });

  it('getValidTickTickAccessToken refreshes token when expired and updates DB', async () => {
    process.env.TICKTICK_CLIENT_ID = 'id';
    process.env.TICKTICK_CLIENT_SECRET = 'secret';

    (db.select as any).mockReturnValueOnce(
      mockSelectLimit([
        {
          id: 'conn-1',
          accessToken: 'at-old',
          refreshToken: 'rt-1',
          tokenExpiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // expired
        },
      ])
    );

    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'at-new',
        refresh_token: 'rt-new',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'tasks:read tasks:write',
      }),
      text: async () => '',
    });

    const token = await getValidTickTickAccessToken('conn-1');
    expect(token).toBe('at-new');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it('getValidTickTickAccessToken throws when connection not found', async () => {
    (db.select as any).mockReturnValueOnce(mockSelectLimit([]));
    await expect(getValidTickTickAccessToken('missing')).rejects.toThrow(
      'TickTick connection not found'
    );
  });

  it('getValidTickTickAccessToken throws when expired and no refresh token', async () => {
    (db.select as any).mockReturnValueOnce(
      mockSelectLimit([
        {
          id: 'conn-1',
          accessToken: 'at-old',
          refreshToken: null,
          tokenExpiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // expired
        },
      ])
    );
    await expect(getValidTickTickAccessToken('conn-1')).rejects.toThrow(
      'Token expired and no refresh token available'
    );
  });

  it('createTickTickTask posts expected payload and reminder formatting', async () => {
    // No refresh; just use current token
    (db.select as any).mockReturnValueOnce(
      mockSelectLimit([
        {
          id: 'conn-1',
          accessToken: 'at-1',
          refreshToken: 'rt-1',
          tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        },
      ])
    );

    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'task-1' }),
      text: async () => '',
    });

    const taskId = await createTickTickTask('conn-1', 'proj-1', {
      title: 'Pay Bill',
      description: 'Test',
      date: '2025-01-01',
      allDay: true,
      reminderMinutes: 90, // 1h 30m
      link: 'http://app.local/x',
    });

    expect(taskId).toBe('task-1');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('/task');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer at-1');

    const body = JSON.parse(init.body);
    expect(body.projectId).toBe('proj-1');
    expect(body.title).toBe('Pay Bill');
    expect(body.isAllDay).toBe(true);
    expect(body.dueDate).toBe('2025-01-01');
    expect(body.reminders).toEqual(['TRIGGER:-P0DT1H30M0S']);
    expect(body.content).toContain('Open in Unified Ledger: http://app.local/x');
  });
});


