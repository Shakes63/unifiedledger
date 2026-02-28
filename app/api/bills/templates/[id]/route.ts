import { NextRequest } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import type {
  AutopayAmountType,
  UpdateBillTemplateRequest,
} from '@/lib/bills/contracts';
import { deleteBillTemplate, updateBillTemplate } from '@/lib/bills/service';
import { toBillsV2Error } from '@/lib/bills/route-helpers';
import { db } from '@/lib/db';
import {
  accounts,
  autopayRules,
  billOccurrences,
  billTemplates,
  budgetCategories,
  merchants,
} from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

interface BillAutopayConfig {
  isEnabled: boolean;
  payFromAccountId: string | null;
  amountType: AutopayAmountType;
  fixedAmountCents: number | null;
  daysBeforeDue: number;
}


function toAutopayConfig(rule: typeof autopayRules.$inferSelect | undefined): BillAutopayConfig | null {
  if (!rule) return null;
  return {
    isEnabled: rule.isEnabled,
    payFromAccountId: rule.payFromAccountId,
    amountType: rule.amountType as AutopayAmountType,
    fixedAmountCents: rule.fixedAmountCents,
    daysBeforeDue: rule.daysBeforeDue,
  };
}

async function upsertAutopayRule(
  templateId: string,
  householdId: string,
  config: BillAutopayConfig | null
) {
  const [existing] = await db
    .select()
    .from(autopayRules)
    .where(and(eq(autopayRules.templateId, templateId), eq(autopayRules.householdId, householdId)))
    .limit(1);

  if (!config || !config.isEnabled) {
    if (existing) {
      await db.delete(autopayRules).where(eq(autopayRules.id, existing.id));
    }
    return;
  }

  if (!config.payFromAccountId) {
    throw new Error('Autopay source account is required when autopay is enabled');
  }

  const values = {
    templateId,
    householdId,
    isEnabled: true,
    payFromAccountId: config.payFromAccountId,
    amountType: config.amountType,
    fixedAmountCents: config.amountType === 'fixed' ? config.fixedAmountCents ?? 0 : null,
    daysBeforeDue: config.daysBeforeDue,
    updatedAt: new Date().toISOString(),
  };

  if (existing) {
    await db
      .update(autopayRules)
      .set(values)
      .where(eq(autopayRules.id, existing.id));
    return;
  }

  await db.insert(autopayRules).values({
    id: nanoid(),
    createdAt: new Date().toISOString(),
    ...values,
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);
    const { id } = await context.params;

    const [template] = await db
      .select()
      .from(billTemplates)
      .where(and(eq(billTemplates.id, id), eq(billTemplates.householdId, householdId)))
      .limit(1);

    if (!template) {
      return Response.json({ error: 'Bill template not found' }, { status: 404 });
    }

    const [autopayRule, category, merchant, account, occurrences] = await Promise.all([
      db
        .select()
        .from(autopayRules)
        .where(and(eq(autopayRules.templateId, id), eq(autopayRules.householdId, householdId)))
        .limit(1)
        .then((rows) => rows[0]),
      template.categoryId
        ? db
            .select()
            .from(budgetCategories)
            .where(and(eq(budgetCategories.id, template.categoryId), eq(budgetCategories.householdId, householdId)))
            .limit(1)
            .then((rows) => rows[0] || null)
        : Promise.resolve(null),
      template.merchantId
        ? db
            .select()
            .from(merchants)
            .where(and(eq(merchants.id, template.merchantId), eq(merchants.householdId, householdId)))
            .limit(1)
            .then((rows) => rows[0] || null)
        : Promise.resolve(null),
      template.paymentAccountId
        ? db
            .select()
            .from(accounts)
            .where(and(eq(accounts.id, template.paymentAccountId), eq(accounts.householdId, householdId)))
            .limit(1)
            .then((rows) => rows[0] || null)
        : Promise.resolve(null),
      db
        .select()
        .from(billOccurrences)
        .where(and(eq(billOccurrences.templateId, id), eq(billOccurrences.householdId, householdId)))
        .orderBy(asc(billOccurrences.dueDate), asc(billOccurrences.createdAt)),
    ]);

    return Response.json({
      data: {
        template,
        occurrences,
        autopay: toAutopayConfig(autopayRule),
        category,
        merchant,
        account,
      },
    });
  } catch (error) {
    return toBillsV2Error(error, 'templates [id] GET');
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const body = (await request.json()) as UpdateBillTemplateRequest & {
      autopay?: BillAutopayConfig | null;
    };
    const { householdId } = await getAndVerifyHousehold(
      request,
      userId,
      body as unknown as Record<string, unknown>
    );
    const { id } = await context.params;

    const { autopay, ...templateInput } = body;
    const updated = await updateBillTemplate(id, householdId, templateInput);

    if (autopay !== undefined) {
      await upsertAutopayRule(id, householdId, autopay);
    }

    return Response.json({ data: updated });
  } catch (error) {
    return toBillsV2Error(error, 'templates [id] PUT');
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);
    const { id } = await context.params;

    await deleteBillTemplate(id, householdId);
    return Response.json({ success: true });
  } catch (error) {
    return toBillsV2Error(error, 'templates [id] DELETE');
  }
}
