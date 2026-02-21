import { and, eq } from 'drizzle-orm';

import { requireAuth } from '@/lib/auth-helpers';
import {
  centsToDollars,
  legacyPaymentStatusFromOccurrence,
  toLegacyBill,
  toLegacyInstance,
} from '@/lib/bills-v2/legacy-compat';
import { toBillsV2Error } from '@/lib/bills-v2/route-helpers';
import { payOccurrence } from '@/lib/bills-v2/service';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { autopayRules, billTemplates } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const payload = (await request.json()) as {
      accountId?: string;
      amount?: number;
      date?: string;
      notes?: string;
      allocationId?: string;
    };

    const { householdId } = await getAndVerifyHousehold(
      request,
      userId,
      payload as unknown as Record<string, unknown>
    );

    const { id } = await params;

    if (!payload.accountId) {
      return Response.json({ error: 'accountId is required' }, { status: 400 });
    }

    const amountCents = payload.amount !== undefined ? Math.max(0, Math.round(payload.amount * 100)) : undefined;

    const result = await payOccurrence(userId, householdId, id, {
      accountId: payload.accountId,
      amountCents,
      paymentDate: payload.date,
      notes: payload.notes,
      allocationId: payload.allocationId,
    });

    const [template, autopayRule] = await Promise.all([
      db
        .select()
        .from(billTemplates)
        .where(and(eq(billTemplates.id, result.occurrence.templateId), eq(billTemplates.householdId, householdId)))
        .limit(1)
        .then((rows) => rows[0]),
      db
        .select()
        .from(autopayRules)
        .where(
          and(
            eq(autopayRules.templateId, result.occurrence.templateId),
            eq(autopayRules.householdId, householdId)
          )
        )
        .limit(1)
        .then((rows) => rows[0]),
    ]);

    return Response.json({
      success: true,
      instance: toLegacyInstance(result.occurrence),
      bill: template
        ? toLegacyBill(template, autopayRule
          ? {
              isEnabled: autopayRule.isEnabled,
              payFromAccountId: autopayRule.payFromAccountId,
              amountType: autopayRule.amountType,
              fixedAmountCents: autopayRule.fixedAmountCents,
              daysBeforeDue: autopayRule.daysBeforeDue,
            }
          : null)
        : null,
      payment: {
        paymentId: result.paymentEvent.id,
        paymentStatus: legacyPaymentStatusFromOccurrence(result.occurrence.status),
        amountPaid: centsToDollars(result.paymentEvent.amountCents),
        totalPaid: centsToDollars(result.occurrence.amountPaidCents),
        remainingAmount: centsToDollars(result.occurrence.amountRemainingCents),
        principalAmount:
          result.paymentEvent.principalCents !== null
            ? centsToDollars(result.paymentEvent.principalCents)
            : null,
        interestAmount:
          result.paymentEvent.interestCents !== null
            ? centsToDollars(result.paymentEvent.interestCents)
            : null,
        taxDeductionInfo: null,
      },
      transaction: {
        id: result.paymentEvent.transactionId,
        accountId: payload.accountId,
        amount: centsToDollars(result.paymentEvent.amountCents),
        date: result.paymentEvent.paymentDate,
      },
    });
  } catch (error) {
    return toBillsV2Error(error, 'compat instance [id] pay POST');
  }
}
