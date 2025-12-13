import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { calendarConnections, calendarSyncSettings } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

/**
 * GET /api/calendar-sync/settings
 * Get calendar sync settings and connections for a household
 * Query params: householdId
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    const { searchParams } = new URL(request.url);
    const householdId = searchParams.get('householdId');

    if (!householdId) {
      return Response.json(
        { error: 'householdId is required' },
        { status: 400 }
      );
    }

    // Get connections for this user/household
    const connections = await db
      .select()
      .from(calendarConnections)
      .where(
        and(
          eq(calendarConnections.userId, userId),
          eq(calendarConnections.householdId, householdId),
          eq(calendarConnections.isActive, true)
        )
      );

    // Get sync settings
    const settings = await db
      .select()
      .from(calendarSyncSettings)
      .where(
        and(
          eq(calendarSyncSettings.userId, userId),
          eq(calendarSyncSettings.householdId, householdId)
        )
      )
      .limit(1);

    // Return default settings if none exist
    const defaultSettings = {
      syncMode: 'direct' as const,
      syncBills: true,
      syncSavingsMilestones: true,
      syncDebtMilestones: true,
      syncPayoffDates: true,
      syncGoalTargetDates: true,
      reminderMinutes: 1440,
      lastFullSyncAt: null,
    };

    return Response.json({
      connections: connections.map((c) => ({
        id: c.id,
        provider: c.provider,
        calendarId: c.calendarId,
        calendarName: c.calendarName,
        isActive: c.isActive,
        createdAt: c.createdAt,
      })),
      settings: settings[0]
        ? {
            id: settings[0].id,
            syncMode: settings[0].syncMode,
            syncBills: settings[0].syncBills,
            syncSavingsMilestones: settings[0].syncSavingsMilestones,
            syncDebtMilestones: settings[0].syncDebtMilestones,
            syncPayoffDates: settings[0].syncPayoffDates,
            syncGoalTargetDates: settings[0].syncGoalTargetDates,
            reminderMinutes: settings[0].reminderMinutes,
            lastFullSyncAt: settings[0].lastFullSyncAt,
          }
        : defaultSettings,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching calendar sync settings:', error);
    return Response.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/calendar-sync/settings
 * Update calendar sync settings
 * Body: { householdId, syncMode?, syncBills?, syncSavingsMilestones?, syncDebtMilestones?, syncPayoffDates?, syncGoalTargetDates?, reminderMinutes? }
 */
export async function PUT(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const {
      householdId,
      syncMode,
      syncBills,
      syncSavingsMilestones,
      syncDebtMilestones,
      syncPayoffDates,
      syncGoalTargetDates,
      reminderMinutes,
    } = body;

    if (!householdId) {
      return Response.json(
        { error: 'householdId is required' },
        { status: 400 }
      );
    }

    // Validate syncMode
    if (syncMode && !['direct', 'budget_period'].includes(syncMode)) {
      return Response.json(
        { error: 'Invalid syncMode. Must be "direct" or "budget_period"' },
        { status: 400 }
      );
    }

    // Check if settings exist
    const existing = await db
      .select()
      .from(calendarSyncSettings)
      .where(
        and(
          eq(calendarSyncSettings.userId, userId),
          eq(calendarSyncSettings.householdId, householdId)
        )
      )
      .limit(1);

    const updates: Partial<typeof calendarSyncSettings.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };

    if (syncMode !== undefined) updates.syncMode = syncMode;
    if (syncBills !== undefined) updates.syncBills = syncBills;
    if (syncSavingsMilestones !== undefined) updates.syncSavingsMilestones = syncSavingsMilestones;
    if (syncDebtMilestones !== undefined) updates.syncDebtMilestones = syncDebtMilestones;
    if (syncPayoffDates !== undefined) updates.syncPayoffDates = syncPayoffDates;
    if (syncGoalTargetDates !== undefined) updates.syncGoalTargetDates = syncGoalTargetDates;
    if (reminderMinutes !== undefined) updates.reminderMinutes = reminderMinutes;

    if (existing[0]) {
      // Update existing settings
      await db
        .update(calendarSyncSettings)
        .set(updates)
        .where(eq(calendarSyncSettings.id, existing[0].id));

      return Response.json({
        success: true,
        id: existing[0].id,
      });
    } else {
      // Create new settings
      const id = uuidv4();
      await db.insert(calendarSyncSettings).values({
        id,
        userId,
        householdId,
        syncMode: syncMode || 'direct',
        syncBills: syncBills ?? true,
        syncSavingsMilestones: syncSavingsMilestones ?? true,
        syncDebtMilestones: syncDebtMilestones ?? true,
        syncPayoffDates: syncPayoffDates ?? true,
        syncGoalTargetDates: syncGoalTargetDates ?? true,
        reminderMinutes: reminderMinutes ?? 1440,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return Response.json({
        success: true,
        id,
      });
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error updating calendar sync settings:', error);
    return Response.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}





