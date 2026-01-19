import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { user as betterAuthUser } from '@/auth-schema';
import { userSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/profile
 * Get user profile (name, email from betterAuthUser)
 */
export async function GET() {
  try {
    const { userId } = await requireAuth();

    // Fetch user from Better Auth user table
    const users = await db
      .select({
        id: betterAuthUser.id,
        name: betterAuthUser.name,
        email: betterAuthUser.email,
        emailVerified: betterAuthUser.emailVerified,
        pendingEmail: betterAuthUser.pendingEmail,
        image: betterAuthUser.image,
        imageUpdatedAt: betterAuthUser.imageUpdatedAt,
        createdAt: betterAuthUser.createdAt,
      })
      .from(betterAuthUser)
      .where(eq(betterAuthUser.id, userId))
      .limit(1);

    if (!users || users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = users[0];

    // Also fetch display name and avatar from user settings if available
    const settings = await db
      .select({
        displayName: userSettings.displayName,
        avatarUrl: userSettings.avatarUrl,
        bio: userSettings.bio,
      })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    const profile = {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      pendingEmail: user.pendingEmail,
      image: user.image,
      displayName: settings[0]?.displayName || null,
      avatarUrl: settings[0]?.avatarUrl || null,
      bio: settings[0]?.bio || null,
      createdAt: user.createdAt,
    };

    return NextResponse.json({ profile });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to fetch profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

/**
 * PATCH /api/user/profile
 * Update user profile (name, displayName, bio, avatarUrl)
 */
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const { name, displayName, bio, avatarUrl } = body;

    // Validate at least one field is provided
    if (!name && !displayName && !bio && avatarUrl === undefined) {
      return NextResponse.json(
        { error: 'At least one field (name, displayName, bio, avatarUrl) is required' },
        { status: 400 }
      );
    }

    // Update name in Better Auth user table if provided
    if (name) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({ error: 'Name must be a non-empty string' }, { status: 400 });
      }

      await db
        .update(betterAuthUser)
        .set({
          name: name.trim(),
          updatedAt: new Date(),
        })
        .where(eq(betterAuthUser.id, userId));
    }

    // Update displayName, bio, or avatarUrl in user settings if provided
    if (displayName !== undefined || bio !== undefined || avatarUrl !== undefined) {
      const updateData: Partial<typeof userSettings.$inferInsert> = {
        updatedAt: new Date().toISOString(),
      };

      if (displayName !== undefined) {
        if (displayName !== null && typeof displayName !== 'string') {
          return NextResponse.json(
            { error: 'Display name must be a string or null' },
            { status: 400 }
          );
        }
        updateData.displayName = displayName ? displayName.trim() : null;
      }

      if (bio !== undefined) {
        if (bio !== null && typeof bio !== 'string') {
          return NextResponse.json({ error: 'Bio must be a string or null' }, { status: 400 });
        }
        updateData.bio = bio;
      }

      if (avatarUrl !== undefined) {
        if (avatarUrl !== null && typeof avatarUrl !== 'string') {
          return NextResponse.json(
            { error: 'Avatar URL must be a string or null' },
            { status: 400 }
          );
        }
        updateData.avatarUrl = avatarUrl;
      }

      // Check if user settings exist
      const existingSettings = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1);

      if (existingSettings && existingSettings.length > 0) {
        // Update existing settings
        await db.update(userSettings).set(updateData).where(eq(userSettings.userId, userId));
      } else {
        // Create new settings record with defaults
        const { v4: uuidv4 } = await import('uuid');
        await db.insert(userSettings).values({
          id: uuidv4(),
          userId,
          ...updateData,
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Fetch updated profile
    const updatedUsers = await db
      .select({
        id: betterAuthUser.id,
        name: betterAuthUser.name,
        email: betterAuthUser.email,
        emailVerified: betterAuthUser.emailVerified,
        image: betterAuthUser.image,
        imageUpdatedAt: betterAuthUser.imageUpdatedAt,
        createdAt: betterAuthUser.createdAt,
      })
      .from(betterAuthUser)
      .where(eq(betterAuthUser.id, userId))
      .limit(1);

    const updatedSettings = await db
      .select({
        displayName: userSettings.displayName,
        avatarUrl: userSettings.avatarUrl,
        bio: userSettings.bio,
      })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    const profile = {
      id: updatedUsers[0].id,
      name: updatedUsers[0].name,
      email: updatedUsers[0].email,
      emailVerified: updatedUsers[0].emailVerified,
      image: updatedUsers[0].image,
      displayName: updatedSettings[0]?.displayName || null,
      avatarUrl: updatedSettings[0]?.avatarUrl || null,
      bio: updatedSettings[0]?.bio || null,
      createdAt: updatedUsers[0].createdAt,
    };

    return NextResponse.json({
      success: true,
      profile,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to update profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
