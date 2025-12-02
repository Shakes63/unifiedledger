/**
 * Tax Categories API
 * GET - List all tax categories (with optional seeding)
 * POST - Seed tax categories (idempotent)
 */

import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { taxCategories } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { seedTaxCategories } from '@/lib/tax/seed-tax-categories';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tax/categories
 * Returns all active tax categories grouped by form type
 */
export async function GET() {
  try {
    // Auth check
    await requireAuth();

    // Fetch all active tax categories
    const categories = await db
      .select()
      .from(taxCategories)
      .where(eq(taxCategories.isActive, true))
      .orderBy(asc(taxCategories.formType), asc(taxCategories.sortOrder));

    // Group by form type for easier UI rendering
    const grouped: Record<
      string,
      Array<{
        id: string;
        name: string;
        description: string | null;
        formType: string;
        lineNumber: string | null;
        category: string;
        deductible: boolean | null;
      }>
    > = {};

    for (const cat of categories) {
      const formType = cat.formType;
      if (!grouped[formType]) {
        grouped[formType] = [];
      }
      grouped[formType].push({
        id: cat.id,
        name: cat.name,
        description: cat.description,
        formType: cat.formType,
        lineNumber: cat.lineNumber,
        category: cat.category,
        deductible: cat.deductible,
      });
    }

    // Format labels for form types
    const formTypeLabels: Record<string, string> = {
      schedule_c: 'Schedule C (Business)',
      schedule_a: 'Schedule A (Itemized)',
      schedule_d: 'Schedule D (Capital Gains)',
      schedule_e: 'Schedule E (Rental)',
      form_1040: 'Form 1040 (General)',
      other: 'Other',
    };

    return Response.json({
      data: categories,
      grouped,
      formTypeLabels,
      total: categories.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching tax categories:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/tax/categories
 * Seeds standard tax categories (idempotent - skips existing)
 */
export async function POST() {
  try {
    // Auth check
    await requireAuth();

    // Seed tax categories
    const result = await seedTaxCategories();

    return Response.json({
      message: 'Tax categories seeded successfully',
      created: result.created,
      skipped: result.skipped,
      total: result.categories.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error seeding tax categories:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

