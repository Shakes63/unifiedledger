/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET, PUT } from '@/app/api/calendar-sync/settings/route';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
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
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';

function createGetRequest(url: string): Request {
  return { url } as unknown as Request;
}

function createPutRequest(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

function mockSelectWhere(rows: any[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  };
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

describe('GET/PUT /api/calendar-sync/settings', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    (requireAuth as any).mockResolvedValue({ userId: 'user-1' });
    (uuidv4 as any).mockReturnValue('uuid-1');

    (db.update as any).mockReturnValue(mockUpdate());
    (db.insert as any).mockReturnValue(mockInsert());
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
    consoleErrorSpy = null;
    vi.clearAllMocks();
  });

  it('GET returns 401 when unauthorized', async () => {
    (requireAuth as any).mockRejectedValue(new Error('Unauthorized'));
    const res = await GET(createGetRequest('http://localhost/api/calendar-sync/settings?householdId=hh-1'));
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('GET returns 400 when householdId is missing', async () => {
    const res = await GET(createGetRequest('http://localhost/api/calendar-sync/settings'));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe('householdId is required');
  });

  it('GET returns default settings when none exist and maps active connections', async () => {
    (db.select as any)
      .mockReturnValueOnce(
        mockSelectWhere([
          {
            id: 'conn-1',
            provider: 'google',
            calendarId: 'cal-1',
            calendarName: 'Primary',
            isActive: true,
            createdAt: '2025-01-01',
            updatedAt: '2025-01-02',
          },
        ])
      )
      .mockReturnValueOnce(mockSelectLimit([]));

    const res = await GET(createGetRequest('http://localhost/api/calendar-sync/settings?householdId=hh-1'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.connections).toEqual([
      {
        id: 'conn-1',
        provider: 'google',
        calendarId: 'cal-1',
        calendarName: 'Primary',
        isActive: true,
        createdAt: '2025-01-01',
      },
    ]);
    expect(data.settings).toEqual({
      syncMode: 'direct',
      syncBills: true,
      syncSavingsMilestones: true,
      syncDebtMilestones: true,
      syncPayoffDates: true,
      syncGoalTargetDates: true,
      reminderMinutes: 1440,
      lastFullSyncAt: null,
    });
  });

  it('GET returns persisted settings when present', async () => {
    (db.select as any)
      .mockReturnValueOnce(mockSelectWhere([]))
      .mockReturnValueOnce(
        mockSelectLimit([
          {
            id: 'settings-1',
            syncMode: 'budget_period',
            syncBills: false,
            syncSavingsMilestones: true,
            syncDebtMilestones: false,
            syncPayoffDates: true,
            syncGoalTargetDates: false,
            reminderMinutes: 60,
            lastFullSyncAt: '2025-02-01',
          },
        ])
      );

    const res = await GET(createGetRequest('http://localhost/api/calendar-sync/settings?householdId=hh-1'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.settings).toEqual({
      id: 'settings-1',
      syncMode: 'budget_period',
      syncBills: false,
      syncSavingsMilestones: true,
      syncDebtMilestones: false,
      syncPayoffDates: true,
      syncGoalTargetDates: false,
      reminderMinutes: 60,
      lastFullSyncAt: '2025-02-01',
    });
  });

  it('PUT returns 401 when unauthorized', async () => {
    (requireAuth as any).mockRejectedValue(new Error('Unauthorized'));
    const res = await PUT(createPutRequest({ householdId: 'hh-1', syncMode: 'direct' }));
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('PUT returns 400 when householdId is missing', async () => {
    const res = await PUT(createPutRequest({ syncMode: 'direct' }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe('householdId is required');
  });

  it('PUT returns 400 for invalid syncMode', async () => {
    const res = await PUT(createPutRequest({ householdId: 'hh-1', syncMode: 'nope' }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain('Invalid syncMode');
  });

  it('PUT updates existing settings', async () => {
    (db.select as any).mockReturnValueOnce(mockSelectLimit([{ id: 'settings-1' }]));

    const res = await PUT(
      createPutRequest({
        householdId: 'hh-1',
        syncMode: 'direct',
        syncBills: false,
        reminderMinutes: 30,
      })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, id: 'settings-1' });
    expect(db.update).toHaveBeenCalledTimes(1);
    expect(db.insert).toHaveBeenCalledTimes(0);
  });

  it('PUT creates settings when missing and applies defaults', async () => {
    (db.select as any).mockReturnValueOnce(mockSelectLimit([]));

    const res = await PUT(createPutRequest({ householdId: 'hh-1' }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, id: 'uuid-1' });
    expect(db.insert).toHaveBeenCalledTimes(1);
  });
});


