import { and, desc, eq, inArray } from 'drizzle-orm';

import { requireAuth } from '@/lib/auth-helpers';
import { toBillsV2Error } from '@/lib/bills/route-helpers';
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
      return Response.json({ error: 'Bill occurrence not found' }, { status: 404 });
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

    const totalPaidCents = payments.reduce((sum, payment) => sum + payment.amountCents, 0);
    const totalPrincipalCents = payments.reduce((sum, payment) => sum + (payment.principalCents || 0), 0);
    const totalInterestCents = payments.reduce((sum, payment) => sum + (payment.interestCents || 0), 0);

    return Response.json({
      data: {
        occurrence,
        payments,
        related: {
          transactions: transactionRows,
          accounts: accountRows,
        },
        summary: {
          totalPayments: payments.length,
          totalPaidCents,
          totalPrincipalCents,
          totalInterestCents,
          expectedAmountCents: occurrence.amountDueCents,
          remainingAmountCents: occurrence.amountRemainingCents,
          isFullyPaid: occurrence.status === 'paid' || occurrence.status === 'overpaid',
        },
      },
    });
  } catch (error) {
    return toBillsV2Error(error, 'occurrences [id] payments GET');
  }
}
