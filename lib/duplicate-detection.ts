import { distance } from 'fastest-levenshtein';
import Decimal from 'decimal.js';

interface TransactionMatch {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: string;
  similarity: number;
}

/**
 * Enhanced transaction match with additional match reason info
 */
export interface EnhancedTransactionMatch extends TransactionMatch {
  matchReason: 'levenshtein' | 'merchant_name';
  merchantName?: string;
  accountName?: string;
}

/**
 * Merchant info for enhanced duplicate detection
 */
export interface MerchantInfo {
  id: string;
  name: string;
}

/**
 * Existing transaction with account info for duplicate detection
 */
export interface ExistingTransactionForDuplicates {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: string;
  accountId: string;
  accountName?: string;
  merchantId?: string | null;
  merchantName?: string | null;
}

/**
 * Detects potential duplicate transactions using Levenshtein distance
 * on transaction descriptions and amount matching
 */
export function detectDuplicateTransactions(
  newDescription: string,
  newAmount: number,
  newDate: string,
  existingTransactions: Array<{
    id: string;
    description: string;
    amount: number;
    date: string;
    type: string;
  }>,
  options: {
    descriptionThreshold?: number; // 0-1, default 0.7 (70% similarity)
    amountThreshold?: number; // percentage difference, default 0.05 (5%)
    dateRangeInDays?: number; // default 7 days
    minAmount?: number; // minimum amount to check for duplicates
  } = {}
): TransactionMatch[] {
  const {
    descriptionThreshold = 0.7,
    amountThreshold = 0.05,
    dateRangeInDays = 7,
    minAmount = 0.01,
  } = options;

  if (!newDescription || newAmount < minAmount) {
    return [];
  }

  const newDateObj = new Date(newDate);
  const matches: TransactionMatch[] = [];

  for (const tx of existingTransactions) {
    // Check date range
    const txDate = new Date(tx.date);
    const daysDifference =
      Math.abs(newDateObj.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDifference > dateRangeInDays) {
      continue;
    }

    // Check amount similarity (within threshold percentage)
    const amountDiff = new Decimal(newAmount).minus(tx.amount).abs();
    const amountPercentDiff = amountDiff.dividedBy(Math.max(newAmount, tx.amount)).toNumber();

    if (amountPercentDiff > amountThreshold) {
      continue;
    }

    // Check description similarity using Levenshtein distance
    const similarity = calculateSimilarity(newDescription, tx.description);

    if (similarity >= descriptionThreshold) {
      matches.push({
        id: tx.id,
        description: tx.description,
        amount: tx.amount,
        date: tx.date,
        type: tx.type,
        similarity: Math.round(similarity * 100),
      });
    }
  }

  // Sort by similarity (highest first) and then by date (most recent first)
  return matches.sort((a, b) => {
    if (b.similarity !== a.similarity) {
      return b.similarity - a.similarity;
    }
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}

/**
 * Calculates string similarity using Levenshtein distance
 * Returns value between 0 and 1, where 1 is identical
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const normalized1 = normalizeString(str1);
  const normalized2 = normalizeString(str2);

  if (normalized1 === normalized2) {
    return 1;
  }

  const maxLength = Math.max(normalized1.length, normalized2.length);
  if (maxLength === 0) {
    return 1;
  }

  const lev = distance(normalized1, normalized2);
  return 1 - lev / maxLength;
}

/**
 * Normalizes strings for better matching:
 * - Convert to lowercase
 * - Trim whitespace
 * - Remove common words and special characters
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/\b(the|a|an|and|or|at|to|from|for|in|on|with|by|of)\b/g, '') // Remove common words
    .trim()
    .replace(/\s+/g, ''); // Remove remaining spaces
}

/**
 * Formats duplicate matches for display
 */
export function formatDuplicateMatches(
  matches: TransactionMatch[]
): string[] {
  return matches.map(
    (match) =>
      `${match.description} ($${match.amount.toFixed(2)}) on ${new Date(match.date).toLocaleDateString()} - ${match.similarity}% similar`
  );
}

// ============================================================================
// Enhanced Duplicate Detection with Merchant Name Matching
// ============================================================================

/**
 * Common separators in transaction descriptions that precede transaction IDs,
 * locations, or other variable data. Used to extract vendor names.
 */
const DESCRIPTION_SEPARATORS = /[#*]|\bPOS\b|\bDEBIT\b|\bCARD\b|\bPURCHASE\b|\bPAYMENT\b|\bTRANSACTION\b|\d{4,}/gi;

/**
 * Extract potential vendor name from a transaction description
 * Takes the portion before common separators
 */
export function extractVendorName(description: string): string {
  if (!description) return '';

  // Find the first separator and take everything before it
  const match = description.search(DESCRIPTION_SEPARATORS);
  const vendorPart = match > 0 ? description.substring(0, match) : description;

  // Normalize: lowercase, trim, remove extra whitespace
  return vendorPart.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Check if a merchant name appears within a description (case-insensitive)
 */
export function merchantNameInDescription(
  merchantName: string,
  description: string
): boolean {
  if (!merchantName || !description) return false;

  const normalizedMerchant = merchantName.toLowerCase().trim();
  const normalizedDescription = description.toLowerCase();

  // Must be at least 3 characters to avoid false positives
  if (normalizedMerchant.length < 3) return false;

  return normalizedDescription.includes(normalizedMerchant);
}

/**
 * Enhanced duplicate detection that also checks for merchant name containment
 *
 * This function first runs the standard Levenshtein-based detection, then adds
 * merchant name-based matching for cases where the same vendor appears in the
 * description but with different transaction IDs or locations.
 *
 * @param newDescription - Description of the new transaction
 * @param newAmount - Amount of the new transaction
 * @param newDate - Date of the new transaction (YYYY-MM-DD)
 * @param newAccountId - Account ID of the new transaction
 * @param existingTransactions - Existing transactions to check against
 * @param merchants - List of merchants in the household
 * @param options - Detection options
 * @returns Array of enhanced matches with match reason
 */
export function detectDuplicatesEnhanced(
  newDescription: string,
  newAmount: number,
  newDate: string,
  newAccountId: string,
  existingTransactions: ExistingTransactionForDuplicates[],
  merchants: MerchantInfo[],
  options: {
    descriptionThreshold?: number;
    amountThreshold?: number;
    dateRangeInDays?: number;
    minAmount?: number;
  } = {}
): EnhancedTransactionMatch[] {
  const {
    descriptionThreshold = 0.7,
    amountThreshold = 0.05,
    dateRangeInDays = 1, // Stricter for merchant matching: same day or day before/after
    minAmount = 0.01,
  } = options;

  if (!newDescription || newAmount < minAmount) {
    return [];
  }

  const newDateObj = new Date(newDate);
  const matches: EnhancedTransactionMatch[] = [];
  const matchedIds = new Set<string>();

  // Filter to only same account for duplicate detection
  // Duplicates should only be detected within the same account
  const sameAccountTransactions = existingTransactions.filter(
    (tx) => tx.accountId === newAccountId
  );

  // First, run standard Levenshtein detection (with original 7-day range)
  // Only check against transactions in the SAME account
  const levenshteinMatches = detectDuplicateTransactions(
    newDescription,
    newAmount,
    newDate,
    sameAccountTransactions,
    { descriptionThreshold, amountThreshold, dateRangeInDays: 7, minAmount }
  );

  for (const match of levenshteinMatches) {
    const existingTx = existingTransactions.find(tx => tx.id === match.id);
    matches.push({
      ...match,
      matchReason: 'levenshtein',
      accountName: existingTx?.accountName,
      merchantName: existingTx?.merchantName || undefined,
    });
    matchedIds.add(match.id);
  }

  // Second, check for merchant name containment
  // For transactions with same account, same amount, close date
  for (const tx of existingTransactions) {
    // Skip if already matched by Levenshtein
    if (matchedIds.has(tx.id)) continue;

    // Must be same account for merchant-based duplicate detection
    if (tx.accountId !== newAccountId) continue;

    // Check date proximity (stricter: within 1 day)
    const txDate = new Date(tx.date);
    const daysDifference = Math.abs(
      (newDateObj.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysDifference > dateRangeInDays) continue;

    // Check amount similarity
    const amountDiff = new Decimal(newAmount).minus(tx.amount).abs();
    const amountPercentDiff = amountDiff.dividedBy(Math.max(newAmount, tx.amount)).toNumber();
    if (amountPercentDiff > amountThreshold) continue;

    // Check if any merchant name appears in the new description
    let matchedMerchantName: string | undefined;

    // Check merchants table
    for (const merchant of merchants) {
      if (merchantNameInDescription(merchant.name, newDescription)) {
        matchedMerchantName = merchant.name;
        break;
      }
    }

    // If no merchant table match, check if the existing transaction's merchant name is in new description
    if (!matchedMerchantName && tx.merchantName) {
      if (merchantNameInDescription(tx.merchantName, newDescription)) {
        matchedMerchantName = tx.merchantName;
      }
    }

    // Also check the reverse: if existing description vendor appears in new
    if (!matchedMerchantName) {
      const existingVendor = extractVendorName(tx.description);
      if (existingVendor.length >= 3 && merchantNameInDescription(existingVendor, newDescription)) {
        matchedMerchantName = existingVendor;
      }
    }

    // If we found a merchant name match, add it
    if (matchedMerchantName) {
      matches.push({
        id: tx.id,
        description: tx.description,
        amount: tx.amount,
        date: tx.date,
        type: tx.type,
        similarity: 85, // High similarity score for merchant match with same amount/date
        matchReason: 'merchant_name',
        merchantName: matchedMerchantName,
        accountName: tx.accountName,
      });
      matchedIds.add(tx.id);
    }
  }

  // Sort by similarity (highest first) and then by date (most recent first)
  return matches.sort((a, b) => {
    if (b.similarity !== a.similarity) {
      return b.similarity - a.similarity;
    }
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}
