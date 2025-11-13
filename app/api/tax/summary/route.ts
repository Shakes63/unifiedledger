import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getTaxYearSummary, getCurrentTaxYear, estimateQuarterlyTax } from '@/lib/tax/tax-utils';

/**
 * GET /api/tax/summary
 * Returns tax summary for a given year
 * Query params:
 * - year: tax year (default: current year)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth();

    const yearParam = request.nextUrl.searchParams.get('year');
    const year = yearParam ? parseInt(yearParam, 10) : getCurrentTaxYear();

    // Validate year
    if (isNaN(year) || year < 2000 || year > new Date().getFullYear() + 1) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
    }

    const summary = await getTaxYearSummary(userId, year);
    const quarterlyPayment = estimateQuarterlyTax(summary.taxableIncome);

    return NextResponse.json({
      summary,
      estimates: {
        estimatedQuarterlyPayment: quarterlyPayment,
        estimatedAnnualTax: quarterlyPayment * 4,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error generating tax summary:', error);
    return NextResponse.json(
      { error: 'Failed to generate tax summary' },
      { status: 500 }
    );
  }
}
