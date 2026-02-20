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
  billInstanceAllocations,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';
import { format } from 'date-fns';
import { processBillPayment } from '@/lib/bills/bill-payment-utils';
import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import {
  amountToCents,
  getAccountBalanceCents,
  insertTransactionMovement,
  updateScopedAccountBalance,
} from '@/lib/transactions/money-movement-service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/bills/instances/:id/pay
 * Create a transaction and process a bill payment (full or partial)
 * 
 * Request body:
 * - accountId: string (required) - account to pay from
 * - amount: number (optional) - defaults to remaining amount or expectedAmount
 * - date: string (optional) - defaults to today
 * - notes: string (optional)
 * - allocationId: string (optional) - if paying toward a specific period allocation
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
      allocationId,
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

    // Check if already fully paid (allow partial payments to continue)
    const paymentStatus = instance.paymentStatus || 'unpaid';
    if (paymentStatus === 'paid' || paymentStatus === 'overpaid') {
      return NextResponse.json(
        { error: 'Bill instance is already fully paid' },
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

    // Calculate amount (use provided, or remaining amount, or expected amount)
    const remainingAmount = instance.remainingAmount ?? instance.expectedAmount;
    const _paidSoFar = instance.paidAmount || 0;
    
    let paymentAmount: number;
    if (providedAmount !== undefined) {
      paymentAmount = new Decimal(providedAmount).toNumber();
    } else if (allocationId) {
      // If paying toward an allocation, get the allocation amount
      const allocation = await db
        .select()
        .from(billInstanceAllocations)
        .where(
          and(
            eq(billInstanceAllocations.id, allocationId),
            eq(billInstanceAllocations.billInstanceId, instanceId)
          )
        )
        .limit(1);
      
      if (allocation.length > 0) {
        // Pay the remaining allocation amount
        const allocationRemaining = new Decimal(allocation[0].allocatedAmount)
          .minus(allocation[0].paidAmount || 0)
          .toNumber();
        paymentAmount = Math.max(0, allocationRemaining);
      } else {
        paymentAmount = remainingAmount;
      }
    } else {
      paymentAmount = remainingAmount;
    }

    // Validate payment amount
    if (paymentAmount <= 0) {
      return NextResponse.json(
        { error: 'Payment amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Determine date (use provided or default to today)
    const paymentDate = providedDate || format(new Date(), 'yyyy-MM-dd');

    // Generate transaction ID
    const transactionId = nanoid();

    const paymentAmountCents = amountToCents(paymentAmount);
    const signedAmountCents = transactionType === 'income' ? paymentAmountCents : -paymentAmountCents;
    const newBalanceCents = getAccountBalanceCents(account) + signedAmountCents;
    const nowIso = new Date().toISOString();

    // Calculate balance change for response payload
    const balanceChange = new Decimal(signedAmountCents).div(100);
    const newBalance = new Decimal(newBalanceCents).div(100).toNumber();

    await runInDatabaseTransaction(async (tx) => {
      await insertTransactionMovement(tx, {
        id: transactionId,
        userId,
        householdId,
        accountId,
        categoryId: bill.categoryId || null,
        merchantId: bill.merchantId || null,
        date: paymentDate,
        amountCents: paymentAmountCents,
        description: bill.name,
        notes: notes || null,
        type: transactionType,
        isPending: false,
        syncStatus: 'synced',
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      await updateScopedAccountBalance(tx, {
        accountId,
        userId,
        householdId,
        balanceCents: newBalanceCents,
        lastUsedAt: nowIso,
        usageCount: (account.usageCount || 0) + 1,
        updatedAt: nowIso,
      });
    });

    // Process the bill payment using the utility
    const paymentResult = await processBillPayment({
      billId: bill.id,
      instanceId,
      transactionId,
      paymentAmount,
      paymentDate,
      userId,
      householdId,
      paymentMethod: 'manual',
      linkedAccountId: accountId,
      notes,
    });

    if (!paymentResult.success) {
      return NextResponse.json(
        { error: paymentResult.error || 'Failed to process payment' },
        { status: 500 }
      );
    }

    // If paying toward a specific allocation, update it
    if (allocationId) {
      const now = new Date().toISOString();
      const allocation = await db
        .select()
        .from(billInstanceAllocations)
        .where(eq(billInstanceAllocations.id, allocationId))
        .limit(1);

      if (allocation.length > 0) {
        const newPaidAmount = new Decimal(allocation[0].paidAmount || 0)
          .plus(paymentAmount)
          .toNumber();
        const isPaid = newPaidAmount >= allocation[0].allocatedAmount;

        await db
          .update(billInstanceAllocations)
          .set({
            paidAmount: newPaidAmount,
            isPaid,
            allocationId: paymentResult.paymentId,
            updatedAt: now,
          })
          .where(eq(billInstanceAllocations.id, allocationId));
      }
    }

    // If this is a one-time bill and fully paid, auto-deactivate it
    if (bill.frequency === 'one-time' && 
        (paymentResult.paymentStatus === 'paid' || paymentResult.paymentStatus === 'overpaid')) {
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
      payment: {
        paymentId: paymentResult.paymentId,
        paymentStatus: paymentResult.paymentStatus,
        amountPaid: paymentAmount,
        totalPaid: paymentResult.paidAmount,
        remainingAmount: paymentResult.remainingAmount,
        principalAmount: paymentResult.principalAmount,
        interestAmount: paymentResult.interestAmount,
        taxDeductionInfo: paymentResult.taxDeductionInfo,
      },
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
