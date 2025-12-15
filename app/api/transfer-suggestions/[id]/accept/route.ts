import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { transferSuggestions, transactions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * POST /api/transfer-suggestions/[id]/accept
 * Accept a transfer match suggestion and create the transfer link
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const { id: suggestionId } = await params;

    // Fetch the suggestion
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

    // Fetch both transactions to verify they exist and aren't already transfers
    const [sourceTx, suggestedTx] = await Promise.all([
      db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.id, suggestion.sourceTransactionId),
            eq(transactions.userId, userId),
            eq(transactions.householdId, householdId)
          )
        )
        .limit(1),
      db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.id, suggestion.suggestedTransactionId),
            eq(transactions.userId, userId),
            eq(transactions.householdId, householdId)
          )
        )
        .limit(1),
    ]);

    if (sourceTx.length === 0 || suggestedTx.length === 0) {
      return NextResponse.json(
        { error: 'One or both transactions not found' },
        { status: 404 }
      );
    }

    // Check if either transaction is already part of a transfer
    if (sourceTx[0].transferId || suggestedTx[0].transferId) {
      return NextResponse.json(
        { error: 'One or both transactions are already part of a transfer' },
        { status: 400 }
      );
    }

    // Create transfer link
    const transferId = nanoid();

    // Determine transfer types based on original types
    const sourceType = sourceTx[0].type === 'income' ? 'transfer_in' : 'transfer_out';
    const suggestedType = suggestedTx[0].type === 'income' ? 'transfer_in' : 'transfer_out';

    // Update both transactions to link them as a transfer
    await Promise.all([
      db
        .update(transactions)
        .set({
          type: sourceType,
          transferId,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(transactions.id, suggestion.sourceTransactionId),
            eq(transactions.userId, userId),
            eq(transactions.householdId, householdId)
          )
        ),
      db
        .update(transactions)
        .set({
          type: suggestedType,
          transferId,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(transactions.id, suggestion.suggestedTransactionId),
            eq(transactions.userId, userId),
            eq(transactions.householdId, householdId)
          )
        ),
    ]);

    // Mark suggestion as accepted
    await db
      .update(transferSuggestions)
      .set({
        status: 'accepted',
        reviewedAt: new Date().toISOString(),
      })
      .where(eq(transferSuggestions.id, suggestionId));

    return NextResponse.json({
      success: true,
      message: 'Transfer link created successfully',
      transferId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error accepting transfer suggestion:', error);
    return NextResponse.json(
      { error: 'Failed to accept suggestion' },
      { status: 500 }
    );
  }
}
