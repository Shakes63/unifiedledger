import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { bills, billInstances, budgetCategories, accounts, merchants } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { isNonMonthlyPeriodic } from '@/lib/bills/bill-utils';

export const dynamic = 'force-dynamic';

// GET - Fetch a single bill with all instances
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const { id } = await params;

    const bill = await db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.id, id),
          eq(bills.userId, userId),
          eq(bills.householdId, householdId)
        )
      )
      .limit(1);

    if (bill.length === 0) {
      return Response.json(
        { error: 'Bill not found' },
        { status: 404 }
      );
    }

    const instances = await db
      .select()
      .from(billInstances)
      .where(
        and(
          eq(billInstances.billId, id),
          eq(billInstances.householdId, householdId)
        )
      )
      .orderBy(billInstances.dueDate);

    const category = bill[0].categoryId
      ? await db
          .select()
          .from(budgetCategories)
          .where(
            and(
              eq(budgetCategories.id, bill[0].categoryId),
              eq(budgetCategories.householdId, householdId)
            )
          )
          .limit(1)
      : null;

    const account = bill[0].accountId
      ? await db
          .select()
          .from(accounts)
          .where(
            and(
              eq(accounts.id, bill[0].accountId),
              eq(accounts.householdId, householdId)
            )
          )
          .limit(1)
      : null;

    const merchant = bill[0].merchantId
      ? await db
          .select()
          .from(merchants)
          .where(
            and(
              eq(merchants.id, bill[0].merchantId),
              eq(merchants.householdId, householdId)
            )
          )
          .limit(1)
      : null;

    return Response.json({
      bill: bill[0],
      instances,
      category: category?.[0] || null,
      merchant: merchant?.[0] || null,
      account: account?.[0] || null,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error fetching bill:', error);
    return Response.json(
      { error: 'Failed to fetch bill' },
      { status: 500 }
    );
  }
}

// PUT - Update a bill
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const { householdId } = await getAndVerifyHousehold(request, userId, body);

    const { id } = await params;
    const {
      name,
      categoryId,
      merchantId,
      expectedAmount,
      dueDate,
      startMonth, // 0-11 for quarterly/semi-annual/annual bills
      isVariableAmount,
      amountTolerance,
      payeePatterns,
      accountId,
      autoMarkPaid,
      notes,
      isActive,
    } = body;

    // Verify bill exists and belongs to user and household
    const existingBill = await db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.id, id),
          eq(bills.userId, userId),
          eq(bills.householdId, householdId)
        )
      )
      .limit(1);

    if (existingBill.length === 0) {
      return Response.json(
        { error: 'Bill not found' },
        { status: 404 }
      );
    }

    // Validate category if provided and changed
    if (categoryId && categoryId !== existingBill[0].categoryId) {
      const category = await db
        .select()
        .from(budgetCategories)
        .where(
          and(
            eq(budgetCategories.id, categoryId),
            eq(budgetCategories.userId, userId),
            eq(budgetCategories.householdId, householdId)
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

    // Validate merchant if provided and changed
    if (merchantId !== undefined && merchantId !== existingBill[0].merchantId) {
      if (merchantId) {
        const merchant = await db
          .select()
          .from(merchants)
          .where(
            and(
              eq(merchants.id, merchantId),
              eq(merchants.userId, userId),
              eq(merchants.householdId, householdId)
            )
          )
          .limit(1);

        if (merchant.length === 0) {
          return Response.json(
            { error: 'Merchant not found' },
            { status: 404 }
          );
        }
      }
    }

    // Validate account if provided and changed
    if (accountId && accountId !== existingBill[0].accountId) {
      const account = await db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.id, accountId),
            eq(accounts.userId, userId),
            eq(accounts.householdId, householdId)
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

    // Validate startMonth if provided
    if (startMonth !== undefined) {
      // Get the bill's frequency to validate startMonth
      const billFrequency = existingBill[0].frequency;
      
      if (startMonth !== null) {
        if (!isNonMonthlyPeriodic(billFrequency || 'monthly')) {
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
    }

    // Build update object with only provided fields
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (merchantId !== undefined) updateData.merchantId = merchantId || null;
    if (expectedAmount !== undefined) updateData.expectedAmount = parseFloat(expectedAmount);
    if (dueDate !== undefined) {
      if (dueDate < 1 || dueDate > 31) {
        return Response.json(
          { error: 'Due date must be between 1 and 31' },
          { status: 400 }
        );
      }
      updateData.dueDate = dueDate;
    }
    if (startMonth !== undefined) updateData.startMonth = startMonth;
    if (isVariableAmount !== undefined) updateData.isVariableAmount = isVariableAmount;
    if (amountTolerance !== undefined) updateData.amountTolerance = amountTolerance;
    if (payeePatterns !== undefined) updateData.payeePatterns = payeePatterns ? JSON.stringify(payeePatterns) : null;
    if (accountId !== undefined) updateData.accountId = accountId;
    if (autoMarkPaid !== undefined) updateData.autoMarkPaid = autoMarkPaid;
    if (notes !== undefined) updateData.notes = notes;
    if (isActive !== undefined) updateData.isActive = isActive;

    await db
      .update(bills)
      .set(updateData)
      .where(
        and(
          eq(bills.id, id),
          eq(bills.householdId, householdId)
        )
      );

    const updatedBill = await db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.id, id),
          eq(bills.householdId, householdId)
        )
      )
      .limit(1);

    return Response.json(updatedBill[0]);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error updating bill:', error);
    return Response.json(
      { error: 'Failed to update bill' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a bill and associated instances
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const { id } = await params;

    // Verify bill exists and belongs to user and household
    const bill = await db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.id, id),
          eq(bills.userId, userId),
          eq(bills.householdId, householdId)
        )
      )
      .limit(1);

    if (bill.length === 0) {
      return Response.json(
        { error: 'Bill not found' },
        { status: 404 }
      );
    }

    // Delete all bill instances for this household
    await db
      .delete(billInstances)
      .where(
        and(
          eq(billInstances.billId, id),
          eq(billInstances.householdId, householdId)
        )
      );

    // Delete the bill
    await db
      .delete(bills)
      .where(
        and(
          eq(bills.id, id),
          eq(bills.householdId, householdId)
        )
      );

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error deleting bill:', error);
    return Response.json(
      { error: 'Failed to delete bill' },
      { status: 500 }
    );
  }
}
