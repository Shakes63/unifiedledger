import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { transactionTemplates, accounts, budgetCategories } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

// GET - List all transaction templates
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const templates = await db
      .select()
      .from(transactionTemplates)
      .where(eq(transactionTemplates.userId, userId))
      .orderBy(desc(transactionTemplates.lastUsedAt))
      .limit(limit)
      .offset(offset);

    return Response.json(templates);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Template fetch error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create a new transaction template
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const {
      name,
      description,
      accountId,
      categoryId,
      amount,
      type = 'expense',
      notes,
    } = body;

    // Validate required fields
    if (!name || !accountId || !amount || !type) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate account belongs to user
    const account = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.id, accountId),
          eq(accounts.userId, userId)
        )
      )
      .limit(1);

    if (account.length === 0) {
      return Response.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Validate category if provided
    if (categoryId) {
      const category = await db
        .select()
        .from(budgetCategories)
        .where(
          and(
            eq(budgetCategories.id, categoryId),
            eq(budgetCategories.userId, userId)
          )
        )
        .limit(1);

      if (category.length === 0) {
        return Response.json(
          { error: 'Category not found' },
          { status: 404 }
        );
      }
    }

    // Create template
    const templateId = nanoid();
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return Response.json(
      {
        id: templateId,
        message: 'Template created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Template creation error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
