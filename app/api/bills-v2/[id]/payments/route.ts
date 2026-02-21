import { and, desc, eq, inArray } from 'drizzle-orm';

import { requireAuth } from '@/lib/auth-helpers';
import { centsToDollars } from '@/lib/bills-v2/legacy-compat';
import { toBillsV2Error } from '@/lib/bills-v2/route-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { billPaymentEvents, billTemplates, transactions } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);
    const { id } = await params;

    const [template] = await db
      .select({ id: billTemplates.id })
      .from(billTemplates)
      .where(and(eq(billTemplates.id, id), eq(billTemplates.householdId, householdId)))
      .limit(1);

    if (!template) {
      return Response.json({ error: 'Bill not found' }, { status: 404 });
    }

    const payments = await db
      .select()
      .from(billPaymentEvents)
      .where(and(eq(billPaymentEvents.templateId, id), eq(billPaymentEvents.householdId, householdId)))
      .orderBy(desc(billPaymentEvents.paymentDate), desc(billPaymentEvents.createdAt));

    const transactionIds = payments.map((payment) => payment.transactionId);
    const transactionRows =
      transactionIds.length > 0
        ? await db
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
        : [];

    const transactionMap = new Map(transactionRows.map((row) => [row.id, row]));

    return Response.json({
      billId: id,
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
      })),
      summary: {
        totalPayments: payments.length,
        totalPaid: centsToDollars(payments.reduce((sum, payment) => sum + payment.amountCents, 0)),
      },
    });
  } catch (error) {
    return toBillsV2Error(error, 'compat [id] payments GET');
  }
}
