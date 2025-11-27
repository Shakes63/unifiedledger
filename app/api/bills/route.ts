import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { bills, billInstances, budgetCategories, accounts, debts, merchants } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { format } from 'date-fns';
import {
  calculateNextDueDate,
  getInstanceCount,
  isWeekBasedFrequency,
  isOneTimeFrequency,
  isNonMonthlyPeriodic,
} from '@/lib/bills/bill-utils';

export const dynamic = 'force-dynamic';

// GET - List all bills for user with pagination
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const isActive = url.searchParams.get('isActive');

    let result;

    if (isActive === 'true') {
      result = await db
        .select({
          bill: bills,
          category: budgetCategories,
          merchant: merchants,
          account: accounts,
        })
        .from(bills)
        .leftJoin(budgetCategories, eq(bills.categoryId, budgetCategories.id))
        .leftJoin(merchants, eq(bills.merchantId, merchants.id))
        .leftJoin(accounts, eq(bills.accountId, accounts.id))
        .where(
          and(
            eq(bills.userId, userId),
            eq(bills.householdId, householdId),
            eq(bills.isActive, true)
          )
        )
        .orderBy(desc(bills.createdAt))
        .limit(limit)
        .offset(offset);
    } else if (isActive === 'false') {
      result = await db
        .select({
          bill: bills,
          category: budgetCategories,
          merchant: merchants,
          account: accounts,
        })
        .from(bills)
        .leftJoin(budgetCategories, eq(bills.categoryId, budgetCategories.id))
        .leftJoin(merchants, eq(bills.merchantId, merchants.id))
        .leftJoin(accounts, eq(bills.accountId, accounts.id))
        .where(
          and(
            eq(bills.userId, userId),
            eq(bills.householdId, householdId),
            eq(bills.isActive, false)
          )
        )
        .orderBy(desc(bills.createdAt))
        .limit(limit)
        .offset(offset);
    } else {
      result = await db
        .select({
          bill: bills,
          category: budgetCategories,
          merchant: merchants,
          account: accounts,
        })
        .from(bills)
        .leftJoin(budgetCategories, eq(bills.categoryId, budgetCategories.id))
        .leftJoin(merchants, eq(bills.merchantId, merchants.id))
        .leftJoin(accounts, eq(bills.accountId, accounts.id))
        .where(
          and(
            eq(bills.userId, userId),
            eq(bills.householdId, householdId)
          )
        )
        .orderBy(desc(bills.createdAt))
        .limit(limit)
        .offset(offset);
    }

    // Get upcoming bill instances for each bill
    let billsWithInstances: any[] = [];

    if (result && result.length > 0) {
      billsWithInstances = await Promise.all(
        result.map(async (row) => {
          const upcomingInstances = await db
            .select()
            .from(billInstances)
            .where(
              and(
                eq(billInstances.billId, row.bill.id),
                eq(billInstances.householdId, householdId),
                eq(billInstances.status, 'pending')
              )
            )
            .orderBy(billInstances.dueDate)
            .limit(3);

          return {
            ...row,
            upcomingInstances,
          };
        })
      );
    }

    // Get total count
    const countResult = await db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.userId, userId),
          eq(bills.householdId, householdId)
        )
      );

    return Response.json({
      data: billsWithInstances,
      total: countResult.length,
      limit,
      offset,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error fetching bills:', error);
    return Response.json(
      { error: 'Failed to fetch bills' },
      { status: 500 }
    );
  }
}

