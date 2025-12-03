/**
 * Credit Limit History Tracking
 * 
 * Functions for tracking credit limit changes over time.
 * Used when creating/editing credit card accounts and lines of credit.
 */

import { db } from '@/lib/db';
import { creditLimitHistory } from '@/lib/db/schema';
import { nanoid } from 'nanoid';

export type CreditLimitChangeReason = 'user_update' | 'bank_increase' | 'bank_decrease' | 'initial';

interface TrackCreditLimitChangeParams {
  accountId: string;
  userId: string;
  householdId: string;
  previousLimit: number | null;
  newLimit: number;
  changeReason?: CreditLimitChangeReason;
  currentBalance?: number;
}

/**
 * Records a credit limit change in the history table.
 * Automatically calculates utilization percentages.
 * 
 * @param params - The parameters for the credit limit change
 */
export async function trackCreditLimitChange({
  accountId,
  userId,
  householdId,
  previousLimit,
  newLimit,
  changeReason = 'user_update',
  currentBalance = 0,
}: TrackCreditLimitChangeParams): Promise<void> {
  // Calculate utilization percentages
  const utilizationBefore = previousLimit && previousLimit > 0 
    ? (currentBalance / previousLimit) * 100 
    : null;
  
  const utilizationAfter = newLimit > 0 
    ? (currentBalance / newLimit) * 100 
    : 0;

  const now = new Date();
  const nowString = now.toISOString();
  const dateString = nowString.split('T')[0]; // YYYY-MM-DD format

  await db.insert(creditLimitHistory).values({
    id: nanoid(),
    accountId,
    userId,
    householdId,
    previousLimit,
    newLimit,
    changeDate: dateString,
    changeReason,
    utilizationBefore,
    utilizationAfter,
    createdAt: nowString,
  });
}

/**
 * Determines the appropriate change reason based on limit comparison.
 * 
 * @param previousLimit - The previous credit limit
 * @param newLimit - The new credit limit
 * @returns The change reason
 */
export function determineChangeReason(
  previousLimit: number | null,
  newLimit: number
): CreditLimitChangeReason {
  if (previousLimit === null) {
    return 'initial';
  }
  
  if (newLimit > previousLimit) {
    return 'bank_increase';
  }
  
  if (newLimit < previousLimit) {
    return 'bank_decrease';
  }
  
  // Same limit, but user explicitly updated
  return 'user_update';
}

/**
 * Records an initial credit limit when creating a new credit account.
 * 
 * @param params - The parameters for the initial credit limit
 */
export async function trackInitialCreditLimit({
  accountId,
  userId,
  householdId,
  creditLimit,
  currentBalance = 0,
}: {
  accountId: string;
  userId: string;
  householdId: string;
  creditLimit: number;
  currentBalance?: number;
}): Promise<void> {
  await trackCreditLimitChange({
    accountId,
    userId,
    householdId,
    previousLimit: null,
    newLimit: creditLimit,
    changeReason: 'initial',
    currentBalance,
  });
}

