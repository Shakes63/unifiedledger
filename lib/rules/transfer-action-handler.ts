/**
 * Transfer Action Handler
 *
 * Handles transfer conversion AFTER transaction creation.
 * This is necessary because transfer conversion requires the transaction ID
 * and may need to create/link with another transaction.
 *
 * Enhanced with multi-factor scoring:
 * - Amount similarity (40 points)
 * - Date proximity (30 points)
 * - Description similarity (20 points)
 * - Account history (10 points)
 */

import { db } from '@/lib/db';
import { transactions, accounts, transferSuggestions } from '@/lib/db/schema';
import { eq, and, between, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';
import { distance } from 'fastest-levenshtein';
import type { TransferConversionConfig } from './types';

/**
 * Match score breakdown for a potential transfer pair
 */
export interface MatchScore {
  transactionId: string;
  transaction: any;
  amountScore: number;      // 0-40 points
  dateScore: number;        // 0-30 points
  descriptionScore: number; // 0-20 points
  accountScore: number;     // 0-10 points
  totalScore: number;       // 0-100 points
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Calculate similarity between two descriptions using Levenshtein distance
 * Returns a score from 0 (completely different) to 1 (identical)
 */
function calculateDescriptionSimilarity(desc1: string, desc2: string): number {
  if (!desc1 || !desc2) return 0;

  const str1 = desc1.toLowerCase().trim();
  const str2 = desc2.toLowerCase().trim();

  if (str1 === str2) return 1;

  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 0;

  const levenshteinDist = distance(str1, str2);

  // Convert distance to similarity score (0-1)
  return Math.max(0, 1 - (levenshteinDist / maxLen));
}

/**
 * Score a potential transfer match using multi-factor algorithm
 * Total possible score: 100 points
 */
function scoreTransferMatch(
  sourceTransaction: any,
  candidateTransaction: any,
  config: TransferConversionConfig
): MatchScore {
  // 1. Amount Score (40 points max)
  const sourceAmount = new Decimal(sourceTransaction.amount);
  const candidateAmount = new Decimal(candidateTransaction.amount);
  const amountDiff = candidateAmount.minus(sourceAmount).abs();
  const toleranceAmount = sourceAmount.times(config.matchTolerance / 100);

  let amountScore = 0;
  if (amountDiff.isZero()) {
    amountScore = 40;
  } else if (amountDiff.lessThanOrEqualTo(toleranceAmount)) {
    const diffRatio = amountDiff.dividedBy(toleranceAmount).toNumber();
    amountScore = Math.max(0, 40 - (diffRatio * 15));
  }

  // 2. Date Score (30 points max)
  const sourceDate = new Date(sourceTransaction.date);
  const candidateDate = new Date(candidateTransaction.date);
  const daysDiff = Math.abs(
    (sourceDate.getTime() - candidateDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  let dateScore = 0;
  if (daysDiff === 0) {
    dateScore = 30;
  } else if (daysDiff <= config.matchDayRange) {
    const diffRatio = daysDiff / config.matchDayRange;
    dateScore = Math.max(0, 30 - (diffRatio * 15));
  }

  // 3. Description Score (20 points max)
  const similarity = calculateDescriptionSimilarity(
    sourceTransaction.description || '',
    candidateTransaction.description || ''
  );
  const descriptionScore = similarity * 20;

  // 4. Account Score (10 points max) - placeholder for future ML
  const accountScore = 0;

  // Calculate total
  const totalScore = amountScore + dateScore + descriptionScore + accountScore;

  // Determine confidence level
  let confidence: 'high' | 'medium' | 'low';
  if (totalScore >= 90) {
    confidence = 'high';
  } else if (totalScore >= 70) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return {
    transactionId: candidateTransaction.id,
    transaction: candidateTransaction,
    amountScore,
    dateScore,
    descriptionScore,
    accountScore,
    totalScore,
    confidence,
  };
}

/**
 * Store transfer match suggestions for user review
 * Only stores medium-confidence matches (70-89% score)
 */
async function storeSuggestions(
  userId: string,
  sourceTransactionId: string,
  matches: MatchScore[]
): Promise<void> {
  try {
    // Filter to medium confidence and take top 5
    const mediumMatches = matches
      .filter((m) => m.confidence === 'medium')
      .slice(0, 5);

    if (mediumMatches.length === 0) {
      return;
    }

    // Create suggestion records
    const suggestions = mediumMatches.map((match) => ({
      id: nanoid(),
      userId,
      sourceTransactionId,
      suggestedTransactionId: match.transactionId,
      amountScore: match.amountScore,
      dateScore: match.dateScore,
      descriptionScore: match.descriptionScore,
      accountScore: match.accountScore,
      totalScore: match.totalScore,
      confidence: match.confidence as 'medium',
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
    }));

    // Insert into database
    await db.insert(transferSuggestions).values(suggestions);
  } catch (error) {
    console.error('Failed to store transfer suggestions:', error);
    // Non-fatal error - don't throw
  }
}

/**
 * Handle transfer conversion for a transaction
 * Called AFTER transaction is created
 */
export async function handleTransferConversion(
  userId: string,
  transactionId: string,
  config: TransferConversionConfig
): Promise<{
  success: boolean;
  matchedTransactionId?: string;
  createdTransactionId?: string;
  suggestions?: MatchScore[];
  autoLinked?: boolean;
  confidence?: 'high' | 'medium' | 'low';
  error?: string;
}> {
  try {
    // 1. Fetch the source transaction
    const sourceTx = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.id, transactionId),
          eq(transactions.userId, userId)
        )
      )
      .limit(1);

    if (sourceTx.length === 0) {
      return { success: false, error: 'Transaction not found' };
    }

    const transaction = sourceTx[0];

    // 2. Search for matching transactions with scoring
    const matchResult = await findMatchingTransaction(
      userId,
      transaction,
      config.targetAccountId,
      config
    );

    // 3. Generate transfer ID
    const transferId = nanoid();

    // 4. Determine new transaction type based on original type
    const newType = transaction.type === 'income' ? 'transfer_in' : 'transfer_out';

    // 5. Convert source transaction to transfer
    await db
      .update(transactions)
      .set({
        type: newType,
        transferId: transferId,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(transactions.id, transactionId));

    // 6. Handle high-confidence auto-link
    if (matchResult.autoLink && matchResult.bestMatch) {
      const matchedType = matchResult.bestMatch.type === 'income' ? 'transfer_in' : 'transfer_out';

      await db
        .update(transactions)
        .set({
          type: matchedType,
          transferId: transferId,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(transactions.id, matchResult.bestMatch.id));

      return {
        success: true,
        matchedTransactionId: matchResult.bestMatch.id,
        autoLinked: true,
        confidence: 'high',
      };
    }

    // 7. Handle medium-confidence suggestions
    const mediumMatches = matchResult.allMatches.filter(
      (m) => m.confidence === 'medium'
    );

    if (mediumMatches.length > 0 && config.autoMatch) {
      // Store suggestions for user review
      await storeSuggestions(userId, transactionId, mediumMatches);

      return {
        success: true,
        suggestions: mediumMatches.slice(0, 5), // Top 5 suggestions
        autoLinked: false,
        confidence: 'medium',
      };
    }

    // 8. No good matches - create new pair if configured
    if (config.createIfNoMatch && config.targetAccountId) {
      // Create new transfer pair
      const newTxId = nanoid();
      const pairType = newType === 'transfer_out' ? 'transfer_in' : 'transfer_out';

      await db.insert(transactions).values({
        id: newTxId,
        userId: userId,
        householdId: transaction.householdId,
        accountId: config.targetAccountId,
        date: transaction.date,
        amount: transaction.amount,
        description: transaction.description,
        notes: transaction.notes ? `${transaction.notes}\n\nAuto-created transfer pair from rule action` : 'Auto-created transfer pair from rule action',
        type: pairType,
        transferId: transferId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Update account balances
      await updateAccountBalances(
        userId,
        transaction.accountId,
        config.targetAccountId,
        transaction.amount,
        newType
      );

      return {
        success: true,
        createdTransactionId: newTxId,
        autoLinked: false,
        confidence: 'low',
      };
    }

    return {
      success: true,
      autoLinked: false,
      confidence: matchResult.allMatches.length > 0
        ? matchResult.allMatches[0].confidence
        : 'low'
    };
  } catch (error) {
    console.error('Transfer conversion failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Find matching transactions for transfer conversion with confidence scoring
 * Returns all scored matches sorted by confidence
 */
async function findMatchingTransaction(
  userId: string,
  sourceTx: any,
  targetAccountId: string | undefined,
  config: TransferConversionConfig
): Promise<{
  bestMatch: any | null;
  allMatches: MatchScore[];
  autoLink: boolean;
}> {
  try {
    // Calculate date range
    const txDate = new Date(sourceTx.date);
    const startDate = new Date(txDate);
    startDate.setDate(startDate.getDate() - config.matchDayRange);
    const endDate = new Date(txDate);
    endDate.setDate(endDate.getDate() + config.matchDayRange);

    // Determine opposite type
    const oppositeType = sourceTx.type === 'expense' ? 'income' : 'expense';

    // Calculate amount tolerance for pre-filtering
    const txAmount = new Decimal(sourceTx.amount);
    const toleranceAmount = txAmount.times(config.matchTolerance / 100);
    const minAmount = txAmount.minus(toleranceAmount).toNumber();
    const maxAmount = txAmount.plus(toleranceAmount).toNumber();

    // Build query conditions
    const conditions = [
      eq(transactions.userId, userId),
      eq(transactions.type, oppositeType),
      // Only match transactions that aren't already transfers
      sql`${transactions.transferId} IS NULL`,
      // Date range
      between(
        transactions.date,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      ),
    ];

    // Add target account filter if specified
    if (targetAccountId) {
      conditions.push(eq(transactions.accountId, targetAccountId));
    }

    const candidates = await db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .limit(50);

    // Filter by amount tolerance
    const amountFiltered = candidates.filter((tx) => {
      return tx.amount >= minAmount && tx.amount <= maxAmount;
    });

    if (amountFiltered.length === 0) {
      return { bestMatch: null, allMatches: [], autoLink: false };
    }

    // Score all candidates using multi-factor algorithm
    const scoredMatches = amountFiltered.map((candidate) =>
      scoreTransferMatch(sourceTx, candidate, config)
    );

    // Sort by total score (descending)
    scoredMatches.sort((a, b) => b.totalScore - a.totalScore);

    const bestMatch = scoredMatches[0];

    // Determine if we should auto-link (high confidence only)
    const autoLink = bestMatch.confidence === 'high';

    return {
      bestMatch: autoLink ? bestMatch.transaction : null,
      allMatches: scoredMatches,
      autoLink,
    };
  } catch (error) {
    console.error('Error finding matching transaction:', error);
    return { bestMatch: null, allMatches: [], autoLink: false };
  }
}

/**
 * Update account balances after transfer conversion
 * Handles balance adjustments for both source and target accounts
 */
async function updateAccountBalances(
  userId: string,
  sourceAccountId: string,
  targetAccountId: string,
  amount: number,
  sourceType: string
): Promise<void> {
  try {
    const amountDecimal = new Decimal(amount);

    if (sourceType === 'transfer_out') {
      // Transfer Out: source loses money, target gains money
      await db
        .update(accounts)
        .set({
          currentBalance: sql`current_balance - ${amountDecimal.toFixed(2)}`,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(accounts.id, sourceAccountId));

      await db
        .update(accounts)
        .set({
          currentBalance: sql`current_balance + ${amountDecimal.toFixed(2)}`,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(accounts.id, targetAccountId));
    } else {
      // Transfer In: source gains money, target loses money
      await db
        .update(accounts)
        .set({
          currentBalance: sql`current_balance + ${amountDecimal.toFixed(2)}`,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(accounts.id, sourceAccountId));

      await db
        .update(accounts)
        .set({
          currentBalance: sql`current_balance - ${amountDecimal.toFixed(2)}`,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(accounts.id, targetAccountId));
    }
  } catch (error) {
    console.error('Error updating account balances:', error);
    throw error;
  }
}
