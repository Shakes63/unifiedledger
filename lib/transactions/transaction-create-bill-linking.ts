import {
  EMPTY_BILL_LINK_RESULT,
  executeCreateBillLink,
} from '@/lib/transactions/transaction-create-bill-linking-flow';
import { findCreateBillLinkMatch } from '@/lib/transactions/transaction-create-bill-linking-stages';

interface AutoLinkCreatedExpenseBillParams {
  transactionId: string;
  userId: string;
  householdId: string;
  type: string;
  billInstanceId?: string;
  accountId: string;
  description: string;
  amount: number;
  date: string;
  appliedCategoryId?: string | null;
}

export async function autoLinkCreatedExpenseBill({
  transactionId,
  userId,
  householdId,
  type,
  billInstanceId,
  accountId,
  description,
  amount,
  date,
  appliedCategoryId,
}: AutoLinkCreatedExpenseBillParams): Promise<{
  linkedBillId: string | null;
  linkedInstanceId: string | null;
}> {
  try {
    if (type !== 'expense') {
      return EMPTY_BILL_LINK_RESULT;
    }

    const match = await findCreateBillLinkMatch({
      transactionId,
      userId,
      householdId,
      billInstanceId,
      accountId,
      description,
      amount,
      date,
      type,
      appliedCategoryId,
    });
    if (!match) {
      return EMPTY_BILL_LINK_RESULT;
    }

    return executeCreateBillLink({
      match,
      transactionId,
      userId,
      householdId,
      accountId,
      amount,
      date,
    });
  } catch (error) {
    console.error('Error auto-linking bill:', error);
    return EMPTY_BILL_LINK_RESULT;
  }
}
