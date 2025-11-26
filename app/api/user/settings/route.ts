import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { userSettings, importTemplates } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { clearTimeoutCache } from '@/lib/session-utils';

export const dynamic = 'force-dynamic';

// Default settings values
const DEFAULT_SETTINGS = {
  displayName: null,
  avatarUrl: null,
  bio: null,
  timezone: 'America/New_York',
  currency: 'USD',
  currencySymbol: '$',
  dateFormat: 'MM/DD/YYYY' as const,
  numberFormat: 'en-US' as const,
  firstDayOfWeek: 'sunday' as const,
  timeFormat: '12h' as const,
  defaultHouseholdId: null,
  profileVisibility: 'household' as const,
  showActivity: true,
  allowAnalytics: true,
  reduceMotion: false,
  highContrast: false,
  textSize: 'medium' as const,
  theme: 'dark-mode',
  fiscalYearStart: 1,
  defaultAccountId: null,
  defaultBudgetMethod: 'monthly',
  budgetPeriod: 'monthly',
  showCents: true,
  negativeNumberFormat: '-$100',
  defaultTransactionType: 'expense',
  autoCategorization: true,
  sessionTimeout: 30,
  dataRetentionYears: 7,
  defaultImportTemplateId: null,
  developerMode: false,
  enableAnimations: true,
  experimentalFeatures: false,
};

/**
 * GET /api/user/settings
 * Get user settings (creates defaults if not exists)
 */
export async function GET() {
  try {
    const { userId } = await requireAuth();

    // Fetch user settings
    const settings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    // If user settings don't exist, return defaults
    if (!settings || settings.length === 0) {
      return NextResponse.json({ settings: DEFAULT_SETTINGS });
    }

    // Return settings merged with defaults (in case new fields were added)
    return NextResponse.json({
      settings: {
        ...DEFAULT_SETTINGS,
        ...settings[0],
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to fetch settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

/**
 * POST /api/user/settings
 * Update user settings (partial updates allowed)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();

    // Remove fields that shouldn't be updated via this endpoint
    const { id, userId: bodyUserId, createdAt, ...updateData } = body;

    // Validate session timeout if provided
    if ('sessionTimeout' in updateData) {
      const timeout = updateData.sessionTimeout;
      // Must be 0 (disabled) or >= 15 minutes
      if (typeof timeout !== 'number' || (timeout !== 0 && timeout < 15)) {
        return NextResponse.json(
          { error: 'Session timeout must be 0 (disabled) or at least 15 minutes' },
          { status: 400 }
        );
      }
    }

    // Validate default import template if provided
    if ('defaultImportTemplateId' in updateData && updateData.defaultImportTemplateId !== null) {
      const template = await db
        .select()
        .from(importTemplates)
        .where(
          and(
            eq(importTemplates.id, updateData.defaultImportTemplateId),
            eq(importTemplates.userId, userId)
          )
        )
        .limit(1);

      if (!template || template.length === 0) {
        return NextResponse.json(
          { error: 'Import template not found or does not belong to you' },
          { status: 404 }
        );
      }
    }

    // Check if user settings exist
    const existingSettings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    if (existingSettings && existingSettings.length > 0) {
      // Update existing settings (partial update)
      await db
        .update(userSettings)
        .set({
          ...updateData,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(userSettings.userId, userId));

      // Clear session timeout cache if sessionTimeout was updated
      // This ensures the new value is used immediately instead of waiting for cache TTL
      if ('sessionTimeout' in updateData) {
        clearTimeoutCache(userId);
      }
    } else {
      // Create new settings record with provided data merged with defaults
      await db.insert(userSettings).values({
        id: uuidv4(),
        userId,
        ...DEFAULT_SETTINGS,
        ...updateData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Fetch updated settings
    const updatedSettings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    return NextResponse.json({
      success: true,
      settings: updatedSettings[0],
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to update settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}

/**
 * PATCH /api/user/settings
 * Reset user settings to defaults
 */
export async function PATCH() {
  try {
    const { userId } = await requireAuth();

    // Check if user settings exist
    const existingSettings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    if (existingSettings && existingSettings.length > 0) {
      // Reset to defaults
      await db
        .update(userSettings)
        .set({
          ...DEFAULT_SETTINGS,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(userSettings.userId, userId));
    } else {
      // Create new settings record with defaults
      await db.insert(userSettings).values({
        id: uuidv4(),
        userId,
        ...DEFAULT_SETTINGS,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Fetch reset settings
    const resetSettings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    return NextResponse.json({
      success: true,
      settings: resetSettings[0],
      message: 'Settings reset to defaults',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to reset settings:', error);
    return NextResponse.json({ error: 'Failed to reset settings' }, { status: 500 });
  }
}
