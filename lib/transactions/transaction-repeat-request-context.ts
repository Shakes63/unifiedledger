import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { loadRepeatTemplateAndAccount } from '@/lib/transactions/transaction-repeat-template-load';
import { validateRepeatRequest } from '@/lib/transactions/transaction-repeat-request';

export async function loadRepeatRequestContext(request: Request): Promise<
  | {
      userId: string;
      householdId: string;
      requiredTemplateId: string;
      tmpl: NonNullable<Awaited<ReturnType<typeof loadRepeatTemplateAndAccount>>['template']>;
      account: NonNullable<Awaited<ReturnType<typeof loadRepeatTemplateAndAccount>>['account']>;
      body: Record<string, unknown>;
    }
  | Response
> {
  const { userId } = await requireAuth();
  const body = (await request.json()) as Record<string, unknown>;
  const templateId = typeof body.templateId === 'string' ? body.templateId : undefined;

  const householdId = getHouseholdIdFromRequest(request, body as { householdId?: string });
  await requireHouseholdAuth(userId, householdId);

  const requestValidationError = validateRepeatRequest({
    householdId,
    templateId,
  });
  if (requestValidationError) {
    return requestValidationError;
  }

  const scopedHouseholdId = householdId as string;
  const requiredTemplateId = templateId as string;

  const { template: tmpl, account } = await loadRepeatTemplateAndAccount({
    userId,
    householdId: scopedHouseholdId,
    templateId: requiredTemplateId,
  });

  if (!tmpl) {
    return Response.json({ error: 'Template not found' }, { status: 404 });
  }

  if (!account) {
    return Response.json({ error: 'Account not found in household' }, { status: 404 });
  }

  return {
    userId,
    householdId: scopedHouseholdId,
    requiredTemplateId,
    tmpl,
    account,
    body,
  };
}
