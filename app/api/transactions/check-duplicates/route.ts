import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { transactions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { detectDuplicateTransactions } from '@/lib/duplicate-detection';

export const dynamic = 'force-dynamic';

interface CheckDuplicatesRequest {
  description: string;
  amount: number;
  date: string;
  descriptionThreshold?: number;
  amountThreshold?: number;
  dateRangeInDays?: number;
}

export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body: CheckDuplicatesRequest = await request.json();
    const {
      description,
      amount,
      date,
      descriptionThreshold = 0.7,
      amountThreshold = 0.05,
      dateRangeInDays = 7,
    } = body;

    if (!description || !amount || !date) {
      return Response.json(
        { error: 'Missing required fields: description, amount, date' },
        { status: 400 }
      );
    }

    // Fetch user's existing transactions
    const userTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId));

    // Detect duplicates
    const duplicates = detectDuplicateTransactions(
      description,
      amount,
      date,
      userTransactions
        .filter((tx) => tx.type !== null)
        .map((tx) => ({
          id: tx.id,
          description: tx.description,
          amount: tx.amount,
          date: tx.date,
          type: tx.type!,
        })),
      {
        descriptionThreshold,
        amountThreshold,
        dateRangeInDays,
      }
    );

    return Response.json({
      hasDuplicates: duplicates.length > 0,
      duplicateCount: duplicates.length,
      potentialMatches: duplicates,
      riskLevel: calculateRiskLevel(duplicates),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error checking duplicates:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function calculateRiskLevel(
  duplicates: Array<{ similarity: number }>
): 'low' | 'medium' | 'high' {
  if (duplicates.length === 0) {
    return 'low';
  }

  const maxSimilarity = Math.max(...duplicates.map((d) => d.similarity));

  if (maxSimilarity >= 90) {
    return 'high';
  } else if (maxSimilarity >= 75) {
    return 'medium';
  }
  return 'low';
}
