import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { salesTaxSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import Decimal from 'decimal.js';

/**
 * GET /api/sales-tax/settings
 * Returns user's sales tax settings including multi-level rates
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
      // Return defaults with multi-level rates
      return NextResponse.json({
        defaultRate: 0,
        stateRate: 0,
        countyRate: 0,
        cityRate: 0,
        specialDistrictRate: 0,
        stateName: '',
        countyName: '',
        cityName: '',
        specialDistrictName: '',
        jurisdiction: '',
        filingFrequency: 'quarterly',
        enableTracking: true,
      });
    }

    const s = settings[0];
    // Calculate total rate from individual rates
    const totalRate = new Decimal(s.stateRate || 0)
      .plus(s.countyRate || 0)
      .plus(s.cityRate || 0)
      .plus(s.specialDistrictRate || 0)
      .toNumber();

    return NextResponse.json({
      ...s,
      // Ensure computed defaultRate reflects multi-level total
      defaultRate: totalRate > 0 ? totalRate : s.defaultRate,
      stateRate: s.stateRate || 0,
      countyRate: s.countyRate || 0,
      cityRate: s.cityRate || 0,
      specialDistrictRate: s.specialDistrictRate || 0,
      stateName: s.stateName || '',
      countyName: s.countyName || '',
      cityName: s.cityName || '',
      specialDistrictName: s.specialDistrictName || '',
    });
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
 * Validate a tax rate value (0-100)
 */
function validateRate(rate: unknown, fieldName: string): number {
  const numRate = typeof rate === 'number' ? rate : 0;
  if (numRate < 0 || numRate > 100) {
    throw new Error(`${fieldName} must be between 0 and 100`);
  }
  return numRate;
}

/**
 * POST /api/sales-tax/settings
 * Create or update sales tax settings with multi-level rates
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const {
      // Legacy single rate (for backward compatibility)
      defaultRate,
      // Multi-level rates
      stateRate,
      countyRate,
      cityRate,
      specialDistrictRate,
      // Jurisdiction names
      stateName,
      countyName,
      cityName,
      specialDistrictName,
      // Other settings
      jurisdiction,
      filingFrequency,
    } = body;

    // Validate multi-level rates
    let validatedStateRate: number;
    let validatedCountyRate: number;
    let validatedCityRate: number;
    let validatedSpecialRate: number;

    try {
      validatedStateRate = validateRate(stateRate, 'State rate');
      validatedCountyRate = validateRate(countyRate, 'County rate');
      validatedCityRate = validateRate(cityRate, 'City rate');
      validatedSpecialRate = validateRate(specialDistrictRate, 'Special district rate');
    } catch (validationError) {
      if (validationError instanceof Error) {
        return NextResponse.json({ error: validationError.message }, { status: 400 });
      }
      return NextResponse.json({ error: 'Invalid tax rate' }, { status: 400 });
    }

    // Calculate total rate from individual rates
    const computedDefaultRate = new Decimal(validatedStateRate)
      .plus(validatedCountyRate)
      .plus(validatedCityRate)
      .plus(validatedSpecialRate)
      .toNumber();

    // Use computed total, or legacy defaultRate if no multi-level rates provided
    const finalDefaultRate =
      computedDefaultRate > 0
        ? computedDefaultRate
        : typeof defaultRate === 'number'
          ? defaultRate
          : 0;

    // Check if settings exist
    const existing = await db
      .select()
      .from(salesTaxSettings)
      .where(eq(salesTaxSettings.userId, userId))
      .limit(1);

    const now = new Date().toISOString();

    if (existing.length === 0) {
      // Create new settings
      const newSettings = {
        id: uuidv4(),
        userId,
        defaultRate: finalDefaultRate,
        stateRate: validatedStateRate,
        countyRate: validatedCountyRate,
        cityRate: validatedCityRate,
        specialDistrictRate: validatedSpecialRate,
        stateName: stateName || null,
        countyName: countyName || null,
        cityName: cityName || null,
        specialDistrictName: specialDistrictName || null,
        jurisdiction: jurisdiction || null,
        fiscalYearStart: null,
        filingFrequency:
          (filingFrequency as 'monthly' | 'quarterly' | 'annually') || 'quarterly',
        enableTracking: true,
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(salesTaxSettings).values(newSettings);
      return NextResponse.json(newSettings, { status: 201 });
    } else {
      // Update existing settings
      const updateData = {
        defaultRate: finalDefaultRate,
        stateRate: validatedStateRate,
        countyRate: validatedCountyRate,
        cityRate: validatedCityRate,
        specialDistrictRate: validatedSpecialRate,
        stateName: stateName !== undefined ? stateName : existing[0].stateName,
        countyName: countyName !== undefined ? countyName : existing[0].countyName,
        cityName: cityName !== undefined ? cityName : existing[0].cityName,
        specialDistrictName:
          specialDistrictName !== undefined
            ? specialDistrictName
            : existing[0].specialDistrictName,
        jurisdiction: jurisdiction !== undefined ? jurisdiction : existing[0].jurisdiction,
        filingFrequency:
          (filingFrequency as 'monthly' | 'quarterly' | 'annually') ||
          existing[0].filingFrequency,
        updatedAt: now,
      };

      await db
        .update(salesTaxSettings)
        .set(updateData)
        .where(eq(salesTaxSettings.userId, userId));

      return NextResponse.json({ ...existing[0], ...updateData });
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
