import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { NextResponse } from 'next/server';
import { exportBudgetToCSV, generateExportFilename, BudgetExportOptions } from '@/lib/budgets/budget-export';

export const dynamic = 'force-dynamic';

/**
 * GET /api/budgets/export
 * Export budget data to CSV
 *
 * Query params:
 * - startMonth (required): YYYY-MM format
 * - endMonth (required): YYYY-MM format
 * - format (optional): 'csv' (default)
 * - includeSummary (optional): 'true' | 'false' (default: true)
 * - includeVariableBills (optional): 'true' | 'false' (default: true)
 * - categoryTypes (optional): Comma-separated list (e.g., 'income,variable_expense')
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    // Get query parameters
    const url = new URL(request.url);
    const startMonth = url.searchParams.get('startMonth');
    const endMonth = url.searchParams.get('endMonth');
    const format = url.searchParams.get('format') || 'csv';
    const includeSummary = url.searchParams.get('includeSummary') !== 'false';
    const includeVariableBills = url.searchParams.get('includeVariableBills') !== 'false';
    const categoryTypesParam = url.searchParams.get('categoryTypes');

    // Validate required parameters
    if (!startMonth || !endMonth) {
      return NextResponse.json(
        { error: 'Both startMonth and endMonth are required (format: YYYY-MM)' },
        { status: 400 }
      );
    }

    // Validate month format (YYYY-MM)
    const monthRegex = /^\d{4}-\d{2}$/;
    if (!monthRegex.test(startMonth) || !monthRegex.test(endMonth)) {
      return NextResponse.json(
        { error: 'Invalid month format. Use YYYY-MM (e.g., 2025-05)' },
        { status: 400 }
      );
    }

    // Validate date range
    const startDate = new Date(startMonth + '-01');
    const endDate = new Date(endMonth + '-01');

    if (startDate > endDate) {
      return NextResponse.json(
        { error: 'Start month cannot be after end month' },
        { status: 400 }
      );
    }

    // Calculate month difference (max 12 months)
    const monthDiff =
      (endDate.getFullYear() - startDate.getFullYear()) * 12 +
      (endDate.getMonth() - startDate.getMonth());

    if (monthDiff > 11) {
      return NextResponse.json(
        { error: 'Cannot export more than 12 months at a time' },
        { status: 400 }
      );
    }

    // Parse category types
    let categoryTypes: Array<'income' | 'expense' | 'savings'> | undefined;

    if (categoryTypesParam) {
      const types = categoryTypesParam.split(',').map(t => t.trim());
      const validTypes = ['income', 'expense', 'savings'];

      // Validate all types
      for (const type of types) {
        if (!validTypes.includes(type)) {
          return NextResponse.json(
            { error: `Invalid category type: ${type}. Valid types: ${validTypes.join(', ')}` },
            { status: 400 }
          );
        }
      }

      categoryTypes = types as Array<'income' | 'expense' | 'savings'>;
    }

    // Only CSV format is supported for now
    if (format !== 'csv') {
      return NextResponse.json(
        { error: 'Only CSV format is supported' },
        { status: 400 }
      );
    }

    // Prepare export options
    const options: BudgetExportOptions = {
      startMonth,
      endMonth,
      includeSummary,
      includeVariableBills,
      categoryTypes,
    };

    // Generate CSV
    const csv = await exportBudgetToCSV(userId, householdId, options);

    // Generate filename
    const filename = generateExportFilename(options);

    // Return CSV as downloadable file
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error exporting budget:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to export budget data' },
      { status: 500 }
    );
  }
}
