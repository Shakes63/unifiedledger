import { desc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { transactionTemplates } from '@/lib/db/schema';
import {
  mapTemplateRouteError,
  validateTemplateLinksInHousehold,
} from '@/lib/transactions/transaction-template-route-shared';

export async function handleListTransactionTemplates(request: Request): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const templates = await db
      .select()
      .from(transactionTemplates)
      .where(eq(transactionTemplates.userId, userId))
      .orderBy(desc(transactionTemplates.lastUsedAt))
      .limit(limit)
      .offset(offset);

    return Response.json(templates);
  } catch (error) {
    return mapTemplateRouteError(error, 'Template fetch error:');
  }
}

export async function handleCreateTransactionTemplate(request: Request): Promise<Response> {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();

    const {
      accountId,
      amount,
      categoryId,
      description,
      name,
      notes,
      type = 'expense',
    } = body;

    if (!name || !accountId || !amount || !type) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

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

    const templateId = nanoid();
    const now = new Date().toISOString();

    await db.insert(transactionTemplates).values({
      id: templateId,
      userId,
      name,
      description: description || null,
      accountId,
      categoryId: categoryId || null,
      amount: parseFloat(amount),
      type,
      notes: notes || null,
      usageCount: 0,
      lastUsedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    return Response.json({ id: templateId, message: 'Template created successfully' }, { status: 201 });
  } catch (error) {
    return mapTemplateRouteError(error, 'Template creation error:');
  }
}
