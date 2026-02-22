import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';

import { amountToCents } from '@/lib/transactions/money-movement-service';
import { loadCreateAccountsOrResponse } from '@/lib/transactions/transaction-create-resource-load';
import { executeCreateRuleApplication } from '@/lib/transactions/transaction-create-rule-orchestration';
import { type CreateTransactionBody, type GoalContribution } from '@/lib/transactions/transaction-create-request';
import { executeCreateBranchOrResponse } from '@/lib/transactions/transaction-create-branch-run';
import { finalizeCreatedTransaction } from '@/lib/transactions/transaction-create-finalization';
import { normalizeCreateTransactionBody } from '@/lib/transactions/transaction-create-request-fields';

export async function executeCreateTransactionOrchestration({
  userId,
  householdId,
  selectedEntityId,
  body,
  startTime,
}: {
  userId: string;
  householdId: string;
  selectedEntityId: string;
  body: CreateTransactionBody;
  startTime: number;
}): Promise<Response> {
  const {
    accountId,
    categoryId,
    merchantId,
    debtId,
    billInstanceId,
    date,
    amount,
    description,
    notes,
    type,
    isPending,
    toAccountId,
    isSalesTaxable,
    offlineId,
    syncStatus,
    savingsGoalId,
    goalContributions,
  } = normalizeCreateTransactionBody(body);

  const createResources = await loadCreateAccountsOrResponse({
    userId,
    householdId,
    accountId,
    toAccountId,
    categoryId,
    type,
    selectedEntityId,
  });
  if (createResources instanceof Response) {
    return createResources;
  }
  const { account, toAccount } = createResources;

  const {
    appliedCategoryId,
    appliedRuleId,
    appliedActions,
    finalDescription,
    finalMerchantId,
    postCreationMutations,
  } = await executeCreateRuleApplication({
    userId,
    householdId,
    accountId,
    accountName: account.name,
    merchantId,
    categoryId,
    amount,
    date,
    notes,
    type,
    description,
  });

  const decimalAmount = new Decimal(amount);
  const amountCents = amountToCents(decimalAmount);
  const transactionId = nanoid();
  const createBranchResult = await executeCreateBranchOrResponse({
    userId,
    householdId,
    transactionId,
    type,
    accountId,
    account,
    toAccountId,
    toAccount,
    decimalAmount,
    amountCents,
    date,
    description,
    notes,
    isPending,
    savingsGoalId,
    goalContributions: goalContributions as GoalContribution[] | undefined,
    offlineId,
    syncStatus,
    appliedCategoryId,
    finalMerchantId,
    debtId,
    isSalesTaxable,
    postCreationMutations,
  });
  if (createBranchResult instanceof Response) {
    return createBranchResult;
  }
  const { transferInId } = createBranchResult;

  return finalizeCreatedTransaction({
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
  });
}
