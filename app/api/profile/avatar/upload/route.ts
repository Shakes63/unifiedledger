import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { userSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

// Max data URL size: ~100KB (150x150 JPEG is typically 10-30KB)
const MAX_DATA_URL_SIZE = 100 * 1024;

export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const { dataUrl } = await request.json();

    // Validate data URL format
    if (!dataUrl || typeof dataUrl !== 'string') {
      return Response.json({ error: 'Missing dataUrl' }, { status: 400 });
    }

    if (!dataUrl.startsWith('data:image/')) {
      return Response.json({ error: 'Invalid image data URL' }, { status: 400 });
    }

    if (dataUrl.length > MAX_DATA_URL_SIZE) {
      return Response.json({ error: 'Image too large' }, { status: 400 });
    }

    // Store in userSettings (not user.image to avoid bloating session cookie)
    const existing = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(userSettings)
        .set({ avatarUrl: dataUrl, updatedAt: new Date().toISOString() })
        .where(eq(userSettings.userId, userId));
    } else {
      await db.insert(userSettings).values({
        id: uuidv4(),
        userId,
        avatarUrl: dataUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    return Response.json({
      success: true,
      avatarUrl: dataUrl,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Avatar upload error:', error);
    return Response.json({ error: 'Failed to upload avatar' }, { status: 500 });
  }
}
