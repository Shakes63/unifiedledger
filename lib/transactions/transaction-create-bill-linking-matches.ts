import { findBestChargedAccountBillMatch } from '@/lib/transactions/transaction-bill-linking-helpers';
import { formatCreateBillLinkMatch } from '@/lib/transactions/transaction-create-bill-linking-match-format';
import {
  findScopedPendingBillInstanceById,
  listChargedAccountPendingBills,
} from '@/lib/transactions/transaction-create-bill-linking-queries';
import type { CreateBillLinkMatch } from '@/lib/transactions/transaction-create-bill-linking-types';

interface MatchBaseParams {
  userId: string;
  householdId: string;
  accountId: string;
  description: string;
  amount: number;
  date: string;
  transactionId: string;
}

export async function matchByExplicitBillInstance({
  billInstanceId,
  ...params
}: MatchBaseParams & { billInstanceId?: string }): Promise<CreateBillLinkMatch | null> {
  if (!billInstanceId) {
    return null;
  }

  const instance = await findScopedPendingBillInstanceById({
    billInstanceId,
    userId: params.userId,
    householdId: params.householdId,
  });

  if (!instance) {
    return null;
  }

  return formatCreateBillLinkMatch({
    billId: instance.bill.id,
    instanceId: instance.instance.id,
    billName: instance.bill.name,
    legacyDebtId: instance.bill.debtId,
    notes: `Bill payment: ${instance.bill.name}`,
    logMessage: (paymentStatus) =>
      `Bill payment processed: ${instance.bill.id}, Status: ${paymentStatus}`,
  });
}

export async function matchByChargedAccount({
  userId,
  householdId,
  accountId,
  description,
  amount,
  date,
}: MatchBaseParams): Promise<CreateBillLinkMatch | null> {
  const chargedToBills = await listChargedAccountPendingBills({
    userId,
    householdId,
    accountId,
  });

  if (chargedToBills.length === 0) {
    return null;
  }

  const bestMatch = findBestChargedAccountBillMatch({
    chargedToBills,
    description,
    amount,
    date,
  });

  if (!bestMatch) {
    return null;
  }

  return formatCreateBillLinkMatch({
    billId: bestMatch.bill.id,
    instanceId: bestMatch.instance.id,
    billName: bestMatch.bill.name,
    legacyDebtId: bestMatch.bill.debtId,
    notes: `Auto-matched from chargedToAccountId: ${bestMatch.bill.name}`,
    logMessage: (paymentStatus) =>
      `ChargedToAccountId match: ${bestMatch.bill.id}, Score: ${bestMatch.score}, Status: ${paymentStatus}`,
  });
}
