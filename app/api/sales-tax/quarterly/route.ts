import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getYearlyQuarterlyReports,
  getQuarterlyReport,
} from '@/lib/sales-tax/sales-tax-utils';

/**
 * GET /api/sales-tax/quarterly
 * Returns quarterly sales tax reports
 * Query params:
 * - year: tax year (default: current year)
 * - quarter: specific quarter (optional, 1-4)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const yearParam = request.nextUrl.searchParams.get('year');
    const quarterParam = request.nextUrl.searchParams.get('quarter');

    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

    // Validate year
    if (isNaN(year) || year < 2000 || year > new Date().getFullYear() + 1) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
    }

    if (quarterParam) {
      // Get specific quarter
      const quarter = parseInt(quarterParam, 10);

      if (isNaN(quarter) || quarter < 1 || quarter > 4) {
        return NextResponse.json({ error: 'Invalid quarter' }, { status: 400 });
      }

      const report = await getQuarterlyReport(userId, year, quarter);

      return NextResponse.json({
        report,
      });
    } else {
      // Get all quarters for the year
      const reports = await getYearlyQuarterlyReports(userId, year);

      const summary = {
        year,
        totalSales: reports.reduce((sum, r) => sum + r.totalSales, 0),
        totalTax: reports.reduce((sum, r) => sum + r.totalTax, 0),
        totalDue: reports.reduce((sum, r) => sum + r.balanceDue, 0),
        quarters: reports,
      };

      return NextResponse.json(summary);
    }
  } catch (error) {
    console.error('Error getting quarterly reports:', error);
    return NextResponse.json(
      { error: 'Failed to get quarterly reports' },
      { status: 500 }
    );
  }
}
