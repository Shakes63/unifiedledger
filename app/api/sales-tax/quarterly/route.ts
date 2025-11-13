import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import {
  getYearlyQuarterlyReports,
  getQuarterlyReport,
  getQuarterlyReportsByAccount,
  getYearlyQuarterlyReportsByAccount,
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

      const summary = {
        year,
        accountId: accountIdParam || undefined,
        totalSales: reports.reduce((sum, r) => sum + r.totalSales, 0),
        totalTax: reports.reduce((sum, r) => sum + r.totalTax, 0),
        totalDue: reports.reduce((sum, r) => sum + r.balanceDue, 0),
        quarters: reports,
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