// POST - Create a new bill
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const { householdId } = await getAndVerifyHousehold(request, userId, body);

    const {
      name,
      categoryId,
      merchantId,
      debtId,
      expectedAmount,
      dueDate,
      specificDueDate,
      startMonth, // 0-11 for quarterly/semi-annual/annual bills
      frequency = 'monthly',
      isVariableAmount = false,
      amountTolerance = 5.0,
      payeePatterns,
      accountId,
      autoMarkPaid = true,
      notes,
    } = body;

    // Validate required fields
    if (!name || !expectedAmount) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate frequency-specific fields
    if (isOneTimeFrequency(frequency)) {
      // For one-time bills, specificDueDate is required
      if (!specificDueDate) {
        return Response.json(
          { error: 'Specific due date required for one-time bills' },
          { status: 400 }
        );
      }
      // Validate date format
      const parsedDate = new Date(specificDueDate);
      if (isNaN(parsedDate.getTime())) {
        return Response.json(
          { error: 'Invalid specific due date format' },
          { status: 400 }
        );
      }
      // Validate date is not in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      parsedDate.setHours(0, 0, 0, 0);
      if (parsedDate < today) {
        return Response.json(
          { error: 'Due date cannot be in the past' },
          { status: 400 }
        );
      }
    } else {
      // For recurring bills, dueDate is required
      if (dueDate === undefined || dueDate === null) {
        return Response.json(
          { error: 'Due date is required' },
          { status: 400 }
        );
      }

      // Validate dueDate based on frequency
      if (isWeekBasedFrequency(frequency)) {
        // For weekly/biweekly, dueDate should be 0-6 (day of week)
        if (dueDate < 0 || dueDate > 6) {
          return Response.json(
            { error: 'Due date must be between 0 (Sunday) and 6 (Saturday) for weekly/biweekly bills' },
            { status: 400 }
          );
        }
      } else {
        // For month-based, dueDate should be 1-31 (day of month)
        if (dueDate < 1 || dueDate > 31) {
          return Response.json(
            { error: 'Due date must be between 1 and 31 for monthly bills' },
            { status: 400 }
          );
        }
      }
    }

    // Validate startMonth for non-monthly periodic bills
    if (startMonth !== undefined && startMonth !== null) {
      if (!isNonMonthlyPeriodic(frequency)) {
        return Response.json(
          { error: 'startMonth is only valid for quarterly, semi-annual, or annual bills' },
          { status: 400 }
        );
      }
      if (typeof startMonth !== 'number' || startMonth < 0 || startMonth > 11) {
        return Response.json(
          { error: 'startMonth must be between 0 (January) and 11 (December)' },
          { status: 400 }
        );
      }
    }

    // Batch validation queries in parallel for better performance
    // Verify all related entities belong to the same household
    const validationPromises = [];

    if (categoryId) {
      validationPromises.push(
        db
          .select()
          .from(budgetCategories)
          .where(
            and(
              eq(budgetCategories.id, categoryId),
              eq(budgetCategories.userId, userId),
              eq(budgetCategories.householdId, householdId)
            )
          )
          .limit(1)
          .then(result => ({ type: 'category', found: result.length > 0 }))
      );
    }

    if (accountId) {
      validationPromises.push(
        db
          .select()
          .from(accounts)
          .where(
            and(
              eq(accounts.id, accountId),
              eq(accounts.userId, userId),
              eq(accounts.householdId, householdId)
            )
          )
          .limit(1)
          .then(result => ({ type: 'account', found: result.length > 0 }))
      );
    }

    if (merchantId) {
      validationPromises.push(
        db
          .select()
          .from(merchants)
          .where(
            and(
              eq(merchants.id, merchantId),
              eq(merchants.userId, userId),
              eq(merchants.householdId, householdId)
            )
          )
          .limit(1)
          .then(result => ({ type: 'merchant', found: result.length > 0 }))
      );
    }

    if (debtId) {
      // Note: Debts don't have householdId yet (Phase 3), so we only check userId for now
      validationPromises.push(
        db
          .select()
          .from(debts)
          .where(
            and(
              eq(debts.id, debtId),
              eq(debts.userId, userId)
            )
          )
          .limit(1)
          .then(result => ({ type: 'debt', found: result.length > 0 }))
      );
    }

    // Execute all validation queries in parallel
    if (validationPromises.length > 0) {
      const validationResults = await Promise.all(validationPromises);
      for (const result of validationResults) {
        if (!result.found) {
          return Response.json(
            { error: `${result.type.charAt(0).toUpperCase() + result.type.slice(1)} not found` },
            { status: 404 }
          );
        }
      }
    }

    const billId = nanoid();
    const parsedExpectedAmount = parseFloat(expectedAmount);

    // Prepare bill data
    const billData = {
      id: billId,
      userId,
      householdId,
      name,
      categoryId,
      merchantId: merchantId || null,
      debtId,
      expectedAmount: parsedExpectedAmount,
      dueDate: isOneTimeFrequency(frequency) ? 1 : dueDate, // Set to 1 for one-time bills (ignored anyway)
      frequency,
      specificDueDate: isOneTimeFrequency(frequency) ? specificDueDate : null,
      startMonth: isNonMonthlyPeriodic(frequency) ? (startMonth ?? null) : null, // Only for quarterly/semi-annual/annual
      isVariableAmount,
      amountTolerance,
      payeePatterns: payeePatterns ? JSON.stringify(payeePatterns) : null,
      accountId,
      autoMarkPaid,
      notes,
    };

    // Generate bill instances using helper functions
    const instanceCount = getInstanceCount(frequency);
    const today = new Date();
    const todayString = format(today, 'yyyy-MM-dd');
    const instancesData = [];

    // Determine startMonth value for instance generation
    const effectiveStartMonth = isNonMonthlyPeriodic(frequency) ? (startMonth ?? null) : null;

    for (let i = 0; i < instanceCount; i++) {
      const dueDateString = calculateNextDueDate(
        frequency,
        dueDate,
        specificDueDate || null,
        today,
        i,
        effectiveStartMonth
      );

      // FIX: Automatically set status to 'overdue' if due date is in the past
      // This prevents creating pending instances with past due dates
      const instanceStatus: 'pending' | 'overdue' = dueDateString < todayString ? 'overdue' : 'pending';

      instancesData.push({
        id: nanoid(),
        userId,
        householdId,
        billId,
        dueDate: dueDateString,
        expectedAmount: parsedExpectedAmount,
        status: instanceStatus,
      });
    }

    // Execute bill and instances creation in parallel
    await Promise.all([
      db.insert(bills).values(billData),
      db.insert(billInstances).values(instancesData),
    ]);

    // Return the bill data directly without re-fetching from database
    return Response.json({
      bill: billData,
      instances: instancesData,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error creating bill:', error);
    return Response.json(
      { error: 'Failed to create bill' },
      { status: 500 }
    );
  }
}
