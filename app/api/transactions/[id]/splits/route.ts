import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { transactions, transactionSplits, budgetCategories } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import {
  amountToCents,
  buildTransactionAmountFields,
} from '@/lib/transactions/money-movement-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/transactions/[id]/splits
 * Get all splits for a specific transaction
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: transactionId } = await params;
  try {
    const { userId } = await requireAuth();

    // Get and validate household
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);

    // TypeScript: householdId is guaranteed to be non-null after requireHouseholdAuth
    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    // Verify transaction exists and belongs to user AND household
    const transaction = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.id, transactionId),
          eq(transactions.userId, userId),
          eq(transactions.householdId, householdId)
        )
      )
      .limit(1);

    if (transaction.length === 0) {
      return Response.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Get all splits (filter by household)
    const splits = await db
      .select()
      .from(transactionSplits)
      .where(
        and(
          eq(transactionSplits.transactionId, transactionId),
          eq(transactionSplits.userId, userId),
          eq(transactionSplits.householdId, householdId)
        )
      )
      .orderBy(transactionSplits.sortOrder);

    return Response.json(splits);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && (
      error.message.includes('Household') ||
      error.message.includes('member')
    )) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Error fetching splits:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/transactions/[id]/splits
 * Create a new split for a transaction
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: transactionId } = await params;
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const {
      categoryId,
      amount,
      percentage,
      isPercentage = false,
      description,
      notes,
      sortOrder = 0,
    } = body;

    // Get and validate household
    const householdId = getHouseholdIdFromRequest(request, body);
    await requireHouseholdAuth(userId, householdId);

    // TypeScript: householdId is guaranteed to be non-null after requireHouseholdAuth
    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!categoryId || (isPercentage && !percentage) || (!isPercentage && !amount)) {
      return Response.json(
        { error: 'Missing required fields (categoryId and amount or percentage)' },
        { status: 400 }
      );
    }

    // Verify transaction exists and belongs to user AND household
    const transaction = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.id, transactionId),
          eq(transactions.userId, userId),
          eq(transactions.householdId, householdId)
        )
      )
      .limit(1);

    if (transaction.length === 0) {
      return Response.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Verify category exists and belongs to household
    const category = await db
      .select()
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
      return Response.json(
        { error: 'Category not found in household' },
        { status: 404 }
      );
    }

    // Create the split (inherit householdId from parent transaction)
    const splitId = nanoid();
    const now = new Date().toISOString();
    const splitAmountCents = amountToCents(isPercentage ? 0 : amount);

    await db.insert(transactionSplits).values({
      id: splitId,
      userId,
      householdId: householdId!, // Inherit from parent transaction
      transactionId,
      categoryId,
      ...buildTransactionAmountFields(splitAmountCents),
      percentage: isPercentage ? percentage : 0,
      isPercentage,
      description,
      notes,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    });

    // Mark parent transaction as split if it isn't already
    if (!transaction[0]!.isSplit) {
      await db
        .update(transactions)
        .set({
          isSplit: true,
          updatedAt: now,
        })
        .where(eq(transactions.id, transactionId));
    }

    // Fetch and return the created split
    const newSplit = await db
      .select()
      .from(transactionSplits)
      .where(eq(transactionSplits.id, splitId))
      .limit(1);

    return Response.json(newSplit[0], { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && (
      error.message.includes('Household') ||
      error.message.includes('member')
    )) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Error creating split:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
