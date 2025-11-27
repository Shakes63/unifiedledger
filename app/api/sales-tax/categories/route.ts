import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { salesTaxCategories } from '@/lib/db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sales-tax/categories
 * Fetch all active sales tax categories for the current user
 */
export async function GET(_request: NextRequest) {
  try {
    const { userId } = await requireAuth();

    // Fetch active tax categories, sorted by default first, then by name
    const categories = await db
      .select()
      .from(salesTaxCategories)
      .where(
        and(
          eq(salesTaxCategories.userId, userId),
          eq(salesTaxCategories.isActive, true)
        )
      )
      .orderBy(
        desc(salesTaxCategories.isDefault),
        asc(salesTaxCategories.name)
      );

    return NextResponse.json({ categories });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to fetch sales tax categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales tax categories' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sales-tax/categories
 * Create a new sales tax category
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const { name, rate, description, isDefault } = body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      );
    }

    if (rate === undefined || typeof rate !== 'number') {
      return NextResponse.json(
        { error: 'Tax rate is required and must be a number' },
        { status: 400 }
      );
    }

    if (rate < 0 || rate > 1) {
      return NextResponse.json(
        { error: 'Tax rate must be between 0 and 1 (e.g., 0.0825 for 8.25%)' },
        { status: 400 }
      );
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await db
        .update(salesTaxCategories)
        .set({ isDefault: false })
        .where(eq(salesTaxCategories.userId, userId));
    }

    // Create new tax category
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(salesTaxCategories).values({
      id,
      userId,
      name: name.trim(),
      rate,
      description: description?.trim() || null,
      isDefault: isDefault || false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // Fetch and return the created category
    const createdCategory = await db
      .select()
      .from(salesTaxCategories)
      .where(eq(salesTaxCategories.id, id))
      .limit(1);

    return NextResponse.json(createdCategory[0], { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to create sales tax category:', error);
    return NextResponse.json(
      { error: 'Failed to create sales tax category' },
      { status: 500 }
    );
  }
}
