import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { bills, billInstances, budgetCategories, accounts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// GET - Fetch a single bill with all instances
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;

    const bill = await db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.id, id),
          eq(bills.userId, userId)
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
      .where(eq(billInstances.billId, id))
      .orderBy(billInstances.dueDate);

    const category = bill[0].categoryId
      ? await db
          .select()
          .from(budgetCategories)
          .where(eq(budgetCategories.id, bill[0].categoryId))
          .limit(1)
      : null;

    const account = bill[0].accountId
      ? await db
          .select()
          .from(accounts)
          .where(eq(accounts.id, bill[0].accountId))
          .limit(1)
      : null;

    return Response.json({
      bill: bill[0],
      instances,
      category: category?.[0] || null,
      account: account?.[0] || null,
    });
  } catch (error) {
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
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await request.json();
    const {
      name,
      categoryId,
      expectedAmount,
      dueDate,
      isVariableAmount,
      amountTolerance,
      payeePatterns,
      accountId,
      autoMarkPaid,
      notes,
      isActive,
    } = body;

    // Verify bill exists and belongs to user
    const existingBill = await db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.id, id),
          eq(bills.userId, userId)
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

    // Validate account if provided and changed
    if (accountId && accountId !== existingBill[0].accountId) {
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

    // Build update object with only provided fields
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (categoryId !== undefined) updateData.categoryId = categoryId;
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
      .where(eq(bills.id, id));

    const updatedBill = await db
      .select()
      .from(bills)
      .where(eq(bills.id, id))
      .limit(1);

    return Response.json(updatedBill[0]);
  } catch (error) {
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
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;

    // Verify bill exists and belongs to user
    const bill = await db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.id, id),
          eq(bills.userId, userId)
        )
      )
      .limit(1);

    if (bill.length === 0) {
      return Response.json(
        { error: 'Bill not found' },
        { status: 404 }
      );
    }

    // Delete all bill instances
    await db
      .delete(billInstances)
      .where(eq(billInstances.billId, id));

    // Delete the bill
    await db
      .delete(bills)
      .where(eq(bills.id, id));

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting bill:', error);
    return Response.json(
      { error: 'Failed to delete bill' },
      { status: 500 }
    );
  }
}
