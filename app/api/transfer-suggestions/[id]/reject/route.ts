import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { transferSuggestions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * POST /api/transfer-suggestions/[id]/reject
 * Reject a transfer match suggestion
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: suggestionId } = await params;

    // Fetch the suggestion to verify it exists and belongs to user
    const suggestionResult = await db
      .select()
      .from(transferSuggestions)
      .where(
        and(
          eq(transferSuggestions.id, suggestionId),
          eq(transferSuggestions.userId, userId)
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
      .where(eq(transferSuggestions.id, suggestionId));

    return NextResponse.json({
      success: true,
      message: 'Suggestion rejected successfully',
    });
  } catch (error) {
    console.error('Error rejecting transfer suggestion:', error);
    return NextResponse.json(
      { error: 'Failed to reject suggestion' },
      { status: 500 }
    );
  }
}
