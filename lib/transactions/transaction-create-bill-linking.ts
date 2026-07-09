/**
 * Bill auto-linking for the transaction CREATE flow.
 *
 * When an expense is created it can settle a bill occurrence. Matching runs in
 * priority order — explicit billInstanceId from the client, then bills charged
 * to the transaction's account, then general heuristics (name/amount/date) —
 * and the first hit records the payment through processLinkedBillPaymentWithLog.
 *
 * Consolidated from 9 single-use shim files (types / match-format / queries /
 * matches / additional-matches / stages / execution / flow / head) during the
 * post-audit cleanup; behavior is unchanged.
 */
import Decimal from 'decimal.js';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { billOccurrences, billTemplates } from '@/lib/db/schema';
import { findMatchingBillInstance } from '@/lib/bills/bill-matching-helpers';
import {
  findBestChargedAccountBillMatch,
  processLinkedBillPaymentWithLog,
} from '@/lib/transactions/transaction-bill-linking-helpers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateBillLinkMatch {
  linkedTemplateId: string;
  linkedOccurrenceId: string;
  templateName: string;
  notes: string;
  logMessage: (paymentStatus: string) => string;
}

interface BillLike {
  id: string;
  name: string;
  amountTolerance: number | null;
  expectedAmount: number;
}

interface BillInstanceLike {
  id: string;
  dueDate: string;
  expectedAmount: number;
}

interface BillLinkResult {
  linkedBillId: string | null;
  linkedInstanceId: string | null;
}

const EMPTY_BILL_LINK_RESULT: BillLinkResult = {
  linkedBillId: null,
  linkedInstanceId: null,
};

function formatCreateBillLinkMatch({
  templateId,
  occurrenceId,
  templateName,
  notes,
  logMessage,
}: {
  templateId: string;
  occurrenceId: string;
  templateName: string;
  notes: string;
  logMessage: (paymentStatus: string) => string;
}): CreateBillLinkMatch {
  return {
    linkedTemplateId: templateId,
    linkedOccurrenceId: occurrenceId,
    templateName,
    notes,
    logMessage,
  };
}

// ---------------------------------------------------------------------------
// Scoped bill queries (also used by the UPDATE flow's bill matching)
// ---------------------------------------------------------------------------

function centsToDollars(cents: number | null | undefined): number {
  return new Decimal(cents || 0).div(100).toNumber();
}

function bpsToPercent(bps: number | null | undefined): number | null {
  if (bps === null || bps === undefined) return null;
  return new Decimal(bps).div(100).toNumber();
}

function mapTemplateToBillLike(template: {
  id: string;
  name: string;
  defaultAmountCents: number;
  amountToleranceBps: number;
}): BillLike {
  return {
    id: template.id,
    name: template.name,
    amountTolerance: bpsToPercent(template.amountToleranceBps),
    expectedAmount: centsToDollars(template.defaultAmountCents),
  };
}

export async function findScopedBillById({
  billId,
  userId,
  householdId,
}: {
  billId: string;
  userId: string;
  householdId: string;
}): Promise<BillLike | null> {
  const [template] = await db
    .select({
      id: billTemplates.id,
      name: billTemplates.name,
      defaultAmountCents: billTemplates.defaultAmountCents,
      amountToleranceBps: billTemplates.amountToleranceBps,
    })
    .from(billTemplates)
    .where(
      and(
        eq(billTemplates.id, billId),
        eq(billTemplates.createdByUserId, userId),
        eq(billTemplates.householdId, householdId),
        eq(billTemplates.isActive, true),
        eq(billTemplates.billType, 'expense')
      )
    )
    .limit(1);

  return template ? mapTemplateToBillLike(template) : null;
}

export async function findScopedPendingBillInstanceById({
  billInstanceId,
  userId,
  householdId,
}: {
  billInstanceId: string;
  userId: string;
  householdId: string;
}): Promise<
  | {
      instance: BillInstanceLike;
      bill: BillLike;
    }
  | null
