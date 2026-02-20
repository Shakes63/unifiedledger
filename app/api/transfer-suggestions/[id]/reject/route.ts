import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { transferSuggestions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { handleRouteError } from '@/lib/api/route-helpers';

/**
 * POST /api/transfer-suggestions/[id]/reject
 * Reject a transfer match suggestion
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const { id: suggestionId } = await params;

    // Fetch the suggestion to verify it exists and belongs to user
    const suggestionResult = await db
      .select()
      .from(transferSuggestions)
      .where(
        and(
          eq(transferSuggestions.id, suggestionId),
          eq(transferSuggestions.userId, userId),
          eq(transferSuggestions.householdId, householdId)
        )
      )
      .limit(1);

    if (suggestionResult.length === 0) {
      return NextResponse.json(
        { error: 'Suggestion not found' },
        { status: 404 }
      );
    }

    const suggestion = suggestionResult[0];

    // Check if already processed
    if (suggestion.status !== 'pending') {
      return NextResponse.json(
        { error: `Suggestion already ${suggestion.status}` },
        { status: 400 }
      );
    }

    // Mark suggestion as rejected
    await db
      .update(transferSuggestions)
      .set({
        status: 'rejected',
        reviewedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(transferSuggestions.id, suggestionId),
          eq(transferSuggestions.userId, userId),
          eq(transferSuggestions.householdId, householdId)
        )
      );

    return NextResponse.json({
      success: true,
      message: 'Suggestion rejected successfully',
    });
  } catch (error) {
    return handleRouteError(error, {
      defaultError: 'Failed to reject suggestion',
      logLabel: 'Error rejecting transfer suggestion:',
    });
  }
}
