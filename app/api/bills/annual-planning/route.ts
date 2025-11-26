/**
 * Annual Bill Planning API
 *
 * Provides data for the 12-month annual bill planning grid.
 * Returns non-monthly bills (quarterly, semi-annual, annual, one-time)
 * organized by month with their instances and status.
 */

import { db } from '@/lib/db';
import { bills, billInstances } from '@/lib/db/schema';
import { eq, and, gte, lte, inArray } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';

export const dynamic = 'force-dynamic';

// Non-monthly frequencies that should appear in the annual planning grid
const NON_MONTHLY_FREQUENCIES = ['quarterly', 'semi-annual', 'annual', 'one-time'] as const;

// Month names for convenience
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface MonthData {
  dueDate: number;
  amount: number;
  instanceId: string;
  status: 'pending' | 'paid' | 'overdue' | 'skipped';
  actualAmount?: number;
  paidDate?: string;
}

interface BillWithMonthlyData {
  id: string;
  name: string;
  frequency: string;
  expectedAmount: number;
  isActive: boolean;
  notes?: string;
  monthlyData: Record<string, MonthData | null>;
}

interface MonthlySummary {
  total: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
}

// GET - Fetch annual planning data for a specific year
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const url = new URL(request.url);
    const yearParam = url.searchParams.get('year');
    const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

    // Validate year
    if (isNaN(year) || year < 2000 || year > 2100) {
      return Response.json(
        { error: 'Invalid year parameter' },
        { status: 400 }
      );
    }

    // Define year boundaries
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    // Fetch all non-monthly bills for the household
    const nonMonthlyBills = await db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.userId, userId),
          eq(bills.householdId, householdId),
          eq(bills.isActive, true),
          inArray(bills.frequency, NON_MONTHLY_FREQUENCIES)
        )
      )
      .all();

    // If no bills, return empty data
    if (nonMonthlyBills.length === 0) {
      return Response.json({
        year,
        bills: [],
        summary: {
          totalAnnualAmount: 0,
          monthlyBreakdown: Object.fromEntries(
            Array.from({ length: 12 }, (_, i) => [String(i + 1), createEmptyMonthlySummary()])
          ),
          paidCount: 0,
          pendingCount: 0,
          overdueCount: 0,
          totalInstances: 0,
        },
      });
    }

    // Get bill IDs for instance lookup
    const billIds = nonMonthlyBills.map(b => b.id);

    // Fetch all instances for these bills within the year
    const yearInstances = await db
      .select()
      .from(billInstances)
      .where(
        and(
          eq(billInstances.userId, userId),
          eq(billInstances.householdId, householdId),
          inArray(billInstances.billId, billIds),
          gte(billInstances.dueDate, yearStart),
          lte(billInstances.dueDate, yearEnd)
        )
      )
      .all();

    // Group instances by bill ID
    const instancesByBill = new Map<string, typeof yearInstances>();
    for (const instance of yearInstances) {
      if (!instancesByBill.has(instance.billId)) {
        instancesByBill.set(instance.billId, []);
      }
      instancesByBill.get(instance.billId)!.push(instance);
    }

    // Build the bills with monthly data
    const billsWithMonthlyData: BillWithMonthlyData[] = nonMonthlyBills.map(bill => {
      const monthlyData: Record<string, MonthData | null> = {};
      
      // Initialize all months as null
      for (let i = 1; i <= 12; i++) {
        monthlyData[String(i)] = null;
      }

      // Fill in data from instances
      const billInstances = instancesByBill.get(bill.id) || [];
      for (const instance of billInstances) {
        const dueDate = new Date(instance.dueDate);
        const month = dueDate.getMonth() + 1; // 1-indexed
        const dayOfMonth = dueDate.getDate();

        monthlyData[String(month)] = {
          dueDate: dayOfMonth,
          amount: instance.expectedAmount,
          instanceId: instance.id,
          status: instance.status as 'pending' | 'paid' | 'overdue' | 'skipped',
          actualAmount: instance.actualAmount ?? undefined,
          paidDate: instance.paidDate ?? undefined,
        };
      }

      return {
        id: bill.id,
        name: bill.name,
        frequency: bill.frequency ?? 'annual',
        expectedAmount: bill.expectedAmount,
        isActive: bill.isActive ?? true,
        notes: bill.notes ?? undefined,
        monthlyData,
      };
    });

    // Calculate summary statistics
    const monthlyBreakdown: Record<string, MonthlySummary> = {};
    let totalAnnualAmount = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let overdueCount = 0;

    // Initialize monthly breakdown
    for (let i = 1; i <= 12; i++) {
      monthlyBreakdown[String(i)] = createEmptyMonthlySummary();
    }

    // Calculate from all instances
    for (const instance of yearInstances) {
      const dueDate = new Date(instance.dueDate);
      const month = dueDate.getMonth() + 1;
      const monthKey = String(month);

      monthlyBreakdown[monthKey].total += instance.expectedAmount;
      totalAnnualAmount += instance.expectedAmount;

      if (instance.status === 'paid') {
        monthlyBreakdown[monthKey].paidCount++;
        paidCount++;
      } else if (instance.status === 'overdue') {
        monthlyBreakdown[monthKey].overdueCount++;
        overdueCount++;
      } else if (instance.status === 'pending') {
        monthlyBreakdown[monthKey].pendingCount++;
        pendingCount++;
      }
    }

    // Find the next due bill
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const upcomingInstances = yearInstances
      .filter(i => i.status === 'pending' && i.dueDate >= todayStr)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    const nextDue = upcomingInstances.length > 0 ? {
      billId: upcomingInstances[0].billId,
      billName: nonMonthlyBills.find(b => b.id === upcomingInstances[0].billId)?.name || 'Unknown',
      dueDate: upcomingInstances[0].dueDate,
      amount: upcomingInstances[0].expectedAmount,
      instanceId: upcomingInstances[0].id,
    } : null;

    return Response.json({
      year,
      bills: billsWithMonthlyData,
      monthNames: MONTH_NAMES,
      summary: {
        totalAnnualAmount,
        monthlyBreakdown,
        paidCount,
        pendingCount,
        overdueCount,
        totalInstances: yearInstances.length,
        nextDue,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error fetching annual planning data:', error);
    return Response.json(
      { error: 'Failed to fetch annual planning data' },
      { status: 500 }
    );
  }
}

function createEmptyMonthlySummary(): MonthlySummary {
  return {
    total: 0,
    paidCount: 0,
    pendingCount: 0,
    overdueCount: 0,
  };
}

