import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { transferSuggestions, transactions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { linkExistingTransactionsAsCanonicalTransfer } from '@/lib/transactions/transfer-service';
import { handleRouteError } from '@/lib/api/route-helpers';

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

    const isAlreadyLinked = (tx: typeof transactions.$inferSelect) =>
      !!tx.transferGroupId
      || !!tx.pairedTransactionId
      || !!tx.transferId;

    // Check if either transaction is already part of a transfer
    if (isAlreadyLinked(sourceTx[0]) || isAlreadyLinked(suggestedTx[0])) {
      return NextResponse.json(
        { error: 'One or both transactions are already part of a transfer' },
        { status: 400 }
      );
    }

    const linkResult = await linkExistingTransactionsAsCanonicalTransfer({
      userId,
      householdId,
      firstTransactionId: suggestion.sourceTransactionId,
      secondTransactionId: suggestion.suggestedTransactionId,
    });

    // Mark suggestion as accepted
    await db
      .update(transferSuggestions)
      .set({
        status: 'accepted',
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
      message: 'Transfer link created successfully',
      transferId: linkResult.transferGroupId,
    });
  } catch (error) {
    return handleRouteError(error, {
      defaultError: 'Failed to accept suggestion',
      logLabel: 'Error accepting transfer suggestion:',
    });
  }
}
