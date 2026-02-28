import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import {
  estimateQuarterlyTax,
  getCurrentTaxYear,
  getTaxYearSummary,
  type TaxDeductionTypeFilter,
} from '@/lib/tax/tax-utils';
import {
  generateTaxPdfArrayBuffer,
  getTaxPdfFilename,
  type TaxExportData,
} from '@/lib/tax/tax-pdf-export';

/**
 * GET /api/tax/export/pdf
 * Returns a PDF file for the tax dashboard export.
 * Query params:
 * - year: tax year (default: current year)
 * - type: deduction type filter ('all' | 'business' | 'personal', default: 'all')
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);
    if (!householdId) {
      return NextResponse.json({ error: 'Household ID is required' }, { status: 400 });
    }

    const url = new URL(request.url);
    const yearParam = url.searchParams.get('year');
    const typeParam = url.searchParams.get('type');

    const year = yearParam ? parseInt(yearParam, 10) : getCurrentTaxYear();

    const validTypes: TaxDeductionTypeFilter[] = ['all', 'business', 'personal'];
    const typeFilter: TaxDeductionTypeFilter =
      typeParam && validTypes.includes(typeParam as TaxDeductionTypeFilter)
        ? (typeParam as TaxDeductionTypeFilter)
        : 'all';

    if (isNaN(year) || year < 2000 || year > new Date().getFullYear() + 1) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
    }

    const summary = await getTaxYearSummary(userId, householdId, year, typeFilter);

    if (!summary.byCategory || summary.byCategory.length === 0) {
      return NextResponse.json({ error: 'No tax data available to export' }, { status: 400 });
    }

    const quarterlyPayment = estimateQuarterlyTax(summary.taxableIncome);

    const exportData: TaxExportData = {
      year: summary.year,
      totalIncome: summary.totalIncome,
      totalDeductions: summary.totalDeductions,
      businessDeductions: summary.businessDeductions,
      personalDeductions: summary.personalDeductions,
      taxableIncome: summary.taxableIncome,
      estimatedQuarterlyPayment: quarterlyPayment,
      estimatedAnnualTax: quarterlyPayment * 4,
      categories: summary.byCategory,
      filterType: typeFilter,
    };

    const pdfBuffer = generateTaxPdfArrayBuffer(exportData);
    const filename = getTaxPdfFilename(exportData.year, exportData.filterType);

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    console.error('Error generating tax PDF export:', error);
    return NextResponse.json({ error: 'Failed to generate tax PDF export' }, { status: 500 });
  }
}
