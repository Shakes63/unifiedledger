import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { userSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/onboarding/status
 * Get user's onboarding completion status
 */
export async function GET() {
  try {
    const { userId } = await requireAuth();

    // Fetch user settings
    const settings = await db
      .select({
        onboardingCompleted: userSettings.onboardingCompleted,
      })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    // If user settings don't exist, return false (not completed)
    if (!settings || settings.length === 0) {
      return NextResponse.json({ onboardingCompleted: false });
    }

    return NextResponse.json({
      onboardingCompleted: settings[0].onboardingCompleted ?? false,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to fetch onboarding status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch onboarding status' },
      { status: 500 }
    );
  }
}

