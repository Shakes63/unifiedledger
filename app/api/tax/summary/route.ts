import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { 
  getTaxYearSummary, 
  getCurrentTaxYear, 
  estimateQuarterlyTax,
  TaxDeductionTypeFilter 
} from '@/lib/tax/tax-utils';

/**
 * GET /api/tax/summary
 * Returns tax summary for a given year
 * Query params:
 * - year: tax year (default: current year)
 * - type: deduction type filter ('all' | 'business' | 'personal', default: 'all')
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth();
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);
    if (!householdId) {
      return NextResponse.json({ error: 'Household ID is required' }, { status: 400 });
    }

    const yearParam = request.nextUrl.searchParams.get('year');
    const typeParam = request.nextUrl.searchParams.get('type');
    
    const year = yearParam ? parseInt(yearParam, 10) : getCurrentTaxYear();
    
    // Validate type filter
    const validTypes: TaxDeductionTypeFilter[] = ['all', 'business', 'personal'];
    const typeFilter: TaxDeductionTypeFilter = 
      typeParam && validTypes.includes(typeParam as TaxDeductionTypeFilter)
        ? (typeParam as TaxDeductionTypeFilter)
        : 'all';

    // Validate year
    if (isNaN(year) || year < 2000 || year > new Date().getFullYear() + 1) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
    }

    const summary = await getTaxYearSummary(userId, householdId, year, typeFilter);
    const quarterlyPayment = estimateQuarterlyTax(summary.taxableIncome);

    return NextResponse.json({
      summary,
      estimates: {
        estimatedQuarterlyPayment: quarterlyPayment,
        estimatedAnnualTax: quarterlyPayment * 4,
      },
      filter: {
        year,
        type: typeFilter,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error generating tax summary:', error);
    return NextResponse.json(
      { error: 'Failed to generate tax summary' },
      { status: 500 }
    );
  }
}
