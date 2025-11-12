import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { bills, billInstances, budgetCategories, accounts, debts } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

// GET - List all bills for user with pagination
export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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
          account: accounts,
        })
        .from(bills)
        .leftJoin(budgetCategories, eq(bills.categoryId, budgetCategories.id))
        .leftJoin(accounts, eq(bills.accountId, accounts.id))
        .where(and(eq(bills.userId, userId), eq(bills.isActive, true)))
        .orderBy(desc(bills.createdAt))
        .limit(limit)
        .offset(offset);
    } else if (isActive === 'false') {
      result = await db
        .select({
          bill: bills,
          category: budgetCategories,
          account: accounts,
        })
        .from(bills)
        .leftJoin(budgetCategories, eq(bills.categoryId, budgetCategories.id))
        .leftJoin(accounts, eq(bills.accountId, accounts.id))
        .where(and(eq(bills.userId, userId), eq(bills.isActive, false)))
        .orderBy(desc(bills.createdAt))
        .limit(limit)
        .offset(offset);
    } else {
      result = await db
        .select({
          bill: bills,
          category: budgetCategories,
          account: accounts,
        })
        .from(bills)
        .leftJoin(budgetCategories, eq(bills.categoryId, budgetCategories.id))
        .leftJoin(accounts, eq(bills.accountId, accounts.id))
        .where(eq(bills.userId, userId))
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
      .where(eq(bills.userId, userId));

    return Response.json({
      data: billsWithInstances,
      total: countResult.length,
      limit,
      offset,
    });
  } catch (error) {
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
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      name,
      categoryId,
      debtId,
      expectedAmount,
      dueDate,
      frequency = 'monthly',
      isVariableAmount = false,
      amountTolerance = 5.0,
      payeePatterns,
      accountId,
      autoMarkPaid = true,
      notes,
    } = body;

    // Validate required fields
    if (!name || !expectedAmount || dueDate === undefined) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate dueDate is between 1-31
    if (dueDate < 1 || dueDate > 31) {
      return Response.json(
        { error: 'Due date must be between 1 and 31' },
        { status: 400 }
      );
    }

    // Batch validation queries in parallel for better performance
    const validationPromises = [];

    if (categoryId) {
      validationPromises.push(
        db
          .select()
          .from(budgetCategories)
          .where(
            and(
              eq(budgetCategories.id, categoryId),
              eq(budgetCategories.userId, userId)
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
              eq(accounts.userId, userId)
            )
          )
          .limit(1)
          .then(result => ({ type: 'account', found: result.length > 0 }))
      );
    }

    if (debtId) {
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
      name,
      categoryId,
      debtId,
      expectedAmount: parsedExpectedAmount,
      dueDate,
      frequency,
      isVariableAmount,
      amountTolerance,
      payeePatterns: payeePatterns ? JSON.stringify(payeePatterns) : null,
      accountId,
      autoMarkPaid,
      notes,
    };

    // Determine how many instances to create and month increment
    let instanceCount = 3;
    let monthIncrement = 1;

    switch (frequency) {
      case 'monthly':
        instanceCount = 3;
        monthIncrement = 1;
        break;
      case 'quarterly':
        instanceCount = 3;
        monthIncrement = 3;
        break;
      case 'semi-annual':
        instanceCount = 2;
        monthIncrement = 6;
        break;
      case 'annual':
        instanceCount = 2;
        monthIncrement = 12;
        break;
    }

    // Prepare all bill instances data for batch insert
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const instancesData = [];

    for (let i = 0; i < instanceCount; i++) {
      const monthsToAdd = i * monthIncrement;
      let month = (currentMonth + monthsToAdd) % 12;
      let year = currentYear + Math.floor((currentMonth + monthsToAdd) / 12);

      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const instanceDueDate = Math.min(dueDate, daysInMonth);
      const dueDateString = new Date(year, month, instanceDueDate)
        .toISOString()
        .split('T')[0];

      instancesData.push({
        id: nanoid(),
        userId,
        billId,
        dueDate: dueDateString,
        expectedAmount: parsedExpectedAmount,
        status: 'pending' as const,
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
    console.error('Error creating bill:', error);
    return Response.json(
      { error: 'Failed to create bill' },
      { status: 500 }
    );
  }
}
