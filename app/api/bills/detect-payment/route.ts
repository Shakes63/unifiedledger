import { differenceInDays, parseISO } from 'date-fns';
import { and, eq, inArray } from 'drizzle-orm';

import { requireAuth } from '@/lib/auth-helpers';
import { toBillsV2Error } from '@/lib/bills/route-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { accounts, billOccurrences, billTemplates } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

const CREDIT_ACCOUNT_TYPES = ['credit', 'line_of_credit'];

interface DetectionResult {
  detectedBill: {
    templateId: string;
    occurrenceId: string;
    templateName: string;
    expectedAmountCents: number;
    dueDate: string;
    status: 'unpaid' | 'overdue' | 'partial';
    paidAmountCents: number;
    remainingAmountCents: number;
    linkedAccountName: string;
  } | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  reason: string;
  isCreditAccount: boolean;
}

type OutstandingOccurrence = {
  id: string;
  templateId: string;
  dueDate: string;
  status: 'unpaid' | 'partial' | 'paid' | 'overpaid' | 'overdue' | 'skipped';
  amountDueCents: number;
  amountPaidCents: number;
  amountRemainingCents: number;
};
type LinkedTemplate = { id: string; name: string };

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const dateToleranceDays = Number(searchParams.get('dateToleranceDays') || '14');

    if (!accountId) {
      return Response.json({ error: 'accountId query parameter is required' }, { status: 400 });
    }

    const [destinationAccount] = await db
      .select({ id: accounts.id, name: accounts.name, type: accounts.type })
      .from(accounts)
      .where(and(eq(accounts.id, accountId), eq(accounts.householdId, householdId)))
      .limit(1);

    if (!destinationAccount) {
      return Response.json({
        detectedBill: null,
        confidence: 'none',
        reason: 'Destination account not found',
        isCreditAccount: false,
      } satisfies DetectionResult);
    }

    if (!CREDIT_ACCOUNT_TYPES.includes(destinationAccount.type)) {
      return Response.json({
        detectedBill: null,
        confidence: 'none',
        reason: '',
        isCreditAccount: false,
      } satisfies DetectionResult);
    }

    const linkedTemplates: LinkedTemplate[] = await db
      .select({
        id: billTemplates.id,
        name: billTemplates.name,
      })
      .from(billTemplates)
      .where(
        and(
          eq(billTemplates.householdId, householdId),
          eq(billTemplates.linkedLiabilityAccountId, accountId),
          eq(billTemplates.isActive, true)
        )
      );

    if (linkedTemplates.length === 0) {
      return Response.json({
        detectedBill: null,
        confidence: 'low',
        reason: `No payment bill is linked to "${destinationAccount.name}". Transfers will still reduce the balance.`,
        isCreditAccount: true,
      } satisfies DetectionResult);
    }

    const templateIds = linkedTemplates.map((template) => template.id);
    const outstanding = (await db
      .select()
      .from(billOccurrences)
      .where(
        and(
          eq(billOccurrences.householdId, householdId),
          inArray(billOccurrences.templateId, templateIds),
          inArray(billOccurrences.status, ['unpaid', 'partial', 'overdue'])
        )
      )) as OutstandingOccurrence[];

    if (outstanding.length === 0) {
      return Response.json({
        detectedBill: null,
        confidence: 'medium',
        reason: `Payment bill "${linkedTemplates[0].name}" exists but has no unpaid instances.`,
        isCreditAccount: true,
      } satisfies DetectionResult);
    }

    const today = new Date();

    let bestOccurrence: OutstandingOccurrence | null = null;
    let bestTemplate: LinkedTemplate | null = null;
    let bestDateDiff = 0;
    let bestPriority = Number.NEGATIVE_INFINITY;

    outstanding.forEach((occurrence) => {
      const template = linkedTemplates.find((item) => item.id === occurrence.templateId);
      if (!template) return;

      const dueDate = parseISO(occurrence.dueDate);
      const dateDiff = differenceInDays(dueDate, today);
      const absDateDiff = Math.abs(dateDiff);

      if (absDateDiff > dateToleranceDays) return;

      let priority = 100 - absDateDiff;
      if (occurrence.status === 'overdue') priority += 50;
      if (occurrence.status === 'partial') priority += 25;
      if (dateDiff >= 0 && dateDiff <= 7) priority += 30;

      if (priority > bestPriority) {
        bestOccurrence = occurrence;
        bestTemplate = template;
        bestDateDiff = dateDiff;
        bestPriority = priority;
      }
    });

    if (!bestOccurrence || !bestTemplate) {
      return Response.json({
        detectedBill: null,
        confidence: 'low',
        reason: `Payment bill "${linkedTemplates[0].name}" has upcoming instances but none due within ${dateToleranceDays} days.`,
        isCreditAccount: true,
      } satisfies DetectionResult);
    }

    const occurrence = bestOccurrence as OutstandingOccurrence;
    const template = bestTemplate as LinkedTemplate;
    const dateDiff = bestDateDiff;

    const status: 'unpaid' | 'overdue' | 'partial' =
      occurrence.status === 'overdue'
        ? 'overdue'
        : occurrence.status === 'partial'
          ? 'partial'
          : 'unpaid';

    let confidence: DetectionResult['confidence'];
    let reason: string;

    if (status === 'overdue') {
      confidence = 'high';
      reason = `This transfer will pay your overdue "${template.name}" bill (${Math.abs(dateDiff)} days past due)`;
    } else if (status === 'partial') {
      confidence = 'high';
      reason = `This transfer can complete your partial "${template.name}" bill payment`;
    } else if (Math.abs(dateDiff) <= 3) {
      confidence = 'high';
      reason = `This transfer likely matches your "${template.name}" bill due ${dateDiff === 0 ? 'today' : `in ${dateDiff} days`}`;
    } else if (Math.abs(dateDiff) <= 7) {
      confidence = 'medium';
      reason = `This transfer may match your "${template.name}" bill due soon`;
    } else {
      confidence = 'low';
      reason = `Found payment bill "${template.name}" due in ${Math.abs(dateDiff)} days`;
    }

    return Response.json({
      detectedBill: {
        templateId: template.id,
        occurrenceId: occurrence.id,
        templateName: template.name,
        expectedAmountCents: occurrence.amountDueCents,
        dueDate: occurrence.dueDate,
        status,
        paidAmountCents: occurrence.amountPaidCents,
        remainingAmountCents: occurrence.amountRemainingCents,
        linkedAccountName: destinationAccount.name,
      },
      confidence,
      reason,
      isCreditAccount: true,
    } satisfies DetectionResult);
  } catch (error) {
    return toBillsV2Error(error, 'detect-payment GET');
  }
}
