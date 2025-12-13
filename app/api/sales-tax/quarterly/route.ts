import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import {
  getYearlyQuarterlyReports,
  getQuarterlyReport,
  getQuarterlyReportsByAccount,
  getYearlyQuarterlyReportsByAccount,
  updateQuarterlyFilingStatus,
  getFullSalesTaxSettings,
  calculateTaxBreakdown,
} from '@/lib/sales-tax/sales-tax-utils';

/**
 * GET /api/sales-tax/quarterly
 * Returns quarterly sales tax reports
 * Query params:
 * - year: tax year (default: current year)
 * - quarter: specific quarter (optional, 1-4)
 * - accountId: specific business account (optional, for account-specific reporting)
 * - byAccount: if true, groups reports by business account (default: false)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth();

    const yearParam = request.nextUrl.searchParams.get('year');
    const quarterParam = request.nextUrl.searchParams.get('quarter');
    const accountIdParam = request.nextUrl.searchParams.get('accountId');
    const byAccountParam = request.nextUrl.searchParams.get('byAccount') === 'true';

    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

    // Validate year
    if (isNaN(year) || year < 2000 || year > new Date().getFullYear() + 1) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
    }

    if (byAccountParam && !quarterParam) {
      // Get all quarters grouped by account
      const reportsByAccount = await getYearlyQuarterlyReportsByAccount(userId, year);

      const summary = {
        year,
        byAccount: true,
        accounts: reportsByAccount.map((account) => ({
          accountId: account.accountId,
          accountName: account.accountName,
          totalSales: account.quarters.reduce((sum, r) => sum + r.totalSales, 0),
          totalTax: account.quarters.reduce((sum, r) => sum + r.totalTax, 0),
          totalDue: account.quarters.reduce((sum, r) => sum + r.balanceDue, 0),
          quarters: account.quarters,
        })),
      };

      return NextResponse.json(summary);
    } else if (byAccountParam && quarterParam) {
      // Get specific quarter grouped by account
      const quarter = parseInt(quarterParam, 10);

      if (isNaN(quarter) || quarter < 1 || quarter > 4) {
        return NextResponse.json({ error: 'Invalid quarter' }, { status: 400 });
      }

      const reportsByAccount = await getQuarterlyReportsByAccount(userId, year, quarter);

      return NextResponse.json({
        year,
        quarter,
        byAccount: true,
        accounts: reportsByAccount.map((account) => ({
          accountId: account.accountId,
          accountName: account.accountName,
          report: account.report,
        })),
      });
    } else if (quarterParam) {
      // Get specific quarter (optionally filtered by account)
      const quarter = parseInt(quarterParam, 10);

      if (isNaN(quarter) || quarter < 1 || quarter > 4) {
        return NextResponse.json({ error: 'Invalid quarter' }, { status: 400 });
      }

      const report = await getQuarterlyReport(userId, year, quarter, accountIdParam || undefined);

      return NextResponse.json({
        report,
      });
    } else {
      // Get all quarters for the year (optionally filtered by account)
      const reports = await getYearlyQuarterlyReports(userId, year, accountIdParam || undefined);

      // Get settings for tax breakdown calculation
      const settings = await getFullSalesTaxSettings(userId);

      // Calculate total amounts
      const totalSales = reports.reduce((sum, r) => sum + r.totalSales, 0);
      const totalTax = reports.reduce((sum, r) => sum + r.totalTax, 0);
      const totalDue = reports.reduce((sum, r) => sum + r.balanceDue, 0);

      // Calculate overall tax breakdown
      const overallTaxBreakdown = settings
        ? calculateTaxBreakdown(totalSales, settings)
        : null;

      // Add tax breakdown to each quarter's report
      const quartersWithBreakdown = reports.map((r) => ({
        ...r,
        taxBreakdown: settings ? calculateTaxBreakdown(r.totalSales, settings) : null,
      }));

      const summary = {
        year,
        accountId: accountIdParam || undefined,
        totalSales,
        totalTax,
        totalDue,
        taxBreakdown: overallTaxBreakdown,
        quarters: quartersWithBreakdown,
      };

      return NextResponse.json(summary);
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error getting quarterly reports:', error);
    return NextResponse.json(
      { error: 'Failed to get quarterly reports' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/sales-tax/quarterly
 * Update quarterly filing status
 * Body: { year: number, quarter: number, status: string, notes?: string }
 */
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();

    const { year, quarter, status, notes } = body;

    // Validate required fields
    if (!year || !quarter || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: year, quarter, status' },
        { status: 400 }
      );
    }

    // Validate year
    const yearNum = typeof year === 'string' ? parseInt(year, 10) : year;
    if (isNaN(yearNum) || yearNum < 2000 || yearNum > new Date().getFullYear() + 1) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
    }

    // Validate quarter
    const quarterNum = typeof quarter === 'string' ? parseInt(quarter, 10) : quarter;
    if (isNaN(quarterNum) || quarterNum < 1 || quarterNum > 4) {
      return NextResponse.json({ error: 'Invalid quarter' }, { status: 400 });
    }

    // Validate status
    const validStatuses = ['not_due', 'pending', 'submitted', 'accepted', 'rejected'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    await updateQuarterlyFilingStatus(
      userId,
      yearNum,
      quarterNum,
      status as 'not_due' | 'pending' | 'submitted' | 'accepted' | 'rejected',
      notes
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error updating filing status:', error);
    return NextResponse.json(
      { error: 'Failed to update filing status' },
      { status: 500 }
    );
  }
}
