import Decimal from 'decimal.js';

import { apiDebugLog } from '@/lib/api/route-helpers';
import { findCreditPaymentBillInstance, processBillPayment } from '@/lib/bills/bill-payment-utils';
import { accounts } from '@/lib/db/schema';

export async function executeCreditDestinationBillAutoLink({
  destinationAccount,
  destinationAccountId,
  sourceAccountId,
  transferInId,
  amount,
  date,
  userId,
  householdId,
  description,
  isBalanceTransfer,
}: {
  destinationAccount: typeof accounts.$inferSelect;
  destinationAccountId: string;
  sourceAccountId: string;
  transferInId: string;
  amount: Decimal;
  date: string;
  userId: string;
  householdId: string;
  description: string;
  isBalanceTransfer: boolean;
}): Promise<void> {
  const destinationIsCredit =
    destinationAccount.type === 'credit' || destinationAccount.type === 'line_of_credit';
  if (!destinationIsCredit || isBalanceTransfer) {
    return;
  }

  try {
    const billMatch = await findCreditPaymentBillInstance(
      destinationAccountId,
      amount.toNumber(),
      date,
      userId,
      householdId,
      7
    );
    if (!billMatch) {
      return;
    }

    const paymentResult = await processBillPayment({
      billId: billMatch.billId,
      instanceId: billMatch.instanceId,
      transactionId: transferInId,
      paymentAmount: amount.toNumber(),
      paymentDate: date,
      userId,
      householdId,
      paymentMethod: 'transfer',
      linkedAccountId: sourceAccountId,
      notes: `Auto-linked from transfer: ${description}`,
    });

    if (paymentResult.success) {
      apiDebugLog(
        'transactions:create',
        `Credit card payment auto-linked: Bill ${billMatch.billId}, Instance ${billMatch.instanceId}, Status: ${paymentResult.paymentStatus}`
      );
    }
  } catch (error) {
    console.error('Error auto-linking credit card payment to bill:', error);
  }
}
