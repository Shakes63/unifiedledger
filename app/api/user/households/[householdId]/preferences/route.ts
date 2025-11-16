import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { userHouseholdPreferences } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { isMemberOfHousehold } from '@/lib/household/permissions';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

// Default user-per-household preferences
const DEFAULT_PREFERENCES = {
  dateFormat: 'MM/DD/YYYY' as const,
  numberFormat: 'en-US' as const,
  defaultAccountId: null,
  firstDayOfWeek: 'sunday' as const,
  showCents: true,
  negativeNumberFormat: '-$100',
  defaultTransactionType: 'expense',
  combinedTransferView: true,
  theme: 'dark-mode',
  billRemindersEnabled: true,
  billRemindersChannels: '["push","email"]',
  budgetWarningsEnabled: true,
  budgetWarningsChannels: '["push","email"]',
  budgetExceededEnabled: true,
  budgetExceededChannels: '["push","email"]',
  budgetReviewEnabled: true,
  budgetReviewChannels: '["push","email"]',
  lowBalanceEnabled: true,
  lowBalanceChannels: '["push","email"]',
  savingsMilestonesEnabled: true,
  savingsMilestonesChannels: '["push","email"]',
  debtMilestonesEnabled: true,
  debtMilestonesChannels: '["push","email"]',
  weeklySummariesEnabled: false,
  weeklySummariesChannels: '["email"]',
  monthlySummariesEnabled: true,
  monthlySummariesChannels: '["email"]',
};

/**
 * GET /api/user/households/[householdId]/preferences
 * Get user's preferences for a specific household
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

    // Fetch user's preferences for this household
    const preferences = await db
      .select()
      .from(userHouseholdPreferences)
      .where(
        and(
          eq(userHouseholdPreferences.userId, userId),
          eq(userHouseholdPreferences.householdId, householdId)
        )
      )
      .limit(1);

    // If preferences don't exist, return defaults
    if (!preferences || preferences.length === 0) {
      return Response.json(DEFAULT_PREFERENCES);
    }

    // Return preferences merged with defaults (in case new fields were added)
    return Response.json({
      ...DEFAULT_PREFERENCES,
      ...preferences[0],
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to fetch household preferences:', error);
    return Response.json(
      { error: 'Failed to fetch household preferences' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/households/[householdId]/preferences
 * Update user's preferences for a specific household (partial updates allowed)
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

    const body = await request.json();

    // Remove fields that shouldn't be updated via this endpoint
    const { id, userId: bodyUserId, householdId: bodyHouseholdId, createdAt, ...updateData } = body;

    // Check if user preferences for this household exist
    const existingPreferences = await db
      .select()
      .from(userHouseholdPreferences)
      .where(
        and(
          eq(userHouseholdPreferences.userId, userId),
          eq(userHouseholdPreferences.householdId, householdId)
        )
      )
      .limit(1);

    if (existingPreferences && existingPreferences.length > 0) {
      // Update existing preferences (partial update)
      await db
        .update(userHouseholdPreferences)
        .set({
          ...updateData,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(userHouseholdPreferences.userId, userId),
            eq(userHouseholdPreferences.householdId, householdId)
          )
        );
    } else {
      // Create new preferences record with provided data merged with defaults
      await db.insert(userHouseholdPreferences).values({
        id: uuidv4(),
        userId,
        householdId,
        ...DEFAULT_PREFERENCES,
        ...updateData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Fetch updated preferences
    const updatedPreferences = await db
      .select()
      .from(userHouseholdPreferences)
      .where(
        and(
          eq(userHouseholdPreferences.userId, userId),
          eq(userHouseholdPreferences.householdId, householdId)
        )
      )
      .limit(1);

    return Response.json({
      success: true,
      preferences: updatedPreferences[0],
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to update household preferences:', error);
    return Response.json(
      { error: 'Failed to update household preferences' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user/households/[householdId]/preferences
 * Reset user's preferences for a specific household to defaults
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

    // Check if user preferences for this household exist
    const existingPreferences = await db
      .select()
      .from(userHouseholdPreferences)
      .where(
        and(
          eq(userHouseholdPreferences.userId, userId),
          eq(userHouseholdPreferences.householdId, householdId)
        )
      )
      .limit(1);

    if (existingPreferences && existingPreferences.length > 0) {
      // Reset to defaults
      await db
        .update(userHouseholdPreferences)
        .set({
          ...DEFAULT_PREFERENCES,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(userHouseholdPreferences.userId, userId),
            eq(userHouseholdPreferences.householdId, householdId)
          )
        );
    } else {
      // Create new preferences record with defaults
      await db.insert(userHouseholdPreferences).values({
        id: uuidv4(),
        userId,
        householdId,
        ...DEFAULT_PREFERENCES,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Fetch reset preferences
    const resetPreferences = await db
      .select()
      .from(userHouseholdPreferences)
      .where(
        and(
          eq(userHouseholdPreferences.userId, userId),
          eq(userHouseholdPreferences.householdId, householdId)
        )
      )
      .limit(1);

    return Response.json({
      success: true,
      preferences: resetPreferences[0],
      message: 'Preferences reset to defaults',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to reset household preferences:', error);
    return Response.json(
      { error: 'Failed to reset household preferences' },
      { status: 500 }
    );
  }
}
