import { NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import type {
  BillClassification,
  BillType,
  CreateBillTemplateRequest,
  AutopayAmountType,
} from '@/lib/bills/contracts';
import { createBillTemplate, listBillTemplates } from '@/lib/bills/service';
import { toBillsV2Error } from '@/lib/bills/route-helpers';
import { db } from '@/lib/db';
import { autopayRules } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

interface BillAutopayConfig {
  isEnabled: boolean;
  payFromAccountId: string | null;
  amountType: AutopayAmountType;
  fixedAmountCents: number | null;
  daysBeforeDue: number;
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

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const isActiveParam = request.nextUrl.searchParams.get('isActive');
    const isActive =
      isActiveParam === null ? undefined : isActiveParam.toLowerCase() === 'true';

    const billTypeParam = request.nextUrl.searchParams.get('billType');
    const classificationParam = request.nextUrl.searchParams.get('classification');
    const limitParam = request.nextUrl.searchParams.get('limit');
    const offsetParam = request.nextUrl.searchParams.get('offset');

    const result = await listBillTemplates({
      householdId,
      isActive,
      billType: (billTypeParam as BillType | null) ?? undefined,
      classification: (classificationParam as BillClassification | null) ?? undefined,
      limit: limitParam ? parseInt(limitParam, 10) : undefined,
      offset: offsetParam ? parseInt(offsetParam, 10) : undefined,
    });

    return Response.json(result);
  } catch (error) {
    return toBillsV2Error(error, 'templates GET');
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth();
    const body = (await request.json()) as CreateBillTemplateRequest & {
      autopay?: BillAutopayConfig | null;
    };
    const { householdId } = await getAndVerifyHousehold(
      request,
      userId,
      body as unknown as Record<string, unknown>
    );

    const { autopay = null, ...templateInput } = body;
    const created = await createBillTemplate(userId, householdId, templateInput);
    await upsertAutopayRule(created.id, householdId, autopay);

    return Response.json({ data: created }, { status: 201 });
  } catch (error) {
    return toBillsV2Error(error, 'templates POST');
  }
}
