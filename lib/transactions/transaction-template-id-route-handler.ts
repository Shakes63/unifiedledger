import { and, eq } from 'drizzle-orm';

import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { transactionTemplates } from '@/lib/db/schema';
import {
  findUserTemplate,
  mapTemplateRouteError,
  validateTemplateLinksInHousehold,
} from '@/lib/transactions/transaction-template-route-shared';

export async function handleGetTransactionTemplate(
  request: Request,
  templateId: string
): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    void request;

    const template = await findUserTemplate(userId, templateId);
    if (!template) {
      return Response.json({ error: 'Template not found' }, { status: 404 });
    }

    return Response.json(template);
  } catch (error) {
    return mapTemplateRouteError(error, 'Template fetch error:');
  }
}

export async function handleUpdateTransactionTemplate(
  request: Request,
  templateId: string
): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const existing = await findUserTemplate(userId, templateId);

    if (!existing) {
      return Response.json({ error: 'Template not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      accountId,
      amount,
      categoryId,
      description,
      name,
      notes,
      type,
    } = body;

    const { householdId } = await getAndVerifyHousehold(request, userId, body);
    const linkValidationError = await validateTemplateLinksInHousehold(
      userId,
      householdId,
      accountId,
      categoryId
    );

    if (linkValidationError) {
      return linkValidationError;
    }

    const updates: Partial<typeof transactionTemplates.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (accountId !== undefined) updates.accountId = accountId;
    if (categoryId !== undefined) updates.categoryId = categoryId;
    if (amount !== undefined) updates.amount = parseFloat(amount);
    if (type !== undefined) updates.type = type;
    if (notes !== undefined) updates.notes = notes;

    await db
      .update(transactionTemplates)
      .set(updates)
      .where(and(eq(transactionTemplates.id, templateId), eq(transactionTemplates.userId, userId)));

    return Response.json({ message: 'Template updated successfully' });
  } catch (error) {
    return mapTemplateRouteError(error, 'Template update error:');
  }
}

export async function handleDeleteTransactionTemplate(
  request: Request,
  templateId: string
): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    void request;

    const existing = await findUserTemplate(userId, templateId);
    if (!existing) {
      return Response.json({ error: 'Template not found' }, { status: 404 });
    }

    await db
      .delete(transactionTemplates)
      .where(and(eq(transactionTemplates.id, templateId), eq(transactionTemplates.userId, userId)));

    return Response.json({ message: 'Template deleted successfully' });
  } catch (error) {
    return mapTemplateRouteError(error, 'Template deletion error:');
  }
}
