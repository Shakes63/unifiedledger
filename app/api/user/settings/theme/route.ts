import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { userSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { isValidThemeId, isThemeAvailable } from '@/lib/themes/theme-utils';
import { DEFAULT_THEME_ID } from '@/lib/themes/theme-config';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/settings/theme
 * Get user's theme preference
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

    // If user settings don't exist, return default theme
    if (!settings || settings.length === 0) {
      return NextResponse.json({ theme: DEFAULT_THEME_ID });
    }

    // Return theme or default if not set
    const theme = settings[0].theme || DEFAULT_THEME_ID;
    return NextResponse.json({ theme });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to fetch theme:', error);
    return NextResponse.json({ error: 'Failed to fetch theme' }, { status: 500 });
  }
}

/**
 * PUT /api/user/settings/theme
 * Update user's theme preference
 */
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const { theme } = body;

    // Validate theme ID
    if (!theme || typeof theme !== 'string') {
      return NextResponse.json({ error: 'Theme ID is required' }, { status: 400 });
    }

    if (!isValidThemeId(theme)) {
      return NextResponse.json({ error: 'Invalid theme ID' }, { status: 400 });
    }

    if (!isThemeAvailable(theme)) {
      return NextResponse.json({ error: 'Theme is not available' }, { status: 400 });
    }

    // Check if user settings exist
    const existingSettings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    if (existingSettings && existingSettings.length > 0) {
      // Update existing settings
      await db
        .update(userSettings)
        .set({
          theme,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(userSettings.userId, userId));
    } else {
      // Create new settings record
      await db.insert(userSettings).values({
        id: uuidv4(),
        userId,
        theme,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, theme });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to update theme:', error);
    return NextResponse.json({ error: 'Failed to update theme' }, { status: 500 });
  }
}
