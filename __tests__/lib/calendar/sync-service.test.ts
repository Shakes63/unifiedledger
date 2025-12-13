/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/lib/calendar/event-generator', () => ({
  getSyncSettings: vi.fn(),
  generateAllEvents: vi.fn(),
}));

vi.mock('@/lib/calendar/google-calendar', () => ({
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
  deleteEvents: vi.fn(),
}));

vi.mock('@/lib/calendar/ticktick-calendar', () => ({
  createTickTickTask: vi.fn(),
  updateTickTickTask: vi.fn(),
  deleteTickTickTask: vi.fn(),
  deleteTickTickTasks: vi.fn(),
}));

vi.mock('uuid', () => ({
  v4: vi.fn(),
}));

import { db } from '@/lib/db';
import { getSyncSettings, generateAllEvents } from '@/lib/calendar/event-generator';
import {
  createEvent as createGoogleEvent,
  updateEvent as updateGoogleEvent,
  deleteEvent as deleteGoogleEvent,
} from '@/lib/calendar/google-calendar';
import {
  createTickTickTask,
  updateTickTickTask,
  deleteTickTickTask,
  deleteTickTickTasks,
} from '@/lib/calendar/ticktick-calendar';
import { v4 as uuidv4 } from 'uuid';

import { fullSync, syncEntity, isSyncEnabled } from '@/lib/calendar/sync-service';

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

function mockDelete() {
  return {
    where: vi.fn().mockResolvedValue(undefined),
  };
}

