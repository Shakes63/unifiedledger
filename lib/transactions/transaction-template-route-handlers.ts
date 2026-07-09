/**
 * Transaction template routes: list/create and get/update/delete handlers plus their shared scoping.
 *
 * Consolidated from single-use shim files during the post-audit cleanup;
 * behavior is unchanged.
 */
import { and, eq, desc } from 'drizzle-orm';
import { handleRouteError } from '@/lib/api/route-helpers';
import { db } from '@/lib/db';
import { accounts, budgetCategories, transactionTemplates } from '@/lib/db/schema';
import { nanoid } from 'nanoid';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';

// ---------------------------------------------------------------------------
// from transaction-template-route-shared.ts
// ---------------------------------------------------------------------------
function mapTemplateRouteError(error: unknown, logLabel: string): Response {
  return handleRouteError(error, {
    defaultError: 'Internal server error',
    logLabel,
  });
}

async function findUserTemplate(userId: string, templateId: string) {
  const template = await db
    .select()
    .from(transactionTemplates)
    .where(and(eq(transactionTemplates.id, templateId), eq(transactionTemplates.userId, userId)))
    .limit(1);

  return template[0] ?? null;
}

async function validateTemplateLinksInHousehold(
  userId: string,
  householdId: string,
  accountId?: string,
  categoryId?: string
): Promise<Response | null> {
  if (accountId) {
    const account = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.id, accountId),
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId)
        )
      )
      .limit(1);

    if (account.length === 0) {
      return Response.json({ error: 'Account not found in household' }, { status: 404 });
    }
  }

  if (categoryId) {
    const category = await db
      .select({ id: budgetCategories.id })
      .from(budgetCategories)
      .where(
        and(
          eq(budgetCategories.id, categoryId),
          eq(budgetCategories.userId, userId),
          eq(budgetCategories.householdId, householdId)
        )
      )
      .limit(1);

    if (category.length === 0) {
      return Response.json({ error: 'Category not found in household' }, { status: 404 });
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// from transaction-template-collection-route-handler.ts
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// from transaction-template-id-route-handler.ts
// ---------------------------------------------------------------------------
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
