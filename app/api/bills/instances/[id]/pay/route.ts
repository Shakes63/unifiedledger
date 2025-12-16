import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import {
  billInstances,
  bills,
  transactions,
  accounts,
  budgetCategories,
  merchants,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

/**
 * POST /api/bills/instances/:id/pay
 * Create a transaction and mark the bill instance as paid
 * 
 * Request body:
 * - accountId: string (required) - account to pay from
 * - amount: number (optional) - defaults to expectedAmount
 * - date: string (optional) - defaults to today
 * - notes: string (optional)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const { householdId } = await getAndVerifyHousehold(request, userId, body);
    const { id: instanceId } = await params;

    const {
      accountId,
      amount: providedAmount,
      date: providedDate,
      notes,
    } = body;

    // Validate required fields
    if (!accountId) {
      return NextResponse.json(
        { error: 'accountId is required' },
        { status: 400 }
      );
    }

    // Fetch the bill instance with its bill
    const instanceResult = await db
      .select({
        instance: billInstances,
        bill: bills,
      })
      .from(billInstances)
      .innerJoin(bills, eq(billInstances.billId, bills.id))
      .where(
        and(
          eq(billInstances.id, instanceId),
          eq(billInstances.userId, userId),
          eq(billInstances.householdId, householdId)
        )
      )
      .limit(1);

    if (instanceResult.length === 0) {
      return NextResponse.json(
        { error: 'Bill instance not found' },
        { status: 404 }
      );
    }

    const { instance, bill } = instanceResult[0];

    // Check if already paid
    if (instance.status === 'paid') {
      return NextResponse.json(
        { error: 'Bill instance is already paid' },
        { status: 400 }
      );
    }

    // Validate account exists and belongs to user
    const accountResult = await db
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

    if (accountResult.length === 0) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    const account = accountResult[0];

    // Determine the transaction type based on bill type
    const isIncomeBill = bill.billType === 'income';
    const transactionType: 'income' | 'expense' = isIncomeBill ? 'income' : 'expense';

    // Calculate amount (use provided or default to expected)
    const paymentAmount = providedAmount !== undefined
      ? new Decimal(providedAmount).toNumber()
      : instance.expectedAmount;

    // Determine date (use provided or default to today)
    const paymentDate = providedDate || format(new Date(), 'yyyy-MM-dd');

    // Generate transaction ID
    const transactionId = nanoid();

    // Create the transaction
    const transactionData = {
      id: transactionId,
      userId,
      householdId,
      accountId,
      categoryId: bill.categoryId || null,
      merchantId: bill.merchantId || null,
      amount: paymentAmount,
      date: paymentDate,
      description: bill.name,
      notes: notes || null,
      type: transactionType,
      isPending: false,
      syncStatus: 'synced' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Calculate balance change
    const balanceChange = transactionType === 'income'
      ? new Decimal(paymentAmount)
      : new Decimal(paymentAmount).negated();

    const newBalance = new Decimal(account.currentBalance || 0)
      .plus(balanceChange)
      .toNumber();

    // Execute in parallel: create transaction, update account balance, update bill instance
    await Promise.all([
      // Create transaction
      db.insert(transactions).values(transactionData),
      
      // Update account balance
      db
        .update(accounts)
        .set({
          currentBalance: newBalance,
          lastUsedAt: new Date().toISOString(),
          usageCount: (account.usageCount || 0) + 1,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(accounts.id, accountId)),
      
      // Update bill instance
      db
        .update(billInstances)
        .set({
          status: 'paid',
          actualAmount: paymentAmount,
          paidDate: paymentDate,
          transactionId,
          isManualOverride: true,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(billInstances.id, instanceId)),
    ]);

    // If this is a one-time bill, auto-deactivate it
    if (bill.frequency === 'one-time') {
      await db
        .update(bills)
        .set({
          isActive: false,
        })
        .where(eq(bills.id, bill.id));
    }

    // Fetch the updated instance and created transaction
    const [updatedInstance, createdTransaction] = await Promise.all([
      db
        .select()
        .from(billInstances)
        .where(eq(billInstances.id, instanceId))
        .limit(1),
      db
        .select()
        .from(transactions)
        .where(eq(transactions.id, transactionId))
        .limit(1),
    ]);

    // Get category and merchant info for the response
    let category = null;
    let merchant = null;

    if (bill.categoryId) {
      const categoryResult = await db
        .select()
        .from(budgetCategories)
        .where(eq(budgetCategories.id, bill.categoryId))
        .limit(1);
      category = categoryResult[0] || null;
    }

    if (bill.merchantId) {
      const merchantResult = await db
        .select()
        .from(merchants)
        .where(eq(merchants.id, bill.merchantId))
        .limit(1);
      merchant = merchantResult[0] || null;
    }

    return NextResponse.json({
      success: true,
      transaction: {
        ...createdTransaction[0],
        category,
        merchant,
        account,
      },
      instance: updatedInstance[0],
      bill,
      balanceChange: balanceChange.toNumber(),
      newBalance,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Failed to pay bill:', error);
    return NextResponse.json(
      { error: 'Failed to pay bill' },
      { status: 500 }
    );
  }
}






