/**
 * Calendar Sync Service
 * Orchestrates syncing events to external calendars
 */

import { db } from '@/lib/db';
import {
  calendarConnections,
  calendarSyncSettings,
  calendarEvents,
  userHouseholdPreferences,
} from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { format, addMonths } from 'date-fns';
import {
  createEvent,
  updateEvent,
  deleteEvent,
  deleteEvents,
} from './google-calendar';
import {
  generateAllEvents,
  getSyncSettings,
  GeneratedEvent,
} from './event-generator';
import { BudgetScheduleSettings } from '@/lib/budgets/budget-schedule';

// Types
export interface SyncResult {
  success: boolean;
  created: number;
  updated: number;
  deleted: number;
  errors: string[];
}

export type SourceType = 'bill_instance' | 'savings_milestone' | 'debt_milestone' | 'goal_target' | 'payoff_date' | 'budget_period_bills';

/**
 * Get budget schedule settings for a user/household
 * Budget cycle settings are stored in userHouseholdPreferences
 */
async function getBudgetSettings(
  userId: string,
  householdId: string
): Promise<BudgetScheduleSettings | undefined> {
  // Budget cycle settings are in userHouseholdPreferences
  const prefs = await db
    .select()
    .from(userHouseholdPreferences)
    .where(
      and(
        eq(userHouseholdPreferences.userId, userId),
        eq(userHouseholdPreferences.householdId, householdId)
      )
    )
    .limit(1);

  if (prefs[0]?.budgetCycleFrequency) {
    return {
      budgetCycleFrequency: prefs[0].budgetCycleFrequency as 'weekly' | 'biweekly' | 'semi-monthly' | 'monthly',
      budgetCycleStartDay: prefs[0].budgetCycleStartDay,
      budgetCycleReferenceDate: prefs[0].budgetCycleReferenceDate,
      budgetCycleSemiMonthlyDays: prefs[0].budgetCycleSemiMonthlyDays,
      budgetPeriodRollover: prefs[0].budgetPeriodRollover ?? false,
      budgetPeriodManualAmount: prefs[0].budgetPeriodManualAmount,
    };
  }

  return undefined;
}

/**
 * Get all active calendar connections for a user/household
 */
async function getActiveConnections(userId: string, householdId: string) {
  return db
    .select()
    .from(calendarConnections)
    .where(
      and(
        eq(calendarConnections.userId, userId),
        eq(calendarConnections.householdId, householdId),
        eq(calendarConnections.isActive, true)
      )
    );
}

/**
 * Perform a full sync - clears existing events and creates all new ones
 */
