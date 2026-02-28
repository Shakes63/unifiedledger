import Decimal from 'decimal.js';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { billOccurrences, billTemplates } from '@/lib/db/schema';

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

export async function listChargedAccountPendingBills({
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