> {
  const [match] = await db
    .select({
      templateId: billTemplates.id,
      templateName: billTemplates.name,
      defaultAmountCents: billTemplates.defaultAmountCents,
      amountToleranceBps: billTemplates.amountToleranceBps,
      occurrenceId: billOccurrences.id,
      dueDate: billOccurrences.dueDate,
      amountDueCents: billOccurrences.amountDueCents,
    })
    .from(billOccurrences)
    .innerJoin(billTemplates, eq(billTemplates.id, billOccurrences.templateId))
    .where(
      and(
        eq(billOccurrences.id, billInstanceId),
        eq(billTemplates.createdByUserId, userId),
        eq(billTemplates.householdId, householdId),
        eq(billTemplates.billType, 'expense'),
        eq(billTemplates.isActive, true),
        inArray(billOccurrences.status, ['unpaid', 'partial', 'overdue'])
      )
    )
    .limit(1);

  if (!match) return null;

  return {
    bill: mapTemplateToBillLike({
      id: match.templateId,
      name: match.templateName,
      defaultAmountCents: match.defaultAmountCents,
      amountToleranceBps: match.amountToleranceBps,
    }),
    instance: {
      id: match.occurrenceId,
      dueDate: match.dueDate,
      expectedAmount: centsToDollars(match.amountDueCents),
    },
  };
}

async function listChargedAccountPendingBills({
  userId,
  householdId,
  accountId,
}: {
  userId: string;
  householdId: string;
  accountId: string;
}): Promise<
  Array<{
    bill: BillLike;
    instance: BillInstanceLike;
  }>
> {
  const rows = await db
    .select({
      templateId: billTemplates.id,
      templateName: billTemplates.name,
      defaultAmountCents: billTemplates.defaultAmountCents,
      amountToleranceBps: billTemplates.amountToleranceBps,
      occurrenceId: billOccurrences.id,
      dueDate: billOccurrences.dueDate,
      amountDueCents: billOccurrences.amountDueCents,
      status: billOccurrences.status,
    })
    .from(billTemplates)
    .innerJoin(billOccurrences, eq(billOccurrences.templateId, billTemplates.id))
    .where(
      and(
        eq(billTemplates.chargedToAccountId, accountId),
        eq(billTemplates.createdByUserId, userId),
        eq(billTemplates.householdId, householdId),
        eq(billTemplates.billType, 'expense'),
        eq(billTemplates.isActive, true),
        inArray(billOccurrences.status, ['unpaid', 'partial', 'overdue'])
      )
    )
    .orderBy(
      sql`CASE WHEN ${billOccurrences.status} = 'overdue' THEN 0 ELSE 1 END`,
      asc(billOccurrences.dueDate)
    );

  return rows.map((row) => ({
    bill: mapTemplateToBillLike({
      id: row.templateId,
      name: row.templateName,
      defaultAmountCents: row.defaultAmountCents,
      amountToleranceBps: row.amountToleranceBps,
    }),
    instance: {
      id: row.occurrenceId,
      dueDate: row.dueDate,
      expectedAmount: centsToDollars(row.amountDueCents),
    },
  }));
}

export async function findCategoryPendingBillMatch({
  userId,
  householdId,
  categoryId,
}: {
  userId: string;
  householdId: string;
  categoryId: string;
}): Promise<
  | {
      bill: BillLike;
      instance: BillInstanceLike;
    }
  | null
