import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { bills, billInstances } from '@/lib/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { format, startOfYear, endOfYear, addMonths } from 'date-fns';
import {
  calculateNextDueDate,
  isOneTimeFrequency,
  isNonMonthlyPeriodic,
} from '@/lib/bills/bill-utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/bills/ensure-instances
 * 
 * Ensures bill instances exist for a given year.
 * This is called on-demand when viewing the annual planner.
 * 
 * Body: { year: number }
 * 
 * This endpoint is idempotent - it won't create duplicate instances.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const { householdId } = await getAndVerifyHousehold(request, userId, body);

    const { year } = body;

    if (!year || typeof year !== 'number') {
      return Response.json(
        { error: 'Year is required' },
        { status: 400 }
      );
    }

    // Get all active recurring bills (excluding one-time bills)
    const activeBills = await db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.userId, userId),
          eq(bills.householdId, householdId),
          eq(bills.isActive, true)
        )
      );

    const yearStart = format(startOfYear(new Date(year, 0, 1)), 'yyyy-MM-dd');
    const yearEnd = format(endOfYear(new Date(year, 0, 1)), 'yyyy-MM-dd');

    let instancesCreated = 0;

    for (const bill of activeBills) {
      // Skip one-time bills - they have their single instance already
      // Also skip bills without a frequency set
      if (!bill.frequency || isOneTimeFrequency(bill.frequency)) {
        continue;
      }

      // Get existing instances for this bill in the target year
      const existingInstances = await db
        .select()
        .from(billInstances)
        .where(
          and(
            eq(billInstances.billId, bill.id),
            eq(billInstances.householdId, householdId),
            gte(billInstances.dueDate, yearStart),
            lte(billInstances.dueDate, yearEnd)
          )
        );

      const existingDates = new Set(existingInstances.map(i => i.dueDate));

      // Calculate expected instances for this bill in the target year
      const expectedInstances = calculateExpectedInstancesForYear(bill, year);

      // Create missing instances
      const instancesToCreate = expectedInstances.filter(
        date => !existingDates.has(date)
      );

      if (instancesToCreate.length > 0) {
        const today = format(new Date(), 'yyyy-MM-dd');
        
        await db.insert(billInstances).values(
          instancesToCreate.map(dueDate => ({
            id: nanoid(),
            userId,
            householdId,
            billId: bill.id,
            dueDate,
            expectedAmount: bill.expectedAmount,
            status: dueDate < today ? 'overdue' : 'pending' as 'pending' | 'overdue',
          }))
        );

        instancesCreated += instancesToCreate.length;
      }
    }

    return Response.json({
      success: true,
      year,
      instancesCreated,
      billsChecked: activeBills.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error ensuring bill instances:', error);
    return Response.json(
      { error: 'Failed to ensure bill instances' },
      { status: 500 }
    );
  }
}

/**
 * Calculate all expected due dates for a bill within a specific year
 */
function calculateExpectedInstancesForYear(
  bill: typeof bills.$inferSelect,
  year: number
): string[] {
  const instances: string[] = [];
  const frequency = bill.frequency;
  const dueDate = bill.dueDate;
  const startMonth = bill.startMonth;

  // Get the month interval based on frequency
  let monthInterval: number;
  switch (frequency) {
    case 'monthly':
      monthInterval = 1;
      break;
    case 'quarterly':
      monthInterval = 3;
      break;
    case 'semi-annual':
      monthInterval = 6;
      break;
    case 'annual':
      monthInterval = 12;
      break;
    case 'weekly':
    case 'biweekly':
      // Weekly/biweekly bills are handled differently
      return calculateWeeklyInstancesForYear(bill, year);
    default:
      return instances;
  }

  // For non-monthly periodic bills (quarterly, semi-annual, annual),
  // use the startMonth to determine which months have instances
  if (isNonMonthlyPeriodic(frequency) && startMonth !== null) {
    // Generate instances starting from startMonth, advancing by monthInterval
    let currentMonth = startMonth;
    
    while (currentMonth < 12) {
      const instanceDate = calculateSafeDueDate(year, currentMonth, dueDate);
      instances.push(instanceDate);
      currentMonth += monthInterval;
    }
  } else if (frequency === 'monthly') {
    // Monthly bills: one instance per month
    for (let month = 0; month < 12; month++) {
      const instanceDate = calculateSafeDueDate(year, month, dueDate);
      instances.push(instanceDate);
    }
  } else {
    // Legacy behavior for non-monthly without startMonth
    // Use current month as the base and calculate forward
    const today = new Date();
    let baseMonth = today.getMonth();
    let baseYear = today.getFullYear();
    
    // If we're looking at a future year, start from January
    if (year > baseYear) {
      baseMonth = 0;
      baseYear = year;
    }
    
    // Generate instances for the target year
    for (let month = 0; month < 12; month += monthInterval) {
      const instanceDate = calculateSafeDueDate(year, month, dueDate);
      instances.push(instanceDate);
    }
  }

  return instances;
}

/**
 * Calculate weekly/biweekly instances for a year
 */
function calculateWeeklyInstancesForYear(
  bill: typeof bills.$inferSelect,
  year: number
): string[] {
  const instances: string[] = [];
  const isWeekly = bill.frequency === 'weekly';
  const dayOfWeek = bill.dueDate; // 0-6 for weekly/biweekly
  const interval = isWeekly ? 7 : 14; // days

  // Start from the first occurrence of this day in the year
  let current = new Date(year, 0, 1);
  
  // Find the first occurrence of the target day
  while (current.getDay() !== dayOfWeek) {
    current.setDate(current.getDate() + 1);
  }

  // Generate all instances for the year
  while (current.getFullYear() === year) {
    instances.push(format(current, 'yyyy-MM-dd'));
    current.setDate(current.getDate() + interval);
  }

  return instances;
}

/**
 * Calculate a safe due date, handling months with fewer days
 */
function calculateSafeDueDate(year: number, month: number, dayOfMonth: number): string {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const safeDay = Math.min(dayOfMonth, daysInMonth);
  return format(new Date(year, month, safeDay), 'yyyy-MM-dd');
}

