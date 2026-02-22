import Decimal from 'decimal.js';

import { autoLinkCreatedExpenseBill } from '@/lib/transactions/transaction-create-bill-linking';
import { logTransactionCreateAudit } from '@/lib/transactions/transaction-create-audit';
import { linkTransactionDebt } from '@/lib/transactions/transaction-create-debt-linking';
import {
  buildCreateTransactionSuccessResponse,
  isCreatedTransactionSalesTaxable,
} from '@/lib/transactions/transaction-create-finalization-helpers';
import { runTransactionCreateMetadataUpdates } from '@/lib/transactions/transaction-create-post-metadata';
import { logTransactionCreatePerformance } from '@/lib/transactions/transaction-create-performance';

export async function finalizeCreatedTransaction({
  userId,
  householdId,
  transactionId,
  transferInId,
  accountId,
  categoryId,
  finalMerchantId,
  decimalAmount,
  appliedRuleId,
  appliedCategoryId,
  appliedActions,
  type,
  billInstanceId,
  description,
  finalDescription,
  date,
  debtId,
  notes,
  isPending,
  startTime,
  postCreationMutations,
  isSalesTaxable,
}: {
  userId: string;
  householdId: string;
  transactionId: string;
  transferInId: string | null;
  accountId: string;
  categoryId?: string | null;
  finalMerchantId: string | null;
  decimalAmount: Decimal;
  appliedRuleId: string | null;
  appliedCategoryId: string | null;
  appliedActions: unknown[];
  type: string;
  billInstanceId?: string | null;
  description: string;
  finalDescription: string;
  date: string;
  debtId?: string | null;
  notes?: string | null;
  isPending: boolean;
  startTime: number;
  postCreationMutations: {
    isTaxDeductible?: boolean;
    isSalesTaxable?: boolean;
  } | null;
  isSalesTaxable: boolean;
}): Promise<Response> {
  await runTransactionCreateMetadataUpdates({
    userId,
    householdId,
    transactionId,
    categoryId,
    finalMerchantId,
    decimalAmount,
    appliedRuleId,
    appliedCategoryId,
    appliedActions,
  });

  const { linkedBillId } = await autoLinkCreatedExpenseBill({
    transactionId,
    userId,
    householdId,
    type,
    billInstanceId: billInstanceId ?? undefined,
    accountId,
    description,
    amount: decimalAmount.toNumber(),
    date,
    appliedCategoryId,
  });

  const { linkedDebtId } = await linkTransactionDebt({
    transactionId,
    userId,
    householdId,
    type,
    linkedBillId,
    appliedCategoryId,
    directDebtId: debtId,
    amount: decimalAmount.toNumber(),
    date,
    description,
  });

  logTransactionCreatePerformance({
    startTime,
    type,
    appliedCategoryId,
    finalMerchantId,
    linkedBillId,
    linkedDebtId,
    appliedRuleId,
  });

  await logTransactionCreateAudit({
    transactionId,
    userId,
    householdId,
    accountId,
    appliedCategoryId,
    finalMerchantId,
    date,
    amount: decimalAmount.toNumber(),
    description: finalDescription,
    notes: notes ?? undefined,
    type,
    isPending,
    linkedBillId,
    linkedDebtId,
    debtId,
    isTaxDeductible: postCreationMutations?.isTaxDeductible || false,
    isSalesTaxable: isCreatedTransactionSalesTaxable({
      type,
      isSalesTaxable,
      postCreationSalesTaxable: postCreationMutations?.isSalesTaxable || false,
    }),
  });

  return buildCreateTransactionSuccessResponse({
    transactionId,
    transferInId,
    appliedCategoryId,
    appliedRuleId,
    linkedBillId,
    linkedDebtId,
  });
}
