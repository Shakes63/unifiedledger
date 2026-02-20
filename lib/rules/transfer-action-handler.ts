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
import { parseISO, addDays, subDays, format, differenceInCalendarDays } from 'date-fns';
import type { TransferConversionConfig } from './types';
import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import {
  getAccountBalanceCents,
  getTransactionAmountCents,
  insertTransactionMovement,
  insertTransferMovement,
  updateScopedAccountBalance,
} from '@/lib/transactions/money-movement-service';

type TransactionRow = typeof transactions.$inferSelect;

/**
 * Match score breakdown for a potential transfer pair
 */
export interface MatchScore {
  transactionId: string;
  transaction: TransactionRow;
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
  sourceTransaction: TransactionRow,
  candidateTransaction: TransactionRow,
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
  // Use calendar day arithmetic to avoid timezone-related off-by-one
  const daysDiff = Math.abs(
    differenceInCalendarDays(
      parseISO(sourceTransaction.date),
      parseISO(candidateTransaction.date)
    )
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
  householdId: string,
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
      householdId,
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
    const householdId = transaction.householdId;

    if (!householdId) {
      return { success: false, error: 'Transaction missing household ID' };
    }

    if (
      transaction.transferGroupId ||
      transaction.pairedTransactionId ||
      (transaction.transferId && transaction.transferId.length > 0)
    ) {
      return { success: false, error: 'Transaction is already linked as a transfer' };
    }

    // Validate target account belongs to the same household (if provided)
    if (config.targetAccountId) {
      if (config.targetAccountId === transaction.accountId) {
        return { success: false, error: 'Cannot transfer to the same account' };
      }

      const targetAccount = await db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.id, config.targetAccountId),
            eq(accounts.userId, userId),
            eq(accounts.householdId, householdId)
          )
        )
        .limit(1);

      if (targetAccount.length === 0) {
        return { success: false, error: 'Target account not found in household' };
      }
    }

    // 2. Search for matching transactions with scoring
    const matchResult = await findMatchingTransaction(
      userId,
      transaction,
      householdId,
      config.targetAccountId,
      config
    );

    // 3. Handle high-confidence auto-link
    if (matchResult.autoLink && matchResult.bestMatch) {
      const matchedTransaction = matchResult.bestMatch;

      if (
        matchedTransaction.transferGroupId ||
        matchedTransaction.pairedTransactionId ||
        (matchedTransaction.transferId && matchedTransaction.transferId.length > 0)
      ) {
        return { success: false, error: 'Matched transaction is already linked as a transfer' };
      }

      const transferGroupId = nanoid();
      const sourceIsOut = transaction.type === 'expense';
      const sourceType = sourceIsOut ? 'transfer_out' : 'transfer_in';
      const matchedType = sourceIsOut ? 'transfer_in' : 'transfer_out';
      const sourceAccountId = sourceIsOut ? transaction.accountId : matchedTransaction.accountId;
      const destinationAccountId = sourceIsOut ? matchedTransaction.accountId : transaction.accountId;
      const nowIso = new Date().toISOString();
      const transferOutId = sourceType === 'transfer_out' ? transaction.id : matchedTransaction.id;
      const transferInId = sourceType === 'transfer_in' ? transaction.id : matchedTransaction.id;

      await runInDatabaseTransaction(async (tx) => {
        await tx
          .update(transactions)
          .set({
            type: sourceType,
            transferId: transferGroupId,
            transferGroupId,
            pairedTransactionId: matchedTransaction.id,
            transferSourceAccountId: sourceAccountId,
            transferDestinationAccountId: destinationAccountId,
            categoryId: null,
            merchantId: null,
            updatedAt: nowIso,
          })
          .where(
            and(
              eq(transactions.id, transactionId),
              eq(transactions.userId, userId),
              eq(transactions.householdId, householdId)
            )
          );

        await tx
          .update(transactions)
          .set({
            type: matchedType,
            transferId: transferGroupId,
            transferGroupId,
            pairedTransactionId: transactionId,
            transferSourceAccountId: sourceAccountId,
            transferDestinationAccountId: destinationAccountId,
            categoryId: null,
            merchantId: null,
            updatedAt: nowIso,
          })
          .where(
            and(
              eq(transactions.id, matchedTransaction.id),
              eq(transactions.userId, userId),
              eq(transactions.householdId, householdId)
            )
          );

        await insertTransferMovement(tx, {
          id: transferGroupId,
          userId,
          householdId,
          fromAccountId: sourceAccountId,
          toAccountId: destinationAccountId,
          amountCents: getTransactionAmountCents(transaction),
          feesCents: 0,
          description: transaction.description || matchedTransaction.description || 'Transfer',
          date: transaction.date,
          status: 'completed',
          fromTransactionId: transferOutId,
          toTransactionId: transferInId,
          notes: transaction.notes || matchedTransaction.notes || null,
          createdAt: nowIso,
        });
      });

      return {
        success: true,
        matchedTransactionId: matchedTransaction.id,
        autoLinked: true,
        confidence: 'high',
      };
    }

    // 4. Handle medium-confidence suggestions
    const mediumMatches = matchResult.allMatches.filter(
      (m) => m.confidence === 'medium'
    );

    if (mediumMatches.length > 0 && config.autoMatch) {
      // Store suggestions for user review
      await storeSuggestions(userId, householdId, transactionId, mediumMatches);

      return {
        success: true,
        suggestions: mediumMatches.slice(0, 5), // Top 5 suggestions
        autoLinked: false,
        confidence: 'medium',
      };
    }

    // 5. No good matches - create new pair if configured
    if (config.createIfNoMatch && config.targetAccountId) {
      const targetAccountId = config.targetAccountId;
      const transferGroupId = nanoid();
      const newTxId = nanoid();
      const sourceType = transaction.type === 'expense' ? 'transfer_out' : 'transfer_in';
      const pairType = sourceType === 'transfer_out' ? 'transfer_in' : 'transfer_out';
      const sourceAccountId = sourceType === 'transfer_out' ? transaction.accountId : targetAccountId;
      const destinationAccountId = sourceType === 'transfer_out' ? targetAccountId : transaction.accountId;
      const nowIso = new Date().toISOString();
      const amountCents = getTransactionAmountCents(transaction);
      const pairNotes = transaction.notes
        ? `${transaction.notes}\n\nAuto-created transfer pair from rule action`
        : 'Auto-created transfer pair from rule action';
      const transferOutId = sourceType === 'transfer_out' ? transaction.id : newTxId;
      const transferInId = sourceType === 'transfer_in' ? transaction.id : newTxId;

      await runInDatabaseTransaction(async (tx) => {
        await tx
          .update(transactions)
          .set({
            type: sourceType,
            transferId: transferGroupId,
            transferGroupId,
            pairedTransactionId: newTxId,
            transferSourceAccountId: sourceAccountId,
            transferDestinationAccountId: destinationAccountId,
            categoryId: null,
            merchantId: null,
            updatedAt: nowIso,
          })
          .where(
            and(
              eq(transactions.id, transactionId),
              eq(transactions.userId, userId),
              eq(transactions.householdId, householdId)
            )
          );

        await insertTransactionMovement(tx, {
          id: newTxId,
          userId,
          householdId,
          accountId: targetAccountId,
          categoryId: null,
          merchantId: null,
          date: transaction.date,
          amountCents,
          description: transaction.description,
          notes: pairNotes,
          type: pairType,
          transferId: transferGroupId,
          transferGroupId,
          pairedTransactionId: transactionId,
          transferSourceAccountId: sourceAccountId,
          transferDestinationAccountId: destinationAccountId,
          isPending: transaction.isPending,
          createdAt: nowIso,
          updatedAt: nowIso,
        });

        await insertTransferMovement(tx, {
          id: transferGroupId,
          userId,
          householdId,
          fromAccountId: sourceAccountId,
          toAccountId: destinationAccountId,
          amountCents,
          feesCents: 0,
          description: transaction.description || 'Transfer',
          date: transaction.date,
          status: 'completed',
          fromTransactionId: transferOutId,
          toTransactionId: transferInId,
          notes: transaction.notes || null,
          createdAt: nowIso,
        });

        const [targetAccount] = await tx
          .select()
          .from(accounts)
          .where(
            and(
              eq(accounts.id, targetAccountId),
              eq(accounts.userId, userId),
              eq(accounts.householdId, householdId)
            )
          )
          .limit(1);

        if (!targetAccount) {
          throw new Error('Target account not found for balance update');
        }

        const targetCurrentCents = getAccountBalanceCents(targetAccount);
        const targetNextCents =
          sourceType === 'transfer_out'
            ? targetCurrentCents + amountCents
            : targetCurrentCents - amountCents;

        await updateScopedAccountBalance(tx, {
          accountId: targetAccountId,
          userId,
          householdId,
          balanceCents: targetNextCents,
          updatedAt: nowIso,
        });
      });

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
  sourceTx: TransactionRow,
  householdId: string,
  targetAccountId: string | undefined,
  config: TransferConversionConfig
): Promise<{
  bestMatch: TransactionRow | null;
  allMatches: MatchScore[];
  autoLink: boolean;
}> {
  try {
    // Calculate date range
    const txDate = parseISO(sourceTx.date);
    const startDateStr = format(subDays(txDate, config.matchDayRange), 'yyyy-MM-dd');
    const endDateStr = format(addDays(txDate, config.matchDayRange), 'yyyy-MM-dd');

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
      eq(transactions.householdId, householdId),
      eq(transactions.type, oppositeType),
      // Only match transactions that are not already transfer-linked.
      sql`(${transactions.transferId} IS NULL OR ${transactions.transferId} = '')`,
      sql`${transactions.transferGroupId} IS NULL`,
      sql`${transactions.pairedTransactionId} IS NULL`,
      // Don't match the source transaction itself
      sql`${transactions.id} != ${sourceTx.id}`,
      // Date range
      between(
        transactions.date,
        startDateStr,
        endDateStr
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
