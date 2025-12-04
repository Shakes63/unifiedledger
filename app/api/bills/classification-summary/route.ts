import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bills, billInstances } from '@/lib/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { CLASSIFICATION_META, type BillClassification } from '@/lib/bills/bill-classification';
import { addDays, startOfDay } from 'date-fns';
import { auth } from '@/auth';

interface ClassificationSummaryItem {
  classification: string;
  label: string;
  count: number;
  totalMonthly: number;
  upcomingCount: number;
  upcomingAmount: number;
  color: string;
}

interface ClassificationSummaryResponse {
  data: ClassificationSummaryItem[];
  totals: {
    totalCount: number;
    totalMonthly: number;
    totalUpcomingCount: number;
    totalUpcomingAmount: number;
  };
}

// Helper to normalize amounts to monthly
function normalizeToMonthly(amount: number, frequency: string): number {
  switch (frequency) {
    case 'weekly':
      return amount * 4.33; // Approx weeks per month
    case 'biweekly':
      return amount * 2.17; // Approx bi-weeks per month
    case 'monthly':
      return amount;
    case 'quarterly':
      return amount / 3;
    case 'semi-annual':
      return amount / 6;
    case 'annual':
      return amount / 12;
    case 'one-time':
      return 0; // One-time bills don't contribute to monthly
    default:
      return amount;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get and verify household
    const householdId = getHouseholdIdFromRequest(request);
    if (!householdId) {
      return NextResponse.json({ error: 'Household ID required' }, { status: 400 });
    }

    await requireHouseholdAuth(session.user.id, householdId);

    // Get all active bills for the household
    const activeBills = await db
      .select({
        id: bills.id,
        expectedAmount: bills.expectedAmount,
        frequency: bills.frequency,
        billType: bills.billType,
        billClassification: bills.billClassification,
      })
      .from(bills)
      .where(
        and(
          eq(bills.householdId, householdId),
          eq(bills.isActive, true)
        )
      );

    // Get upcoming bill instances (next 30 days)
    const today = startOfDay(new Date());
    const thirtyDaysFromNow = addDays(today, 30);

    const upcomingInstances = await db
      .select({
        billId: billInstances.billId,
        expectedAmount: billInstances.expectedAmount,
        status: billInstances.status,
      })
      .from(billInstances)
      .innerJoin(bills, eq(billInstances.billId, bills.id))
      .where(
        and(
          eq(bills.householdId, householdId),
          eq(billInstances.status, 'pending'),
          gte(billInstances.dueDate, today.toISOString().split('T')[0]),
          lte(billInstances.dueDate, thirtyDaysFromNow.toISOString().split('T')[0])
        )
      );

    // Create a map of bill IDs to their classification
    const billClassificationMap = new Map<string, BillClassification>();
    activeBills.forEach((bill) => {
      billClassificationMap.set(bill.id, (bill.billClassification as BillClassification) || 'other');
    });

    // Calculate summary by classification
    const summaryMap = new Map<BillClassification, ClassificationSummaryItem>();

    // Initialize all classifications
    const allClassifications: BillClassification[] = [
      'subscription',
      'utility',
      'housing',
      'insurance',
      'loan_payment',
      'membership',
      'service',
      'other',
    ];

    allClassifications.forEach((classification) => {
      summaryMap.set(classification, {
        classification,
        label: CLASSIFICATION_META[classification].label,
        count: 0,
        totalMonthly: 0,
        upcomingCount: 0,
        upcomingAmount: 0,
        color: CLASSIFICATION_META[classification].color,
      });
    });

    // Count bills and calculate monthly totals
    activeBills.forEach((bill) => {
      // Only count expense bills
      if (bill.billType === 'income') return;

      const classification = (bill.billClassification as BillClassification) || 'other';
      const summary = summaryMap.get(classification)!;
      summary.count += 1;
      summary.totalMonthly += normalizeToMonthly(bill.expectedAmount, bill.frequency || 'monthly');
    });

    // Count upcoming instances
    upcomingInstances.forEach((instance) => {
      const classification = billClassificationMap.get(instance.billId) || 'other';
      const summary = summaryMap.get(classification)!;
      summary.upcomingCount += 1;
      summary.upcomingAmount += instance.expectedAmount;
    });

    // Convert to array and filter out empty classifications
    const data = Array.from(summaryMap.values()).filter((item) => item.count > 0 || item.upcomingCount > 0);

    // Sort by monthly total (descending)
    data.sort((a, b) => b.totalMonthly - a.totalMonthly);

    // Calculate totals
    const totals = {
      totalCount: data.reduce((sum, item) => sum + item.count, 0),
      totalMonthly: data.reduce((sum, item) => sum + item.totalMonthly, 0),
      totalUpcomingCount: data.reduce((sum, item) => sum + item.upcomingCount, 0),
      totalUpcomingAmount: data.reduce((sum, item) => sum + item.upcomingAmount, 0),
    };

    return NextResponse.json({
      data,
      totals,
    } as ClassificationSummaryResponse);
  } catch (error) {
    console.error('Error fetching classification summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch classification summary' },
      { status: 500 }
    );
  }
}

