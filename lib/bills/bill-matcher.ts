import { distance } from 'fastest-levenshtein';

/**
 * Transaction data structure for bill matching
 */
export interface TransactionForMatching {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: string | null;
}

/**
 * Bill data structure for matching
 */
export interface BillForMatching {
  id: string;
  name: string;
  expectedAmount: number;
  dueDate: number;
  isVariableAmount: boolean | null;
  amountTolerance: number | null;
  payeePatterns?: string[];
}

/**
 * Bill match result
 */
export interface BillMatch {
  billId: string;
  billName: string;
  confidence: number; // 0-100
  reasons: string[];
  similarity: number;
  amountMatch: boolean;
  dateMatch: boolean;
}

/**
 * Normalize a string for comparison (remove special chars, lowercase)
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate string similarity percentage (0-100)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const normalized1 = normalizeString(str1);
  const normalized2 = normalizeString(str2);

  if (normalized1 === normalized2) return 100;

  const dist = distance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);

  if (maxLength === 0) return 100;

  return Math.round(((maxLength - dist) / maxLength) * 100);
}

/**
 * Extract common words to filter out
 */
const commonWords = new Set([
  'payment',
  'charge',
  'debit',
  'credit',
  'transfer',
  'deposit',
  'withdrawal',
  'transaction',
  'purchase',
  'online',
  'purchase',
  'inc',
  'corp',
  'llc',
  'ltd',
  'co',
]);

/**
 * Extract key words from description for matching
 */
function extractKeywords(description: string): Set<string> {
  const words = normalizeString(description).split(/\s+/);
  return new Set(words.filter((w) => w.length > 2 && !commonWords.has(w)));
}

/**
 * Check amount match considering tolerance
 */
function checkAmountMatch(
  transactionAmount: number,
  billExpectedAmount: number,
  tolerance: number | null
): boolean {
  const tol = tolerance || 5.0; // Default 5% tolerance
  const variance =
    (Math.abs(transactionAmount - billExpectedAmount) / billExpectedAmount) *
    100;
  return variance <= tol;
}

/**
 * Check if transaction day of month matches bill due date
 * Allows 2-day variance for processing delays
 */
function checkDateMatch(transactionDate: string, billDueDate: number): boolean {
  const txDate = new Date(transactionDate);
  const txDayOfMonth = txDate.getDate();

  // Check if day matches (within 2 days - accounts for processing delays)
  const dayDifference = Math.abs(txDayOfMonth - billDueDate);
  return dayDifference <= 2 || dayDifference >= 28; // 28 for month wraparound
}

/**
 * Find matching bills for a transaction
 * Returns array of potential matches sorted by confidence
 */
export async function findMatchingBills(
  transaction: TransactionForMatching,
  bills: BillForMatching[]
): Promise<BillMatch[]> {
  const matches: BillMatch[] = [];

  // Only match expense transactions to bills
  if (transaction.type !== 'expense') {
    return matches;
  }

  const txKeywords = extractKeywords(transaction.description);

  for (const bill of bills) {
    const reasons: string[] = [];
    let confidence = 0;

    // 1. Check string similarity (40% of score)
    const similarity = calculateSimilarity(
      transaction.description,
      bill.name
    );
    if (similarity >= 40) {
      const similarityPoints = (similarity / 100) * 40;
      confidence += similarityPoints;
      reasons.push(
        `Name match ${similarity}% (${transaction.description} vs ${bill.name})`
      );
    }

    // 2. Check amount match (30% of score)
    const amountMatch = checkAmountMatch(
      transaction.amount,
      bill.expectedAmount,
      bill.amountTolerance
    );
    if (amountMatch) {
      confidence += 30;
      reasons.push(
        `Amount match $${transaction.amount} (±${bill.amountTolerance}%)`
      );
    }

    // 3. Check date match (20% of score)
    const dateMatch = checkDateMatch(transaction.date, bill.dueDate);
    if (dateMatch) {
      confidence += 20;
      reasons.push(`Date match ${new Date(transaction.date).getDate()} vs ${bill.dueDate}`);
    }

    // 4. Check payee patterns if configured (10% bonus)
    if (bill.payeePatterns && bill.payeePatterns.length > 0) {
      const matchesPattern = bill.payeePatterns.some((pattern) => {
        const normalizedPattern = normalizeString(pattern);
        return transaction.description.toLowerCase().includes(pattern) ||
          normalizeString(transaction.description).includes(normalizedPattern);
      });

      if (matchesPattern) {
        confidence += 10;
        reasons.push('Payee pattern matched');
      }
    }

    // Only include matches with confidence >= 50
    if (confidence >= 50) {
      matches.push({
        billId: bill.id,
        billName: bill.name,
        confidence: Math.round(confidence),
        reasons,
        similarity,
        amountMatch,
        dateMatch,
      });
    }
  }

  // Sort by confidence descending
  return matches.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Batch match transactions to bills
 * Returns a map of transaction ID to best matching bill (if any)
 */
export async function batchMatchTransactions(
  transactions: TransactionForMatching[],
  bills: BillForMatching[],
  minConfidence: number = 70
): Promise<Map<string, BillMatch>> {
  const results = new Map<string, BillMatch>();

  for (const transaction of transactions) {
    const matches = await findMatchingBills(transaction, bills);

    // Take the best match if confidence is high enough
    if (matches.length > 0 && matches[0].confidence >= minConfidence) {
      results.set(transaction.id, matches[0]);
    }
  }

  return results;
}
