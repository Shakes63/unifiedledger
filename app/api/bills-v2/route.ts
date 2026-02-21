import { format } from 'date-fns';
import { and, eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { requireAuth } from '@/lib/auth-helpers';
import {
  buildCreateTemplateRequestFromLegacy,
  type LegacyAutopayConfig,
  type LegacyBillUpsertPayload,
  toLegacyBill,
  toLegacyInstance,
} from '@/lib/bills-v2/legacy-compat';
import {
  createBillTemplate,
  listBillTemplates,
  listOccurrences,
} from '@/lib/bills-v2/service';
import { toBillsV2Error } from '@/lib/bills-v2/route-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import {
  accounts,
  autopayRules,
  budgetCategories,
  merchants,
} from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

function toAutopayConfig(rule: typeof autopayRules.$inferSelect | undefined): LegacyAutopayConfig | null {
  if (!rule) return null;
  return {
    isEnabled: rule.isEnabled,
    payFromAccountId: rule.payFromAccountId,
    amountType: rule.amountType,
    fixedAmountCents: rule.fixedAmountCents,
    daysBeforeDue: rule.daysBeforeDue,
  };
}

async function upsertAutopayRule(
  templateId: string,
  householdId: string,
  config: LegacyAutopayConfig | null
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

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const isActiveParam = url.searchParams.get('isActive');
    const billTypeParam = url.searchParams.get('billType') as
      | 'expense'
      | 'income'
      | 'savings_transfer'
      | null;
    const classificationParam = url.searchParams.get('classification') as
      | 'subscription'
      | 'utility'
      | 'housing'
      | 'insurance'
      | 'loan_payment'
      | 'membership'
      | 'service'
      | 'other'
      | null;

    const templatesResult = await listBillTemplates({
      householdId,
      isActive: isActiveParam === null ? undefined : isActiveParam === 'true',
      billType: billTypeParam || undefined,
      classification: classificationParam || undefined,
      limit,
      offset,
    });

    const templateIds = templatesResult.data.map((template) => template.id);

    const [autopayRows, categoriesRows, merchantsRows, accountsRows, upcomingResult] = await Promise.all([
      templateIds.length > 0
        ? db
            .select()
            .from(autopayRules)
            .where(and(eq(autopayRules.householdId, householdId), inArray(autopayRules.templateId, templateIds)))
        : Promise.resolve([]),
      db
        .select()
        .from(budgetCategories)
        .where(eq(budgetCategories.householdId, householdId)),
      db
        .select()
        .from(merchants)
        .where(eq(merchants.householdId, householdId)),
      db
        .select()
        .from(accounts)
        .where(eq(accounts.householdId, householdId)),
      listOccurrences({
        userId,
        householdId,
        status: ['unpaid', 'partial'],
        from: format(new Date(), 'yyyy-MM-dd'),
        to: format(new Date(new Date().setMonth(new Date().getMonth() + 4)), 'yyyy-MM-dd'),
        limit: 5000,
        offset: 0,
      }),
    ]);

    const autopayMap = new Map(autopayRows.map((row) => [row.templateId, row]));
    const categoryMap = new Map(categoriesRows.map((row) => [row.id, row]));
    const merchantMap = new Map(merchantsRows.map((row) => [row.id, row]));
    const accountMap = new Map(accountsRows.map((row) => [row.id, row]));

    const upcomingByTemplateId = new Map<string, ReturnType<typeof toLegacyInstance>[]>();
    upcomingResult.data
      .sort((a, b) => a.occurrence.dueDate.localeCompare(b.occurrence.dueDate))
      .forEach((row) => {
        const entries = upcomingByTemplateId.get(row.occurrence.templateId) || [];
        if (entries.length >= 3) return;
        entries.push(toLegacyInstance(row.occurrence));
        upcomingByTemplateId.set(row.occurrence.templateId, entries);
      });

    const data = templatesResult.data.map((template) => {
      const bill = toLegacyBill(template, toAutopayConfig(autopayMap.get(template.id)));
      return {
        bill,
        category: bill.categoryId ? categoryMap.get(bill.categoryId) || null : null,
        merchant: bill.merchantId ? merchantMap.get(bill.merchantId) || null : null,
        account: bill.accountId ? accountMap.get(bill.accountId) || null : null,
        upcomingInstances: upcomingByTemplateId.get(template.id) || [],
      };
    });

    return Response.json({
      data,
      total: templatesResult.total,
      limit: templatesResult.limit,
      offset: templatesResult.offset,
    });
  } catch (error) {
    return toBillsV2Error(error, 'compat route GET');
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();
    const payload = (await request.json()) as LegacyBillUpsertPayload;
    const { householdId } = await getAndVerifyHousehold(
      request,
      userId,
      payload as unknown as Record<string, unknown>
    );

    const { template: createInput, autopay } = buildCreateTemplateRequestFromLegacy(payload);

    const created = await createBillTemplate(userId, householdId, createInput);
    await upsertAutopayRule(created.id, householdId, autopay);

    const bill = toLegacyBill(created, autopay);

    return Response.json({ bill, success: true }, { status: 201 });
  } catch (error) {
    return toBillsV2Error(error, 'compat route POST');
  }
}