> {
  const [match] = await db
    .select({
      templateId: billTemplates.id,
      templateName: billTemplates.name,
      defaultAmountCents: billTemplates.defaultAmountCents,
      amountToleranceBps: billTemplates.amountToleranceBps,
      occurrenceId: billOccurrences.id,
      dueDate: billOccurrences.dueDate,
      amountDueCents: billOccurrences.amountDueCents,
      status: billOccurrences.status,
    })
    .from(billTemplates)
    .innerJoin(billOccurrences, eq(billOccurrences.templateId, billTemplates.id))
    .where(
      and(
        eq(billTemplates.createdByUserId, userId),
        eq(billTemplates.householdId, householdId),
        eq(billTemplates.billType, 'expense'),
        eq(billTemplates.isActive, true),
        eq(billTemplates.categoryId, categoryId),
        inArray(billOccurrences.status, ['unpaid', 'partial', 'overdue'])
      )
    )
    .orderBy(
      sql`CASE WHEN ${billOccurrences.status} = 'overdue' THEN 0 ELSE 1 END`,
      asc(billOccurrences.dueDate)
    )
    .limit(1);

  if (!match) return null;

  return {
    bill: mapTemplateToBillLike({
      id: match.templateId,
      name: match.templateName,
      defaultAmountCents: match.defaultAmountCents,
      amountToleranceBps: match.amountToleranceBps,
    }),
    instance: {
      id: match.occurrenceId,
      dueDate: match.dueDate,
      expectedAmount: centsToDollars(match.amountDueCents),
    },
  };
}

// ---------------------------------------------------------------------------
// Match stages (priority order)
// ---------------------------------------------------------------------------

interface MatchBaseParams {
  userId: string;
  householdId: string;
  accountId: string;
  description: string;
  amount: number;
  date: string;
  transactionId: string;
}

async function matchByExplicitBillInstance({
  billInstanceId,
  ...params
}: MatchBaseParams & { billInstanceId?: string }): Promise<CreateBillLinkMatch | null> {
  if (!billInstanceId) {
    return null;
  }

  const instance = await findScopedPendingBillInstanceById({
    billInstanceId,
    userId: params.userId,
    householdId: params.householdId,
  });

  if (!instance) {
    return null;
  }

  return formatCreateBillLinkMatch({
    templateId: instance.bill.id,
    occurrenceId: instance.instance.id,
    templateName: instance.bill.name,
    notes: `Bill payment: ${instance.bill.name}`,
    logMessage: (paymentStatus) =>
      `Bill payment processed: ${instance.bill.id}, Status: ${paymentStatus}`,
  });
}

async function matchByChargedAccount({
  userId,
  householdId,
  accountId,
  description,
  amount,
  date,
}: MatchBaseParams): Promise<CreateBillLinkMatch | null> {
  const chargedToBills = await listChargedAccountPendingBills({
    userId,
    householdId,
    accountId,
  });

  if (chargedToBills.length === 0) {
    return null;
  }

  const bestMatch = findBestChargedAccountBillMatch({
    chargedToBills,
    description,
    amount,
    date,
  });

  if (!bestMatch) {
    return null;
  }

  return formatCreateBillLinkMatch({
    templateId: bestMatch.bill.id,
    occurrenceId: bestMatch.instance.id,
    templateName: bestMatch.bill.name,
    notes: `Auto-matched from chargedToAccountId: ${bestMatch.bill.name}`,
    logMessage: (paymentStatus) =>
      `ChargedToAccountId match: ${bestMatch.bill.id}, Score: ${bestMatch.score}, Status: ${paymentStatus}`,
  });
}

async function matchByGeneralBillHeuristics({
  transactionId,
  userId,
  householdId,
  description,
  amount,
  date,
  type,
  appliedCategoryId,
}: {
  transactionId: string;
  userId: string;
  householdId: string;
  description: string;
  amount: number;
  date: string;
  type: string;
  appliedCategoryId?: string | null;
}): Promise<CreateBillLinkMatch | null> {
  const billMatch = await findMatchingBillInstance(
    {
      id: transactionId,
      description,
      amount,
      date,
      type,
      categoryId: appliedCategoryId,
    },
    userId,
    householdId,
    70
  );
  if (!billMatch) {
    return null;
  }

  const bill = await findScopedBillById({
    billId: billMatch.billId,
    userId,
    householdId,
  });
  if (!bill) {
    return null;
  }

  return formatCreateBillLinkMatch({
    templateId: billMatch.billId,
    occurrenceId: billMatch.instanceId,
    templateName: bill.name,
    notes: `Auto-matched bill payment: ${bill.name}`,
    logMessage: (paymentStatus) =>
      `Auto-matched bill payment: ${billMatch.billId}, Status: ${paymentStatus}`,
  });
}

