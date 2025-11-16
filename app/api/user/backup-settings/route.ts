import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { backupSettings } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

// Default backup settings values
const DEFAULT_BACKUP_SETTINGS = {
  enabled: false,
  frequency: 'weekly' as const,
  format: 'json' as const,
  retentionCount: 10,
  emailBackups: false,
  lastBackupAt: null,
  nextBackupAt: null,
};

/**
 * Calculate next backup time based on frequency
 */
function calculateNextBackupAt(frequency: 'daily' | 'weekly' | 'monthly'): string {
  const now = new Date();
  let nextBackup: Date;

  switch (frequency) {
    case 'daily':
      nextBackup = new Date(now);
      nextBackup.setDate(nextBackup.getDate() + 1);
      nextBackup.setHours(2, 0, 0, 0); // 2 AM
      break;
    case 'weekly':
      nextBackup = new Date(now);
      const daysUntilNextWeek = (7 - nextBackup.getDay() + 1) % 7 || 7; // Next Monday
      nextBackup.setDate(nextBackup.getDate() + daysUntilNextWeek);
      nextBackup.setHours(2, 0, 0, 0); // 2 AM
      break;
    case 'monthly':
      nextBackup = new Date(now);
      nextBackup.setMonth(nextBackup.getMonth() + 1);
      nextBackup.setDate(1); // First day of next month
      nextBackup.setHours(2, 0, 0, 0); // 2 AM
      break;
  }

  return nextBackup.toISOString();
}

/**
 * GET /api/user/backup-settings
 * Get user's backup settings for a household (creates defaults if not exists)
 * Requires householdId in query parameter or x-household-id header
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    // Fetch backup settings for this household
    const settings = await db
      .select()
      .from(backupSettings)
      .where(
        and(
          eq(backupSettings.userId, userId),
          eq(backupSettings.householdId, householdId)
        )
      )
      .limit(1);

    // If backup settings don't exist, return defaults
    if (!settings || settings.length === 0) {
      return NextResponse.json({ settings: DEFAULT_BACKUP_SETTINGS });
    }

    // Return settings merged with defaults (in case new fields were added)
    return NextResponse.json({
      settings: {
        ...DEFAULT_BACKUP_SETTINGS,
        ...settings[0],
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Failed to fetch backup settings:', error);
    return NextResponse.json({ error: 'Failed to fetch backup settings' }, { status: 500 });
  }
}

/**
 * POST /api/user/backup-settings
 * Update user's backup settings for a household (partial updates allowed)
 * Requires householdId in request body
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const { householdId } = await getAndVerifyHousehold(request, userId, body);

    // Remove fields that shouldn't be updated via this endpoint
    const { id, userId: bodyUserId, householdId: bodyHouseholdId, createdAt, ...updateData } = body;

    // Validate frequency if provided
    if ('frequency' in updateData) {
      const validFrequencies = ['daily', 'weekly', 'monthly'];
      if (!validFrequencies.includes(updateData.frequency)) {
        return NextResponse.json(
          { error: `Invalid frequency. Must be one of: ${validFrequencies.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Validate format if provided
    if ('format' in updateData) {
      const validFormats = ['json', 'csv'];
      if (!validFormats.includes(updateData.format)) {
        return NextResponse.json(
          { error: `Invalid format. Must be one of: ${validFormats.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Validate retention count if provided
    if ('retentionCount' in updateData) {
      const retention = updateData.retentionCount;
      if (typeof retention !== 'number' || retention < 1 || retention > 100) {
        return NextResponse.json(
          { error: 'Retention count must be between 1 and 100' },
          { status: 400 }
        );
      }
    }

    // Calculate nextBackupAt if frequency changed or enabled is being set to true
    const currentSettings = await db
      .select()
      .from(backupSettings)
      .where(
        and(
          eq(backupSettings.userId, userId),
          eq(backupSettings.householdId, householdId)
        )
      )
      .limit(1);

    const frequency = updateData.frequency || currentSettings[0]?.frequency || 'weekly';
    const enabled = updateData.enabled !== undefined ? updateData.enabled : currentSettings[0]?.enabled || false;

    // If enabling backups or frequency changed, calculate next backup time
    if (enabled && ('frequency' in updateData || 'enabled' in updateData)) {
      updateData.nextBackupAt = calculateNextBackupAt(frequency);
    } else if (!enabled && 'enabled' in updateData) {
      // If disabling backups, clear next backup time
      updateData.nextBackupAt = null;
    }

    // Check if backup settings exist for this household
    const existingSettings = await db
      .select()
      .from(backupSettings)
      .where(
        and(
          eq(backupSettings.userId, userId),
          eq(backupSettings.householdId, householdId)
        )
      )
      .limit(1);

    if (existingSettings && existingSettings.length > 0) {
      // Update existing settings (partial update)
      await db
        .update(backupSettings)
        .set({
          ...updateData,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(backupSettings.userId, userId),
            eq(backupSettings.householdId, householdId)
          )
        );
    } else {
      // Create new settings record with provided data merged with defaults
      const nextBackupAt = enabled ? calculateNextBackupAt(frequency) : null;
      await db.insert(backupSettings).values({
        id: uuidv4(),
        userId,
        householdId,
        ...DEFAULT_BACKUP_SETTINGS,
        ...updateData,
        nextBackupAt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Fetch updated settings
    const updatedSettings = await db
      .select()
      .from(backupSettings)
      .where(
        and(
          eq(backupSettings.userId, userId),
          eq(backupSettings.householdId, householdId)
        )
      )
      .limit(1);

    return NextResponse.json({
      success: true,
      settings: updatedSettings[0],
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Failed to update backup settings:', error);
    return NextResponse.json({ error: 'Failed to update backup settings' }, { status: 500 });
  }
}

