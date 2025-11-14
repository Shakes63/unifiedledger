import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { householdSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { isMemberOfHousehold, hasPermission } from '@/lib/household/permissions';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

// Default household settings
const DEFAULT_SETTINGS = {
  currency: 'USD',
  currencySymbol: '$',
  timeFormat: '12h' as const,
  fiscalYearStart: 1,
  defaultBudgetMethod: 'monthly',
  budgetPeriod: 'monthly',
  autoCategorization: true,
  dataRetentionYears: 7,
  autoCleanupEnabled: false,
  cacheStrategy: 'normal',
};

/**
 * GET /api/households/[householdId]/settings
 * Get household-wide settings (available to all members)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ householdId: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await params;

    // Verify user is a member of this household
    if (!(await isMemberOfHousehold(householdId, userId))) {
      return Response.json(
        { error: 'Not a member of this household' },
        { status: 403 }
      );
    }

    // Fetch household settings
    const settings = await db
      .select()
      .from(householdSettings)
      .where(eq(householdSettings.householdId, householdId))
      .limit(1);

    // If settings don't exist, return defaults
    if (!settings || settings.length === 0) {
      return Response.json({ settings: DEFAULT_SETTINGS });
    }

    // Return settings merged with defaults (in case new fields were added)
    return Response.json({
      settings: {
        ...DEFAULT_SETTINGS,
        ...settings[0],
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to fetch household settings:', error);
    return Response.json(
      { error: 'Failed to fetch household settings' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/households/[householdId]/settings
 * Update household settings (requires owner/admin role)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ householdId: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await params;

    // Verify user is a member of this household
    if (!(await isMemberOfHousehold(householdId, userId))) {
      return Response.json(
        { error: 'Not a member of this household' },
        { status: 403 }
      );
    }

    // Check if user has permission to manage settings (owner or admin)
    const canManageSettings = await hasPermission(householdId, userId, 'manage_permissions');
    if (!canManageSettings) {
      return Response.json(
        { error: 'Only household owners and admins can update household settings' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Remove fields that shouldn't be updated via this endpoint
    const { id, householdId: bodyHouseholdId, createdAt, ...updateData } = body;

    // Check if household settings exist
    const existingSettings = await db
      .select()
      .from(householdSettings)
      .where(eq(householdSettings.householdId, householdId))
      .limit(1);

    if (existingSettings && existingSettings.length > 0) {
      // Update existing settings (partial update)
      await db
        .update(householdSettings)
        .set({
          ...updateData,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(householdSettings.householdId, householdId));
    } else {
      // Create new settings record with provided data merged with defaults
      await db.insert(householdSettings).values({
        id: uuidv4(),
        householdId,
        ...DEFAULT_SETTINGS,
        ...updateData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Fetch updated settings
    const updatedSettings = await db
      .select()
      .from(householdSettings)
      .where(eq(householdSettings.householdId, householdId))
      .limit(1);

    return Response.json({
      success: true,
      settings: updatedSettings[0],
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to update household settings:', error);
    return Response.json(
      { error: 'Failed to update household settings' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/households/[householdId]/settings
 * Reset household settings to defaults (requires owner/admin role)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ householdId: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await params;

    // Verify user is a member of this household
    if (!(await isMemberOfHousehold(householdId, userId))) {
      return Response.json(
        { error: 'Not a member of this household' },
        { status: 403 }
      );
    }

    // Check if user has permission to manage settings (owner or admin)
    const canManageSettings = await hasPermission(householdId, userId, 'manage_permissions');
    if (!canManageSettings) {
      return Response.json(
        { error: 'Only household owners and admins can reset household settings' },
        { status: 403 }
      );
    }

    // Check if household settings exist
    const existingSettings = await db
      .select()
      .from(householdSettings)
      .where(eq(householdSettings.householdId, householdId))
      .limit(1);

    if (existingSettings && existingSettings.length > 0) {
      // Reset to defaults
      await db
        .update(householdSettings)
        .set({
          ...DEFAULT_SETTINGS,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(householdSettings.householdId, householdId));
    } else {
      // Create new settings record with defaults
      await db.insert(householdSettings).values({
        id: uuidv4(),
        householdId,
        ...DEFAULT_SETTINGS,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Fetch reset settings
    const resetSettings = await db
      .select()
      .from(householdSettings)
      .where(eq(householdSettings.householdId, householdId))
      .limit(1);

    return Response.json({
      success: true,
      settings: resetSettings[0],
      message: 'Household settings reset to defaults',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to reset household settings:', error);
    return Response.json(
      { error: 'Failed to reset household settings' },
      { status: 500 }
    );
  }
}