async function findCreateBillLinkMatch({
  transactionId,
  userId,
  householdId,
  billInstanceId,
  accountId,
  description,
  amount,
  date,
  type,
  appliedCategoryId,
}: {
  transactionId: string;
  userId: string;
  householdId: string;
  billInstanceId?: string;
  accountId: string;
  description: string;
  amount: number;
  date: string;
  type: string;
  appliedCategoryId?: string | null;
}): Promise<CreateBillLinkMatch | null> {
  const explicitMatch = await matchByExplicitBillInstance({
    transactionId,
    userId,
    householdId,
    billInstanceId,
    accountId,
    description,
    amount,
    date,
  });
  if (explicitMatch) {
    return explicitMatch;
  }

  const chargedMatch = await matchByChargedAccount({
    transactionId,
    userId,
    householdId,
    accountId,
    description,
    amount,
    date,
  });
  if (chargedMatch) {
    return chargedMatch;
  }

  const generalMatch = await matchByGeneralBillHeuristics({
    transactionId,
    userId,
    householdId,
    description,
    amount,
    date,
    type,
    appliedCategoryId,
  });
  if (generalMatch) {
    return generalMatch;
  }

  // Category-only fallback is DISABLED (audit finding C-BILL-2): it linked a
  // transaction to the first pending occurrence of any bill sharing the category,
  // with no amount/name/date check, marking unrelated bills paid on ordinary
  // expenses. Phase 3 will reintroduce a gated version (amount + due-date + name).
  return null;
}

// ---------------------------------------------------------------------------
// Execution + entry point
// ---------------------------------------------------------------------------

async function executeCreateBillLinkMatch({
  match,
  transactionId,
  userId,
  householdId,
  accountId,
  amount,
  date,
}: {
  match: CreateBillLinkMatch;
  transactionId: string;
  userId: string;
  householdId: string;
  accountId: string;
  amount: number;
  date: string;
}): Promise<{ linkedBillId: string; linkedInstanceId: string }> {
  await processLinkedBillPaymentWithLog({
    transactionId,
    userId,
    householdId,
    accountId,
    amount,
    date,
    linkedTemplateId: match.linkedTemplateId,
    linkedOccurrenceId: match.linkedOccurrenceId,
    notes: match.notes,
    logScope: 'transactions:create',
    logMessage: match.logMessage,
  });

  return {
    linkedBillId: match.linkedTemplateId,
    linkedInstanceId: match.linkedOccurrenceId,
  };
}

export async function autoLinkCreatedExpenseBill({
  transactionId,
  userId,
  householdId,
  type,
  billInstanceId,
  accountId,
  description,
  amount,
  date,
  appliedCategoryId,
}: {
  transactionId: string;
  userId: string;
  householdId: string;
  type: string;
  billInstanceId?: string;
  accountId: string;
  description: string;
  amount: number;
  date: string;
  appliedCategoryId?: string | null;
}): Promise<BillLinkResult> {
  try {
    if (type !== 'expense') {
      return EMPTY_BILL_LINK_RESULT;
    }

    const match = await findCreateBillLinkMatch({
      transactionId,
      userId,
      householdId,
      billInstanceId,
      accountId,
      description,
      amount,
      date,
      type,
      appliedCategoryId,
    });
    if (!match) {
      return EMPTY_BILL_LINK_RESULT;
    }

    return executeCreateBillLinkMatch({
      match,
      transactionId,
      userId,
      householdId,
      accountId,
      amount,
      date,
    });
  } catch (error) {
    console.error('Error auto-linking bill:', error);
    return EMPTY_BILL_LINK_RESULT;
  }
}
