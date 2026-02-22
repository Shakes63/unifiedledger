import { executeCreateBillLinkMatch } from '@/lib/transactions/transaction-create-bill-linking-execution';
import type { CreateBillLinkMatch } from '@/lib/transactions/transaction-create-bill-linking-types';

interface BillLinkResult {
  linkedBillId: string | null;
  linkedInstanceId: string | null;
}

export const EMPTY_BILL_LINK_RESULT: BillLinkResult = {
  linkedBillId: null,
  linkedInstanceId: null,
};

export async function executeCreateBillLink({
  match,
  transactionId,
  userId,
  householdId,
  accountId,
  amount,
  date,
}: {
  match: CreateBillLinkMatch;
  transactionId: string;
  userId: string;
  householdId: string;
  accountId: string;
  amount: number;
  date: string;
}): Promise<BillLinkResult> {
  return executeCreateBillLinkMatch({
    match,
    transactionId,
    userId,
    householdId,
    accountId,
    amount,
    date,
  });
}