export async function fullSync(
  userId: string,
  householdId: string
): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    created: 0,
    updated: 0,
    deleted: 0,
    errors: [],
  };

  try {
    // Get sync settings
    const syncSettings = await getSyncSettings(userId, householdId);
    if (!syncSettings) {
      return { ...result, success: false, errors: ['No sync settings found'] };
    }

    // Get active connections
    const connections = await getActiveConnections(userId, householdId);
    if (connections.length === 0) {
      return { ...result, success: false, errors: ['No active calendar connections'] };
    }

    // Get budget settings if in budget_period mode
    const budgetSettings = syncSettings.syncMode === 'budget_period'
      ? await getBudgetSettings(userId, householdId)
      : undefined;

    // Define the sync window (6 months ahead)
    const startDate = format(new Date(), 'yyyy-MM-dd');
    const endDate = format(addMonths(new Date(), 6), 'yyyy-MM-dd');

    // Generate all events
    const newEvents = await generateAllEvents(
      userId,
      householdId,
      startDate,
      endDate,
      syncSettings,
      budgetSettings
    );

    // Process each connection
    for (const connection of connections) {
      if (!connection.calendarId) {
        result.errors.push(`Connection ${connection.id} has no calendar selected`);
        continue;
      }

      try {
        // Get existing tracked events for this connection
        const existingEvents = await db
          .select()
          .from(calendarEvents)
          .where(eq(calendarEvents.connectionId, connection.id));

        // Delete all existing events from the external calendar
        if (existingEvents.length > 0) {
          try {
            await deleteEvents(
              connection.id,
              connection.calendarId,
              existingEvents.map((e) => e.externalEventId)
            );
            result.deleted += existingEvents.length;
          } catch (deleteError) {
            console.error('Error deleting events:', deleteError);
            // Continue anyway - events may have been manually deleted
          }

          // Delete from our tracking table
          await db
            .delete(calendarEvents)
            .where(eq(calendarEvents.connectionId, connection.id));
        }

        // Create new events
        for (const event of newEvents) {
          try {
            const externalEventId = await createEvent(
              connection.id,
              connection.calendarId,
              event
            );

            // Track the event
            await db.insert(calendarEvents).values({
              id: uuidv4(),
              userId,
              householdId,
              connectionId: connection.id,
              externalEventId,
              sourceType: event.sourceType,
              sourceId: event.sourceId,
              eventDate: event.date,
              syncMode: syncSettings.syncMode,
              eventTitle: event.title,
              lastSyncedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
            });

            result.created++;
          } catch (createError) {
            console.error('Error creating event:', createError);
            result.errors.push(`Failed to create event: ${event.title}`);
          }
        }
      } catch (connError) {
        console.error(`Error syncing to connection ${connection.id}:`, connError);
        result.errors.push(`Failed to sync to ${connection.provider}`);
      }
    }

    // Update last sync timestamp
    await db
      .update(calendarSyncSettings)
      .set({
        lastFullSyncAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(calendarSyncSettings.userId, userId),
          eq(calendarSyncSettings.householdId, householdId)
        )
      );

    result.success = result.errors.length === 0;
    return result;
  } catch (error) {
    console.error('Full sync error:', error);
    return {
      ...result,
      success: false,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Sync a single entity (for incremental updates)
 */
export async function syncEntity(
  userId: string,
  householdId: string,
  sourceType: SourceType,
  sourceId: string,
  action: 'create' | 'update' | 'delete'
): Promise<void> {
  try {
    // Get sync settings
    const syncSettings = await getSyncSettings(userId, householdId);
    if (!syncSettings) return;

    // Check if this source type should be synced
    const shouldSync = 
      (sourceType === 'bill_instance' && syncSettings.syncBills) ||
      (sourceType === 'savings_milestone' && syncSettings.syncSavingsMilestones) ||
      (sourceType === 'debt_milestone' && syncSettings.syncDebtMilestones) ||
      (sourceType === 'goal_target' && syncSettings.syncGoalTargetDates) ||
      (sourceType === 'payoff_date' && syncSettings.syncPayoffDates) ||
      sourceType === 'budget_period_bills';

    if (!shouldSync) return;

    // Get active connections
    const connections = await getActiveConnections(userId, householdId);
    if (connections.length === 0) return;

    // For budget period mode, we need to re-sync the entire period
    if (syncSettings.syncMode === 'budget_period' && sourceType === 'bill_instance') {
      // Trigger a full sync for simplicity in budget period mode
      await fullSync(userId, householdId);
      return;
    }

    // Process each connection
    for (const connection of connections) {
      if (!connection.calendarId) continue;

      try {
        if (action === 'delete') {
          // Find and delete the tracked event
          const trackedEvent = await db
            .select()
            .from(calendarEvents)
            .where(
              and(
                eq(calendarEvents.connectionId, connection.id),
                eq(calendarEvents.sourceType, sourceType),
                eq(calendarEvents.sourceId, sourceId)
              )
            )
            .limit(1);

          if (trackedEvent[0]) {
            try {
              await deleteEvent(
                connection.id,
                connection.calendarId,
                trackedEvent[0].externalEventId
              );
            } catch (deleteError) {
              console.error('Error deleting event:', deleteError);
            }

            await db
              .delete(calendarEvents)
              .where(eq(calendarEvents.id, trackedEvent[0].id));
          }
        } else {
          // Create or update - generate the event
          const budgetSettings = syncSettings.syncMode === 'budget_period'
            ? await getBudgetSettings(userId, householdId)
            : undefined;

          const startDate = format(new Date(), 'yyyy-MM-dd');
          const endDate = format(addMonths(new Date(), 6), 'yyyy-MM-dd');

          // Generate events (will include the one we need)
          const events = await generateAllEvents(
            userId,
            householdId,
            startDate,
            endDate,
            syncSettings,
            budgetSettings
          );

          // Find the specific event
          const event = events.find(
            (e) => e.sourceType === sourceType && e.sourceId === sourceId
          );

          if (!event) {
            // Event no longer exists (maybe out of date range) - delete if tracked
            const trackedEvent = await db
              .select()
              .from(calendarEvents)
              .where(
                and(
                  eq(calendarEvents.connectionId, connection.id),
                  eq(calendarEvents.sourceType, sourceType),
                  eq(calendarEvents.sourceId, sourceId)
                )
              )
              .limit(1);

            if (trackedEvent[0]) {
              try {
                await deleteEvent(
                  connection.id,
                  connection.calendarId,
                  trackedEvent[0].externalEventId
                );
              } catch (e) {
                // Ignore deletion errors
              }
              await db
                .delete(calendarEvents)
                .where(eq(calendarEvents.id, trackedEvent[0].id));
            }
            continue;
          }

          // Check if event already exists
          const existingEvent = await db
            .select()
            .from(calendarEvents)
            .where(
              and(
                eq(calendarEvents.connectionId, connection.id),
                eq(calendarEvents.sourceType, sourceType),
                eq(calendarEvents.sourceId, sourceId)
              )
            )
            .limit(1);

          if (existingEvent[0]) {
            // Update existing event
            try {
              await updateEvent(
                connection.id,
                connection.calendarId,
                existingEvent[0].externalEventId,
                event
              );

              await db
                .update(calendarEvents)
                .set({
                  eventDate: event.date,
                  eventTitle: event.title,
                  lastSyncedAt: new Date().toISOString(),
                })
                .where(eq(calendarEvents.id, existingEvent[0].id));
            } catch (updateError) {
              console.error('Error updating event:', updateError);
              // Try to create a new event instead
              const newExternalId = await createEvent(
                connection.id,
                connection.calendarId,
                event
              );

              await db
                .update(calendarEvents)
                .set({
                  externalEventId: newExternalId,
                  eventDate: event.date,
                  eventTitle: event.title,
                  lastSyncedAt: new Date().toISOString(),
                })
                .where(eq(calendarEvents.id, existingEvent[0].id));
            }
          } else {
            // Create new event
            const externalEventId = await createEvent(
              connection.id,
              connection.calendarId,
              event
            );

            await db.insert(calendarEvents).values({
              id: uuidv4(),
              userId,
              householdId,
              connectionId: connection.id,
              externalEventId,
              sourceType: event.sourceType,
              sourceId: event.sourceId,
              eventDate: event.date,
              syncMode: syncSettings.syncMode,
              eventTitle: event.title,
              lastSyncedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
            });
          }
        }
      } catch (connError) {
        console.error(`Error syncing to connection ${connection.id}:`, connError);
      }
    }
  } catch (error) {
    console.error('Sync entity error:', error);
  }
}

/**
 * Sync a budget period (for budget period mode)
 */
export async function syncBudgetPeriod(
  userId: string,
  householdId: string,
  periodStart: string
): Promise<void> {
  try {
    // Get sync settings
    const syncSettings = await getSyncSettings(userId, householdId);
    if (!syncSettings || syncSettings.syncMode !== 'budget_period') return;

    // For simplicity, trigger a full sync when budget period changes
    await fullSync(userId, householdId);
  } catch (error) {
    console.error('Sync budget period error:', error);
  }
}

/**
 * Check if calendar sync is enabled for a user/household
 */
export async function isSyncEnabled(
  userId: string,
  householdId: string
): Promise<boolean> {
  const connections = await getActiveConnections(userId, householdId);
  return connections.length > 0 && connections.some((c) => c.calendarId);
}

/**
 * Queue a sync operation (non-blocking)
 * This is useful for triggering syncs from API routes without blocking the response
 */
export function queueSync(
  userId: string,
  householdId: string,
  sourceType: SourceType,
  sourceId: string,
  action: 'create' | 'update' | 'delete'
): void {
  // Use setImmediate to run sync in the background
  setImmediate(async () => {
    try {
      await syncEntity(userId, householdId, sourceType, sourceId, action);
    } catch (error) {
      console.error('Background sync error:', error);
    }
  });
}
