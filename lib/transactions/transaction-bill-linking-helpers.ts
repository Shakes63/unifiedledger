import { distance } from 'fastest-levenshtein';

import { apiDebugLog } from '@/lib/api/route-helpers';
import { processAndLinkBillPayment } from '@/lib/transactions/payment-linkage';

export async function processLinkedBillPaymentWithLog({
  transactionId,
  userId,
  householdId,
  accountId,
  amount,
  date,
  linkedBillId,
  linkedInstanceId,
  billName,
  legacyDebtId,
  notes,
  logScope,
  logMessage,
}: {
  transactionId: string;
  userId: string;
  householdId: string;
  accountId: string;
  amount: number;
  date: string;
  linkedBillId: string;
  linkedInstanceId: string;
  billName: string;
  legacyDebtId: string | null;
  notes: string;
  logScope: string;
  logMessage: (paymentStatus: string) => string;
}): Promise<void> {
  const billLinkResult = await processAndLinkBillPayment({
    billId: linkedBillId,
    billName,
    instanceId: linkedInstanceId,
    transactionId,
    paymentAmount: amount,
    paymentDate: date,
    userId,
    householdId,
    paymentMethod: 'manual',
    linkedAccountId: accountId,
    notes,
    legacyDebtId,
  });

  if (billLinkResult.success) {
    apiDebugLog(logScope, logMessage(billLinkResult.paymentResult.paymentStatus));
  }
}

interface ChargedAccountBillCandidate {
  bill: {
    id: string;
    name: string;
    debtId: string | null;
    amountTolerance: number | null;
    expectedAmount: number;
  };
  instance: {
    id: string;
    dueDate: string;
    expectedAmount: number;
  };
}

export function findBestChargedAccountBillMatch({
  chargedToBills,
  description,
  amount,
  date,
}: {
  chargedToBills: ChargedAccountBillCandidate[];
  description: string;
  amount: number;
  date: string;
}): { bill: ChargedAccountBillCandidate['bill']; instance: ChargedAccountBillCandidate['instance']; score: number } | null {
  const transactionDescLower = description.toLowerCase();
  const transactionDate = new Date(date);
  let bestMatch: {
    bill: ChargedAccountBillCandidate['bill'];
    instance: ChargedAccountBillCandidate['instance'];
    score: number;
  } | null = null;

  for (const { bill, instance } of chargedToBills) {
    let score = 0;

    const billNameLower = bill.name.toLowerCase();
    const maxLen = Math.max(transactionDescLower.length, billNameLower.length);
    const descSimilarity = maxLen > 0 ? 1 - distance(transactionDescLower, billNameLower) / maxLen : 0;
    score += descSimilarity * 40;

    const amountTolerance = bill.amountTolerance || 5;
    const expectedAmount = instance.expectedAmount || bill.expectedAmount;
    const amountDiff = (Math.abs(amount - expectedAmount) / expectedAmount) * 100;
    if (amountDiff <= amountTolerance) {
      score += 30 * (1 - amountDiff / amountTolerance);
    }

    const dueDate = new Date(instance.dueDate);
    const dateDiffDays = Math.abs(
      Math.floor((transactionDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    );
    if (dateDiffDays <= 3) {
      score += 30 * (1 - dateDiffDays / 3);
    }

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { bill, instance, score };
    }
  }

  return bestMatch && bestMatch.score >= 85 ? bestMatch : null;
}
