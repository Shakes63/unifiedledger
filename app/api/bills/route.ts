import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { bills, billInstances, budgetCategories, accounts } from '@/lib/db/schema';
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
    let billsWithInstances = [];

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
      expectedAmount,
      dueDate,
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

    // Validate category if provided
    if (categoryId) {
      const category = await db
        .select()
        .from(budgetCategories)
        .where(
          and(
            eq(budgetCategories.id, categoryId),
            eq(budgetCategories.userId, userId)
          )
        )
        .limit(1);

      if (category.length === 0) {
        return Response.json(
          { error: 'Category not found' },
          { status: 404 }
        );
      }
    }

    // Validate account if provided
    if (accountId) {
      const account = await db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.id, accountId),
            eq(accounts.userId, userId)
          )
        )
        .limit(1);

      if (account.length === 0) {
        return Response.json(
          { error: 'Account not found' },
          { status: 404 }
        );
      }
    }

    const billId = nanoid();

    // Create the bill
    const newBill = await db.insert(bills).values({
      id: billId,
      userId,
      name,
      categoryId,
      expectedAmount: parseFloat(expectedAmount),
      dueDate,
      isVariableAmount,
      amountTolerance,
      payeePatterns: payeePatterns ? JSON.stringify(payeePatterns) : null,
      accountId,
      autoMarkPaid,
      notes,
    });

    // Create initial bill instances for next 3 months
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    for (let i = 0; i < 3; i++) {
      let month = (currentMonth + i) % 12;
      let year = currentYear + Math.floor((currentMonth + i) / 12);

      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const instanceDueDate = Math.min(dueDate, daysInMonth);
      const dueDateString = new Date(year, month, instanceDueDate)
        .toISOString()
        .split('T')[0];

      await db.insert(billInstances).values({
        id: nanoid(),
        userId,
        billId,
        dueDate: dueDateString,
        expectedAmount: parseFloat(expectedAmount),
        status: 'pending',
      });
    }

    // Fetch and return created bill with instances
    const createdBill = await db
      .select()
      .from(bills)
      .where(eq(bills.id, billId))
      .limit(1);

    const billInstancesList = await db
      .select()
      .from(billInstances)
      .where(eq(billInstances.billId, billId))
      .orderBy(billInstances.dueDate);

    if (!createdBill || createdBill.length === 0) {
      return Response.json(
        { error: 'Failed to retrieve created bill' },
        { status: 500 }
      );
    }

    return Response.json({
      bill: createdBill[0],
      instances: billInstancesList || [],
    });
  } catch (error) {
    console.error('Error creating bill:', error);
    return Response.json(
      { error: 'Failed to create bill' },
      { status: 500 }
    );
  }
}
