import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { merchants } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
export const dynamic = 'force-dynamic';

// Normalize merchant name for comparison
function normalizeMerchantName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    // Get and validate household
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);

    // TypeScript: householdId is guaranteed to be non-null after requireHouseholdAuth
    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100');

    const userMerchants = await db
      .select()
      .from(merchants)
      .where(
        and(
          eq(merchants.userId, userId),
          eq(merchants.householdId, householdId)
        )
      )
      .orderBy(desc(merchants.usageCount))
      .limit(limit);

    return Response.json(userMerchants);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
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

    // Get and validate household
    const householdId = getHouseholdIdFromRequest(request, body);
    await requireHouseholdAuth(userId, householdId);

    // TypeScript: householdId is guaranteed to be non-null after requireHouseholdAuth
    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    const { name, categoryId } = body;

    if (!name || name.trim() === '') {
      return Response.json(
        { error: 'Merchant name is required' },
        { status: 400 }
      );
    }

    const normalizedName = normalizeMerchantName(name);

    // Check if merchant with same normalized name exists in household
    const existing = await db
      .select()
      .from(merchants)
      .where(
        and(
          eq(merchants.userId, userId),
          eq(merchants.householdId, householdId),
          eq(merchants.normalizedName, normalizedName)
        )
      )
      .limit(1);

    if (existing && existing.length > 0) {
      return Response.json(
        { error: 'Merchant with this name already exists in household' },
        { status: 400 }
      );
    }

    const { nanoid } = await import('nanoid');
    const merchantId = nanoid();

    const newMerchant = await db
      .insert(merchants)
      .values({
        id: merchantId,
        userId,
        householdId,
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
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Error creating merchant:', error);
    return Response.json(
      { error: 'Failed to create merchant' },
      { status: 500 }
    );
  }
}
