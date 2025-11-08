import { distance } from 'fastest-levenshtein';

interface TransactionMatch {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: string;
  similarity: number;
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
    const amountDiff = Math.abs(newAmount - tx.amount);
    const amountPercentDiff = amountDiff / Math.max(newAmount, tx.amount);

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
