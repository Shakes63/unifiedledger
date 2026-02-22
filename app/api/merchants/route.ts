import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { merchants } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { normalizeMerchantName } from '@/lib/merchants/normalize';
export const dynamic = 'force-dynamic';

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
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50'), 1), 1000);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0);
    const query = (url.searchParams.get('q') || '').trim();
    const normalizedQuery = query ? normalizeMerchantName(query) : '';

    // Return all merchants in the household (shared between all members)
    // The requireHouseholdAuth check above ensures the user is a member
    const allHouseholdMerchants = await db
      .select()
      .from(merchants)
      .where(eq(merchants.householdId, householdId))
      .orderBy(desc(merchants.usageCount))
      .limit(1000);

    const filteredMerchants = normalizedQuery
      ? allHouseholdMerchants.filter((merchant) =>
          merchant.normalizedName.includes(normalizedQuery)
        )
      : allHouseholdMerchants;

    const paginatedMerchants = filteredMerchants.slice(offset, offset + limit);

    return Response.json({
      data: paginatedMerchants,
      total: filteredMerchants.length,
      limit,
      offset,
    });
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

    const { name, categoryId, isSalesTaxExempt } = body;

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

    await db
      .insert(merchants)
      .values({
        id: merchantId,
        userId,
        householdId,
        name: name.trim(),
        normalizedName,
        categoryId: categoryId || null,
        isSalesTaxExempt: isSalesTaxExempt || false,
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
