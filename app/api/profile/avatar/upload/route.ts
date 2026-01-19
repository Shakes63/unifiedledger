import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { user } from '@/auth-schema';
import { eq } from 'drizzle-orm';

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

    // Store directly in database
    await db
      .update(user)
      .set({
        image: dataUrl,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

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
