import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { salesTaxSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

/**
 * GET /api/sales-tax/settings
 * Returns user's sales tax settings
 */
export async function GET() {
  try {
    const { userId } = await requireAuth();

    const settings = await db
      .select()
      .from(salesTaxSettings)
      .where(eq(salesTaxSettings.userId, userId))
      .limit(1);

    if (settings.length === 0) {
      // Return defaults
      return NextResponse.json({
        defaultRate: 0,
        jurisdiction: '',
        filingFrequency: 'quarterly',
        enableTracking: true,
      });
    }

    return NextResponse.json(settings[0]);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error getting sales tax settings:', error);
    return NextResponse.json(
      { error: 'Failed to get settings' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sales-tax/settings
 * Create or update sales tax settings
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const { defaultRate, jurisdiction, filingFrequency } = body;

    // Validation
    if (typeof defaultRate !== 'number' || defaultRate < 0 || defaultRate > 100) {
      return NextResponse.json(
        { error: 'Tax rate must be between 0 and 100' },
        { status: 400 }
      );
    }

    // Check if settings exist
    const existing = await db
      .select()
      .from(salesTaxSettings)
      .where(eq(salesTaxSettings.userId, userId))
      .limit(1);

    if (existing.length === 0) {
      // Create new
      const newSettings = {
        id: uuidv4(),
        userId,
        defaultRate,
        jurisdiction: jurisdiction || null,
        fiscalYearStart: null,
        filingFrequency: (filingFrequency as 'monthly' | 'quarterly' | 'annually') || 'quarterly',
        enableTracking: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.insert(salesTaxSettings).values(newSettings);
      return NextResponse.json(newSettings, { status: 201 });
    } else {
      // Update existing
      const updated = {
        ...existing[0],
        defaultRate,
        jurisdiction: jurisdiction !== undefined ? jurisdiction : existing[0].jurisdiction,
        filingFrequency: (filingFrequency as 'monthly' | 'quarterly' | 'annually') || existing[0].filingFrequency,
        updatedAt: new Date().toISOString(),
      };

      await db
        .update(salesTaxSettings)
        .set({
          defaultRate: updated.defaultRate,
          jurisdiction: updated.jurisdiction,
          filingFrequency: updated.filingFrequency,
          updatedAt: updated.updatedAt,
        })
        .where(eq(salesTaxSettings.userId, userId));

      return NextResponse.json(updated);
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error updating sales tax settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
