import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { savingsGoalContributions, savingsGoals, transactions, accounts } from '@/lib/db/schema';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import Decimal from 'decimal.js';

export const dynamic = 'force-dynamic';

interface ContributionWithDetails {
  id: string;
  transactionId: string;
  amount: number;
  createdAt: string;
  transactionDescription?: string | null;
  transactionDate?: string | null;
  accountName?: string | null;
}

interface ContributionsResponse {
  contributions: ContributionWithDetails[];
  total: number;
  runningTotal: number;
  goal: {
    id: string;
    name: string;
    color: string;
    targetAmount: number;
    currentAmount: number;
  };
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * GET /api/savings-goals/[id]/contributions
 * Get contribution history for a specific savings goal
 * 
 * Query params:
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 * - startDate: ISO date string (optional)
 * - endDate: ISO date string (optional)
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { id: goalId } = await context.params;

    // Get and validate household
    const householdId = getHouseholdIdFromRequest(request);
    await requireHouseholdAuth(userId, householdId);
    if (!householdId) {
      return Response.json(
        { error: 'Household ID is required' },
        { status: 400 }
      );
    }

    // Verify goal belongs to household
    const [goal] = await db
      .select({
        id: savingsGoals.id,
        name: savingsGoals.name,
        color: savingsGoals.color,
        targetAmount: savingsGoals.targetAmount,
        currentAmount: savingsGoals.currentAmount,
        householdId: savingsGoals.householdId,
      })
      .from(savingsGoals)
      .where(eq(savingsGoals.id, goalId));

    if (!goal) {
      return Response.json(
        { error: 'Goal not found' },
        { status: 404 }
      );
    }

    if (goal.householdId !== householdId) {
      return Response.json(
        { error: 'Goal does not belong to this household' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    // Build conditions
    const conditions = [
      eq(savingsGoalContributions.goalId, goalId),
      eq(savingsGoalContributions.householdId, householdId),
    ];

    if (startDate) {
      conditions.push(gte(savingsGoalContributions.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(savingsGoalContributions.createdAt, endDate));
    }

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(savingsGoalContributions)
      .where(and(...conditions));

    const totalCount = countResult?.count || 0;

    // Get contributions with transaction details
    const contributionsData = await db
      .select({
        id: savingsGoalContributions.id,
        transactionId: savingsGoalContributions.transactionId,
        amount: savingsGoalContributions.amount,
        createdAt: savingsGoalContributions.createdAt,
        transactionDescription: transactions.description,
        transactionDate: transactions.date,
        accountId: transactions.accountId,
      })
      .from(savingsGoalContributions)
      .leftJoin(transactions, eq(savingsGoalContributions.transactionId, transactions.id))
      .where(and(...conditions))
      .orderBy(desc(savingsGoalContributions.createdAt))
      .limit(limit)
      .offset(offset);

    // Get account names for the contributions
    const accountIds = [...new Set(contributionsData.map(c => c.accountId).filter(Boolean))];
    let accountMap = new Map<string, string>();

    if (accountIds.length > 0) {
      const accountsData = await db
        .select({ id: accounts.id, name: accounts.name })
        .from(accounts)
        .where(sql`${accounts.id} IN (${sql.join(accountIds as string[], sql`, `)})`);
      
      accountMap = new Map(accountsData.map(a => [a.id, a.name]));
    }

    // Map contributions with account names
    const contributions: ContributionWithDetails[] = contributionsData.map(c => ({
      id: c.id,
      transactionId: c.transactionId,
      amount: c.amount,
      createdAt: c.createdAt || new Date().toISOString(),
      transactionDescription: c.transactionDescription,
      transactionDate: c.transactionDate,
      accountName: c.accountId ? accountMap.get(c.accountId) || null : null,
    }));

    // Calculate running total (cumulative sum up to this point in time)
    const runningTotal = contributions.reduce(
      (sum, c) => new Decimal(sum).plus(c.amount).toNumber(),
      0
    );

    const response: ContributionsResponse = {
      contributions,
      total: totalCount,
      runningTotal,
      goal: {
        id: goal.id,
        name: goal.name,
        color: goal.color || '#10b981',
        targetAmount: goal.targetAmount,
        currentAmount: goal.currentAmount || 0,
      },
      pagination: {
        limit,
        offset,
        hasMore: offset + contributions.length < totalCount,
      },
    };

    return Response.json(response);
  } catch (error) {
    console.error('Error fetching goal contributions:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return Response.json(
      { error: 'Failed to fetch contributions' },
      { status: 500 }
    );
  }
}

