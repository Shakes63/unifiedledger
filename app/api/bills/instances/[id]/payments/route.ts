/**
 * Bill Instance Payments API
 * 
 * GET /api/bills/instances/[id]/payments - Get payment history for a specific bill instance
 */

import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { billInstances, billPayments, transactions, accounts } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { id: instanceId } = await params;

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

    // Verify bill instance exists and belongs to user's household
    const instance = await db
      .select()
      .from(billInstances)
      .where(
        and(
          eq(billInstances.id, instanceId),
          eq(billInstances.userId, userId),
          eq(billInstances.householdId, householdId)
        )
      )
      .limit(1);

    if (!instance.length) {
      return Response.json(
        { error: 'Bill instance not found' },
        { status: 404 }
      );
    }

    // Get all payments for this instance
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
          eq(billPayments.billInstanceId, instanceId),
          eq(billPayments.userId, userId),
          eq(billPayments.householdId, householdId)
        )
      )
      .orderBy(desc(billPayments.paymentDate));

    // Fetch linked transaction and account details
    const transactionIds = payments
      .filter(p => p.transactionId)
      .map(p => p.transactionId as string);

    const linkedAccountIds = payments
      .filter(p => p.linkedAccountId)
      .map(p => p.linkedAccountId as string);

    // Get unique account IDs (including from payments and transactions)
    const allAccountIds = [...new Set(linkedAccountIds)];

    let transactionDetails: Record<string, { description: string; accountId: string }> = {};
    let accountDetails: Record<string, { name: string; type: string }> = {};

    // Fetch transactions
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

      const relevantTxns = txns.filter(t => transactionIds.includes(t.id));
      transactionDetails = Object.fromEntries(
        relevantTxns.map(t => [t.id, { description: t.description, accountId: t.accountId }])
      );

      // Add transaction account IDs to the list
      relevantTxns.forEach(t => {
        if (t.accountId && !allAccountIds.includes(t.accountId)) {
          allAccountIds.push(t.accountId);
        }
      });
    }

    // Fetch accounts
    if (allAccountIds.length > 0) {
      const accts = await db
        .select({
          id: accounts.id,
          name: accounts.name,
          type: accounts.type,
        })
        .from(accounts)
        .where(
          and(
            eq(accounts.userId, userId),
            eq(accounts.householdId, householdId)
          )
        );

      const relevantAccts = accts.filter(a => allAccountIds.includes(a.id));
      accountDetails = Object.fromEntries(
        relevantAccts.map(a => [a.id, { name: a.name, type: a.type }])
      );
    }

    // Calculate totals for this instance
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalPrincipal = payments.reduce((sum, p) => sum + (p.principalAmount || 0), 0);
    const totalInterest = payments.reduce((sum, p) => sum + (p.interestAmount || 0), 0);

    return Response.json({
      instanceId,
      billId: instance[0].billId,
      dueDate: instance[0].dueDate,
      expectedAmount: instance[0].expectedAmount,
      status: instance[0].status,
      paymentStatus: instance[0].paymentStatus,
      paidAmount: instance[0].paidAmount,
      remainingAmount: instance[0].remainingAmount,
      payments: payments.map(p => ({
        ...p,
        transaction: p.transactionId ? transactionDetails[p.transactionId] : null,
        linkedAccount: p.linkedAccountId ? accountDetails[p.linkedAccountId] : null,
      })),
      summary: {
        totalPayments: payments.length,
        totalPaid,
        totalPrincipal,
        totalInterest,
        expectedAmount: instance[0].expectedAmount,
        remainingAmount: instance[0].remainingAmount || (instance[0].expectedAmount - totalPaid),
        isFullyPaid: instance[0].paymentStatus === 'paid' || instance[0].paymentStatus === 'overpaid',
      },
    });
  } catch (error) {
    console.error('Error fetching instance payments:', error);
    return Response.json(
      { error: 'Failed to fetch instance payments' },
      { status: 500 }
    );
  }
}

