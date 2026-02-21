import { and, desc, eq, inArray } from 'drizzle-orm';

import { requireAuth } from '@/lib/auth-helpers';
import { centsToDollars, legacyPaymentStatusFromOccurrence } from '@/lib/bills-v2/legacy-compat';
import { toBillsV2Error } from '@/lib/bills-v2/route-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import {
  accounts,
  billOccurrences,
  billPaymentEvents,
  transactions,
} from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);
    const { id } = await params;

    const [occurrence] = await db
      .select()
      .from(billOccurrences)
      .where(and(eq(billOccurrences.id, id), eq(billOccurrences.householdId, householdId)))
      .limit(1);

    if (!occurrence) {
      return Response.json({ error: 'Bill instance not found' }, { status: 404 });
    }

    const payments = await db
      .select()
      .from(billPaymentEvents)
      .where(and(eq(billPaymentEvents.occurrenceId, id), eq(billPaymentEvents.householdId, householdId)))
      .orderBy(desc(billPaymentEvents.paymentDate), desc(billPaymentEvents.createdAt));

    const transactionIds = payments.map((payment) => payment.transactionId);
    const accountIds = payments
      .map((payment) => payment.sourceAccountId)
      .filter((accountId): accountId is string => !!accountId);

    const [transactionRows, accountRows] = await Promise.all([
      transactionIds.length > 0
        ? db
            .select({
              id: transactions.id,
              description: transactions.description,
              accountId: transactions.accountId,
            })
            .from(transactions)
            .where(
              and(
                eq(transactions.householdId, householdId),
                inArray(transactions.id, transactionIds)
              )
            )
        : Promise.resolve([]),
      accountIds.length > 0
        ? db
            .select({
              id: accounts.id,
              name: accounts.name,
              type: accounts.type,
            })
            .from(accounts)
            .where(and(eq(accounts.householdId, householdId), inArray(accounts.id, accountIds)))
        : Promise.resolve([]),
    ]);

    const transactionMap = new Map(transactionRows.map((row) => [row.id, row]));
    const accountMap = new Map(accountRows.map((row) => [row.id, row]));

    const totalPaidCents = payments.reduce((sum, payment) => sum + payment.amountCents, 0);
    const totalPrincipalCents = payments.reduce((sum, payment) => sum + (payment.principalCents || 0), 0);
    const totalInterestCents = payments.reduce((sum, payment) => sum + (payment.interestCents || 0), 0);

    return Response.json({
      instanceId: id,
      billId: occurrence.templateId,
      dueDate: occurrence.dueDate,
      expectedAmount: centsToDollars(occurrence.amountDueCents),
      status: occurrence.status,
      paymentStatus: legacyPaymentStatusFromOccurrence(occurrence.status),
      paidAmount: centsToDollars(occurrence.amountPaidCents),
      remainingAmount: centsToDollars(occurrence.amountRemainingCents),
      payments: payments.map((payment) => ({
        id: payment.id,
        billId: payment.templateId,
        billInstanceId: payment.occurrenceId,
        transactionId: payment.transactionId,
        amount: centsToDollars(payment.amountCents),
        principalAmount: payment.principalCents !== null ? centsToDollars(payment.principalCents) : null,
        interestAmount: payment.interestCents !== null ? centsToDollars(payment.interestCents) : null,
        paymentDate: payment.paymentDate,
        paymentMethod: payment.paymentMethod,
        linkedAccountId: payment.sourceAccountId,
        balanceBeforePayment:
          payment.balanceBeforeCents !== null ? centsToDollars(payment.balanceBeforeCents) : null,
        balanceAfterPayment:
          payment.balanceAfterCents !== null ? centsToDollars(payment.balanceAfterCents) : null,
        notes: payment.notes,
        createdAt: payment.createdAt,
        transaction: transactionMap.has(payment.transactionId)
          ? {
              description: transactionMap.get(payment.transactionId)?.description || '',
              accountId: transactionMap.get(payment.transactionId)?.accountId || '',
            }
          : null,
        linkedAccount:
          payment.sourceAccountId && accountMap.has(payment.sourceAccountId)
            ? {
                name: accountMap.get(payment.sourceAccountId)?.name || '',
                type: accountMap.get(payment.sourceAccountId)?.type || '',
              }
            : null,
      })),
      summary: {
        totalPayments: payments.length,
        totalPaid: centsToDollars(totalPaidCents),
        totalPrincipal: centsToDollars(totalPrincipalCents),
        totalInterest: centsToDollars(totalInterestCents),
        expectedAmount: centsToDollars(occurrence.amountDueCents),
        remainingAmount: centsToDollars(occurrence.amountRemainingCents),
        isFullyPaid: occurrence.status === 'paid' || occurrence.status === 'overpaid',
      },
    });
  } catch (error) {
    return toBillsV2Error(error, 'compat instance [id] payments GET');
  }
}