describe('lib/calendar/sync-service', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    (uuidv4 as any).mockReturnValue('uuid-1');
    (db.update as any).mockReturnValue(mockUpdate());
    (db.insert as any).mockReturnValue(mockInsert());
    (db.delete as any).mockReturnValue(mockDelete());
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
    consoleErrorSpy = null;
    vi.clearAllMocks();
  });

  describe('fullSync', () => {
    it('returns success=false when no sync settings exist', async () => {
      (getSyncSettings as any).mockResolvedValue(null);

      const res = await fullSync('user-1', 'hh-1');
      expect(res.success).toBe(false);
      expect(res.errors).toContain('No sync settings found');
    });

    it('returns success=false when no active connections exist', async () => {
      (getSyncSettings as any).mockResolvedValue({
        syncMode: 'direct',
        syncBills: true,
        syncSavingsMilestones: true,
        syncDebtMilestones: true,
        syncPayoffDates: true,
        syncGoalTargetDates: true,
        reminderMinutes: 1440,
        lastFullSyncAt: null,
      });

      (db.select as any).mockReturnValueOnce(mockSelectWhere([])); // getActiveConnections

      const res = await fullSync('user-1', 'hh-1');
      expect(res.success).toBe(false);
      expect(res.errors).toContain('No active calendar connections');
    });

    it('adds an error when a connection has no calendar selected', async () => {
      (getSyncSettings as any).mockResolvedValue({
        syncMode: 'direct',
        syncBills: true,
        syncSavingsMilestones: true,
        syncDebtMilestones: true,
        syncPayoffDates: true,
        syncGoalTargetDates: true,
        reminderMinutes: 1440,
        lastFullSyncAt: null,
      });

      (generateAllEvents as any).mockResolvedValue([]);

      (db.select as any).mockReturnValueOnce(
        mockSelectWhere([
          { id: 'conn-1', provider: 'google', calendarId: null, isActive: true },
        ])
      ); // getActiveConnections

      const res = await fullSync('user-1', 'hh-1');
      expect(res.success).toBe(false);
      expect(res.errors.join(' ')).toContain('has no calendar selected');
      expect(db.update).toHaveBeenCalledTimes(1); // last sync timestamp update still attempted
    });

    it('creates events using Google provider when provider=google', async () => {
      (getSyncSettings as any).mockResolvedValue({
        syncMode: 'direct',
        syncBills: true,
        syncSavingsMilestones: true,
        syncDebtMilestones: true,
        syncPayoffDates: true,
        syncGoalTargetDates: true,
        reminderMinutes: 1440,
        lastFullSyncAt: null,
      });

      (generateAllEvents as any).mockResolvedValue([
        {
          title: 'Test Event',
          description: 'desc',
          date: '2025-01-01',
          allDay: true,
          reminderMinutes: 60,
          sourceType: 'bill_instance',
          sourceId: 'src-1',
        },
      ]);

      (createGoogleEvent as any).mockResolvedValue('evt-1');

      // select call order:
      // 1) getActiveConnections
      // 2) existingEvents for the connection
      (db.select as any)
        .mockReturnValueOnce(
          mockSelectWhere([
            { id: 'conn-1', provider: 'google', calendarId: 'cal-1', isActive: true },
          ])
        )
        .mockReturnValueOnce(
          mockSelectWhere([])
        );

      const res = await fullSync('user-1', 'hh-1');

      expect(res.created).toBe(1);
      expect(createGoogleEvent).toHaveBeenCalledTimes(1);
      expect(createTickTickTask).toHaveBeenCalledTimes(0);
    });

    it('creates events using TickTick provider when provider=ticktick', async () => {
      (getSyncSettings as any).mockResolvedValue({
        syncMode: 'direct',
        syncBills: true,
        syncSavingsMilestones: true,
        syncDebtMilestones: true,
        syncPayoffDates: true,
        syncGoalTargetDates: true,
        reminderMinutes: 1440,
        lastFullSyncAt: null,
      });

      (generateAllEvents as any).mockResolvedValue([
        {
          title: 'Tick',
          description: 'desc',
          date: '2025-01-01',
          allDay: true,
          reminderMinutes: 60,
          sourceType: 'bill_instance',
          sourceId: 'src-1',
        },
      ]);

      (createTickTickTask as any).mockResolvedValue('task-1');

      (db.select as any)
        .mockReturnValueOnce(
          mockSelectWhere([
            { id: 'conn-tt', provider: 'ticktick', calendarId: 'proj-1', isActive: true },
          ])
        )
        .mockReturnValueOnce(
          mockSelectWhere([])
        );

      const res = await fullSync('user-1', 'hh-1');

      expect(res.created).toBe(1);
      expect(createTickTickTask).toHaveBeenCalledTimes(1);
      expect(createGoogleEvent).toHaveBeenCalledTimes(0);
    });

    it('deletes existing tracked events using TickTick batch delete when provider=ticktick', async () => {
      (getSyncSettings as any).mockResolvedValue({
        syncMode: 'direct',
        syncBills: true,
        syncSavingsMilestones: true,
        syncDebtMilestones: true,
        syncPayoffDates: true,
        syncGoalTargetDates: true,
        reminderMinutes: 1440,
        lastFullSyncAt: null,
      });

      (generateAllEvents as any).mockResolvedValue([]); // no new events
      (deleteTickTickTasks as any).mockResolvedValue(undefined);

      (db.select as any)
        .mockReturnValueOnce(
          mockSelectWhere([
            { id: 'conn-tt', provider: 'ticktick', calendarId: 'proj-1', isActive: true },
          ])
        )
        .mockReturnValueOnce(
          mockSelectWhere([
            { externalEventId: 'task-1' },
            { externalEventId: 'task-2' },
          ])
        );

      const res = await fullSync('user-1', 'hh-1');

      expect(deleteTickTickTasks).toHaveBeenCalledTimes(1);
      expect(res.deleted).toBe(2);
      // local tracking cleared
      expect(db.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe('syncEntity', () => {
    it('returns early when no sync settings exist', async () => {
      (getSyncSettings as any).mockResolvedValue(null);
      await syncEntity('user-1', 'hh-1', 'bill_instance', 'src-1', 'create');
      expect(db.select).toHaveBeenCalledTimes(0);
    });

    it('returns early when source type is disabled by settings', async () => {
      (getSyncSettings as any).mockResolvedValue({
        syncMode: 'direct',
        syncBills: false,
        syncSavingsMilestones: true,
        syncDebtMilestones: true,
        syncPayoffDates: true,
        syncGoalTargetDates: true,
        reminderMinutes: 1440,
        lastFullSyncAt: null,
      });

      await syncEntity('user-1', 'hh-1', 'bill_instance', 'src-1', 'create');

      // Should not attempt to load connections if shouldSync is false
      expect(db.select).toHaveBeenCalledTimes(0);
    });

    it('returns early when no active connections exist', async () => {
      (getSyncSettings as any).mockResolvedValue({
        syncMode: 'direct',
        syncBills: true,
        syncSavingsMilestones: true,
        syncDebtMilestones: true,
        syncPayoffDates: true,
        syncGoalTargetDates: true,
        reminderMinutes: 1440,
        lastFullSyncAt: null,
      });

      (db.select as any).mockReturnValueOnce(mockSelectWhere([])); // getActiveConnections

      await syncEntity('user-1', 'hh-1', 'bill_instance', 'src-1', 'create');
      expect(db.select).toHaveBeenCalledTimes(1);
    });

    it('in budget_period mode, bill_instance change triggers fullSync', async () => {
      // We can't reliably spy on internal fullSync() calls (same-module binding),
      // so we assert via side-effects: syncEntity() calls getSyncSettings once,
      // then fullSync() calls getSyncSettings again.
      (getSyncSettings as any)
        .mockResolvedValueOnce({
        syncMode: 'budget_period',
        syncBills: true,
        syncSavingsMilestones: true,
        syncDebtMilestones: true,
        syncPayoffDates: true,
        syncGoalTargetDates: true,
        reminderMinutes: 1440,
        lastFullSyncAt: null,
        })
        .mockResolvedValueOnce(null); // make fullSync exit early

      (db.select as any).mockReturnValueOnce(
        mockSelectWhere([{ id: 'conn-1', provider: 'google', calendarId: 'cal-1', isActive: true }])
      );

      await syncEntity('user-1', 'hh-1', 'bill_instance', 'src-1', 'update');
      expect(getSyncSettings).toHaveBeenCalledTimes(2);
    });

    it('deletes tracked event on delete action (google)', async () => {
      (getSyncSettings as any).mockResolvedValue({
        syncMode: 'direct',
        syncBills: true,
        syncSavingsMilestones: true,
        syncDebtMilestones: true,
        syncPayoffDates: true,
        syncGoalTargetDates: true,
        reminderMinutes: 1440,
        lastFullSyncAt: null,
      });

      // select call order:
      // 1) getActiveConnections
      // 2) trackedEvent lookup (limit 1)
      (db.select as any)
        .mockReturnValueOnce(
          mockSelectWhere([
            { id: 'conn-1', provider: 'google', calendarId: 'cal-1', isActive: true },
          ])
        )
        .mockReturnValueOnce(
          mockSelectLimit([{ id: 'track-1', externalEventId: 'evt-1' }])
        );

      await syncEntity('user-1', 'hh-1', 'bill_instance', 'src-1', 'delete');

      expect(deleteGoogleEvent).toHaveBeenCalledTimes(1);
      expect(db.delete).toHaveBeenCalledTimes(1);
    });

    it('deletes tracked event on delete action (ticktick)', async () => {
      (getSyncSettings as any).mockResolvedValue({
        syncMode: 'direct',
        syncBills: true,
        syncSavingsMilestones: true,
        syncDebtMilestones: true,
        syncPayoffDates: true,
        syncGoalTargetDates: true,
        reminderMinutes: 1440,
        lastFullSyncAt: null,
      });

      (db.select as any)
        .mockReturnValueOnce(
          mockSelectWhere([
            { id: 'conn-tt', provider: 'ticktick', calendarId: 'proj-1', isActive: true },
          ])
        )
        .mockReturnValueOnce(
          mockSelectLimit([{ id: 'track-tt', externalEventId: 'task-1' }])
        );

      await syncEntity('user-1', 'hh-1', 'bill_instance', 'src-1', 'delete');

      expect(deleteTickTickTask).toHaveBeenCalledTimes(1);
      expect(db.delete).toHaveBeenCalledTimes(1);
    });

    it('create action uses TickTick create when provider=ticktick', async () => {
      (getSyncSettings as any).mockResolvedValue({
        syncMode: 'direct',
        syncBills: true,
        syncSavingsMilestones: true,
        syncDebtMilestones: true,
        syncPayoffDates: true,
        syncGoalTargetDates: true,
        reminderMinutes: 1440,
        lastFullSyncAt: null,
      });

      (generateAllEvents as any).mockResolvedValue([
        {
          title: 'New',
          description: 'desc',
          date: '2025-01-01',
          allDay: true,
          sourceType: 'bill_instance',
          sourceId: 'src-1',
        },
      ]);

      (createTickTickTask as any).mockResolvedValue('task-new');

      (db.select as any)
        .mockReturnValueOnce(
          mockSelectWhere([{ id: 'conn-tt', provider: 'ticktick', calendarId: 'proj-1', isActive: true }])
        )
        .mockReturnValueOnce(mockSelectLimit([]));

      await syncEntity('user-1', 'hh-1', 'bill_instance', 'src-1', 'create');

      expect(createTickTickTask).toHaveBeenCalledTimes(1);
      expect(db.insert).toHaveBeenCalledTimes(1);
    });

    it('update action uses TickTick update when provider=ticktick', async () => {
      (getSyncSettings as any).mockResolvedValue({
        syncMode: 'direct',
        syncBills: true,
        syncSavingsMilestones: true,
        syncDebtMilestones: true,
        syncPayoffDates: true,
        syncGoalTargetDates: true,
        reminderMinutes: 1440,
        lastFullSyncAt: null,
      });

      (generateAllEvents as any).mockResolvedValue([
        {
          title: 'Updated',
          description: 'desc',
          date: '2025-01-02',
          allDay: true,
          sourceType: 'bill_instance',
          sourceId: 'src-1',
        },
      ]);

      (updateTickTickTask as any).mockResolvedValue(undefined);

      (db.select as any)
        .mockReturnValueOnce(
          mockSelectWhere([{ id: 'conn-tt', provider: 'ticktick', calendarId: 'proj-1', isActive: true }])
        )
        .mockReturnValueOnce(
          mockSelectLimit([{ id: 'track-tt', externalEventId: 'task-1' }])
        );

      await syncEntity('user-1', 'hh-1', 'bill_instance', 'src-1', 'update');

      expect(updateTickTickTask).toHaveBeenCalledTimes(1);
      expect(db.update).toHaveBeenCalledTimes(1);
    });

    it('update action falls back to TickTick create when update throws', async () => {
      (getSyncSettings as any).mockResolvedValue({
        syncMode: 'direct',
        syncBills: true,
        syncSavingsMilestones: true,
        syncDebtMilestones: true,
        syncPayoffDates: true,
        syncGoalTargetDates: true,
        reminderMinutes: 1440,
        lastFullSyncAt: null,
      });

      (generateAllEvents as any).mockResolvedValue([
        {
          title: 'Updated',
          description: 'desc',
          date: '2025-01-02',
          allDay: true,
          sourceType: 'bill_instance',
          sourceId: 'src-1',
        },
      ]);

      (updateTickTickTask as any).mockRejectedValue(new Error('fail update'));
      (createTickTickTask as any).mockResolvedValue('task-2');

      (db.select as any)
        .mockReturnValueOnce(
          mockSelectWhere([{ id: 'conn-tt', provider: 'ticktick', calendarId: 'proj-1', isActive: true }])
        )
        .mockReturnValueOnce(
          mockSelectLimit([{ id: 'track-tt', externalEventId: 'task-1' }])
        );

      await syncEntity('user-1', 'hh-1', 'bill_instance', 'src-1', 'update');

      expect(updateTickTickTask).toHaveBeenCalledTimes(1);
      expect(createTickTickTask).toHaveBeenCalledTimes(1);
      expect(db.update).toHaveBeenCalledTimes(1);
    });

    it('create action: creates external event and inserts tracking row when not previously tracked', async () => {
      (getSyncSettings as any).mockResolvedValue({
        syncMode: 'direct',
        syncBills: true,
        syncSavingsMilestones: true,
        syncDebtMilestones: true,
        syncPayoffDates: true,
        syncGoalTargetDates: true,
        reminderMinutes: 1440,
        lastFullSyncAt: null,
      });

      (generateAllEvents as any).mockResolvedValue([
        {
          title: 'New',
          description: 'desc',
          date: '2025-01-01',
          allDay: true,
          sourceType: 'bill_instance',
          sourceId: 'src-1',
        },
      ]);

      (createGoogleEvent as any).mockResolvedValue('evt-new');

      // select call order:
      // 1) getActiveConnections
      // 2) trackedEvent lookup (limit 1) => none
      (db.select as any)
        .mockReturnValueOnce(
          mockSelectWhere([{ id: 'conn-1', provider: 'google', calendarId: 'cal-1', isActive: true }])
        )
        .mockReturnValueOnce(mockSelectLimit([]));

      await syncEntity('user-1', 'hh-1', 'bill_instance', 'src-1', 'create');

      expect(createGoogleEvent).toHaveBeenCalledTimes(1);
      expect(db.insert).toHaveBeenCalledTimes(1);
    });

    it('update action: updates external event when tracked event exists', async () => {
      (getSyncSettings as any).mockResolvedValue({
        syncMode: 'direct',
        syncBills: true,
        syncSavingsMilestones: true,
        syncDebtMilestones: true,
        syncPayoffDates: true,
        syncGoalTargetDates: true,
        reminderMinutes: 1440,
        lastFullSyncAt: null,
      });

      (generateAllEvents as any).mockResolvedValue([
        {
          title: 'Updated',
          description: 'desc',
          date: '2025-01-02',
          allDay: true,
          sourceType: 'bill_instance',
          sourceId: 'src-1',
        },
      ]);

      (updateGoogleEvent as any).mockResolvedValue(undefined);

      (db.select as any)
        .mockReturnValueOnce(
          mockSelectWhere([{ id: 'conn-1', provider: 'google', calendarId: 'cal-1', isActive: true }])
        )
        .mockReturnValueOnce(
          mockSelectLimit([{ id: 'track-1', externalEventId: 'evt-1' }])
        );

      await syncEntity('user-1', 'hh-1', 'bill_instance', 'src-1', 'update');

      expect(updateGoogleEvent).toHaveBeenCalledTimes(1);
      expect(db.update).toHaveBeenCalledTimes(1);
    });

    it('update action: falls back to create when provider update throws', async () => {
      (getSyncSettings as any).mockResolvedValue({
        syncMode: 'direct',
        syncBills: true,
        syncSavingsMilestones: true,
        syncDebtMilestones: true,
        syncPayoffDates: true,
        syncGoalTargetDates: true,
        reminderMinutes: 1440,
        lastFullSyncAt: null,
      });

      (generateAllEvents as any).mockResolvedValue([
        {
          title: 'Updated',
          description: 'desc',
          date: '2025-01-02',
          allDay: true,
          sourceType: 'bill_instance',
          sourceId: 'src-1',
        },
      ]);

      (updateGoogleEvent as any).mockRejectedValue(new Error('fail update'));
      (createGoogleEvent as any).mockResolvedValue('evt-2');

      (db.select as any)
        .mockReturnValueOnce(
          mockSelectWhere([{ id: 'conn-1', provider: 'google', calendarId: 'cal-1', isActive: true }])
        )
        .mockReturnValueOnce(
          mockSelectLimit([{ id: 'track-1', externalEventId: 'evt-1' }])
        );

      await syncEntity('user-1', 'hh-1', 'bill_instance', 'src-1', 'update');

      expect(updateGoogleEvent).toHaveBeenCalledTimes(1);
      expect(createGoogleEvent).toHaveBeenCalledTimes(1);
      expect(db.update).toHaveBeenCalledTimes(1);
    });

    it('create/update: when event is out of generated range, deletes if tracked', async () => {
      (getSyncSettings as any).mockResolvedValue({
        syncMode: 'direct',
        syncBills: true,
        syncSavingsMilestones: true,
        syncDebtMilestones: true,
        syncPayoffDates: true,
        syncGoalTargetDates: true,
        reminderMinutes: 1440,
        lastFullSyncAt: null,
      });

      (generateAllEvents as any).mockResolvedValue([]); // no matching event

      (db.select as any)
        .mockReturnValueOnce(
          mockSelectWhere([{ id: 'conn-1', provider: 'google', calendarId: 'cal-1', isActive: true }])
        )
        // tracked event lookup for out-of-range path
        .mockReturnValueOnce(
          mockSelectLimit([{ id: 'track-1', externalEventId: 'evt-1' }])
        );

      await syncEntity('user-1', 'hh-1', 'bill_instance', 'src-1', 'update');

      expect(deleteGoogleEvent).toHaveBeenCalledTimes(1);
      expect(db.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe('isSyncEnabled', () => {
    it('returns false when no active connections exist', async () => {
      (db.select as any).mockReturnValueOnce(mockSelectWhere([]));
      const enabled = await isSyncEnabled('user-1', 'hh-1');
      expect(enabled).toBe(false);
    });

    it('returns false when connections exist but none have calendarId', async () => {
      (db.select as any).mockReturnValueOnce(
        mockSelectWhere([{ id: 'c1', calendarId: null }, { id: 'c2', calendarId: '' }])
      );
      const enabled = await isSyncEnabled('user-1', 'hh-1');
      expect(enabled).toBe(false);
    });

    it('returns true when any connection has calendarId', async () => {
      (db.select as any).mockReturnValueOnce(
        mockSelectWhere([{ id: 'c1', calendarId: null }, { id: 'c2', calendarId: 'x' }])
      );
      const enabled = await isSyncEnabled('user-1', 'hh-1');
      expect(enabled).toBe(true);
    });
  });
});


