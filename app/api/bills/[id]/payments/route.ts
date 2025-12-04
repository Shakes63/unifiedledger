/**
 * Bill Payments API
 * 
 * GET /api/bills/[id]/payments - Get payment history for a bill
 */

import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { bills, billPayments, transactions } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { id: billId } = await params;

    // Get household from query params
    const url = new URL(request.url);
    const householdId = getHouseholdIdFromRequest(request, {
      householdId: url.searchParams.get('householdId') ?? undefined,
    });
    await requireHouseholdAuth(userId, householdId);

    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    // Verify bill exists and belongs to user's household
    const bill = await db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.id, billId),
          eq(bills.userId, userId),
          eq(bills.householdId, householdId)
        )
      )
      .limit(1);

    if (!bill.length) {
      return Response.json(
        { error: 'Bill not found' },
        { status: 404 }
      );
    }

    // Get all payments for this bill with linked transaction details
    const payments = await db
      .select({
        id: billPayments.id,
        billId: billPayments.billId,
        billInstanceId: billPayments.billInstanceId,
        transactionId: billPayments.transactionId,
        amount: billPayments.amount,
        principalAmount: billPayments.principalAmount,
        interestAmount: billPayments.interestAmount,
        paymentDate: billPayments.paymentDate,
        paymentMethod: billPayments.paymentMethod,
        linkedAccountId: billPayments.linkedAccountId,
        balanceBeforePayment: billPayments.balanceBeforePayment,
        balanceAfterPayment: billPayments.balanceAfterPayment,
        notes: billPayments.notes,
        createdAt: billPayments.createdAt,
      })
      .from(billPayments)
      .where(
        and(
          eq(billPayments.billId, billId),
          eq(billPayments.userId, userId),
          eq(billPayments.householdId, householdId)
        )
      )
      .orderBy(desc(billPayments.paymentDate));

    // Fetch linked transactions for display
    const transactionIds = payments
      .filter(p => p.transactionId)
      .map(p => p.transactionId as string);

    let transactionDetails: Record<string, { description: string; accountId: string }> = {};

    if (transactionIds.length > 0) {
      const txns = await db
        .select({
          id: transactions.id,
          description: transactions.description,
          accountId: transactions.accountId,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.householdId, householdId)
          )
        );

      // Filter to only requested transactions
      const relevantTxns = txns.filter(t => transactionIds.includes(t.id));
      transactionDetails = Object.fromEntries(
        relevantTxns.map(t => [t.id, { description: t.description, accountId: t.accountId }])
      );
    }

    // Calculate totals
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalPrincipal = payments.reduce((sum, p) => sum + (p.principalAmount || 0), 0);
    const totalInterest = payments.reduce((sum, p) => sum + (p.interestAmount || 0), 0);

    return Response.json({
      billId,
      billName: bill[0].name,
      isDebt: bill[0].isDebt,
      payments: payments.map(p => ({
        ...p,
        transaction: p.transactionId ? transactionDetails[p.transactionId] : null,
      })),
      summary: {
        totalPayments: payments.length,
        totalPaid,
        totalPrincipal: bill[0].isDebt ? totalPrincipal : null,
        totalInterest: bill[0].isDebt ? totalInterest : null,
        remainingBalance: bill[0].isDebt ? bill[0].remainingBalance : null,
      },
    });
  } catch (error) {
    console.error('Error fetching bill payments:', error);
    return Response.json(
      { error: 'Failed to fetch bill payments' },
      { status: 500 }
    );
  }
}

