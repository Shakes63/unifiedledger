import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { merchants } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
export const dynamic = 'force-dynamic';

// Normalize merchant name for comparison
function normalizeMerchantName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100');

    const userMerchants = await db
      .select()
      .from(merchants)
      .where(eq(merchants.userId, userId))
      .orderBy(desc(merchants.usageCount))
      .limit(limit);

    return Response.json(userMerchants);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Merchant fetch error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create a new merchant
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const { name, categoryId } = body;

    if (!name || name.trim() === '') {
      return Response.json(
        { error: 'Merchant name is required' },
        { status: 400 }
      );
    }

    const { nanoid } = await import('nanoid');
    const normalizedName = normalizeMerchantName(name);
    const merchantId = nanoid();

    const newMerchant = await db
      .insert(merchants)
      .values({
        id: merchantId,
        userId,
        name: name.trim(),
        normalizedName,
        categoryId: categoryId || null,
        usageCount: 1,
        lastUsedAt: new Date().toISOString(),
      });

    const createdMerchant = await db
      .select()
      .from(merchants)
      .where(eq(merchants.id, merchantId))
      .limit(1);

    return Response.json(createdMerchant[0], { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error creating merchant:', error);
    return Response.json(
      { error: 'Failed to create merchant' },
      { status: 500 }
    );
  }
}
