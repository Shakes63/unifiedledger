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

  if (!accountId) {
    return Response.json({ error: 'Account is required' }, { status: 400 });
  }
  if (amount === undefined || amount === null || amount === '') {
    return Response.json({ error: 'Amount is required' }, { status: 400 });
  }
  if (!date) {
    return Response.json({ error: 'Date is required' }, { status: 400 });
  }
  if (!type) {
    return Response.json({ error: 'Type is required' }, { status: 400 });
  }
  if (!description) {
    return Response.json({ error: 'Description is required' }, { status: 400 });
  }

  const resolvedAmount = String(amount);
  const resolvedDate = String(date);
  const resolvedType = String(type);
  const resolvedDescription = String(description);
  const resolvedCategoryId = categoryId ?? null;

  const createResources = await loadCreateAccountsOrResponse({
    userId,
    householdId,
    accountId,
    toAccountId: toAccountId ?? null,
    categoryId: resolvedCategoryId,
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
    categoryId: resolvedCategoryId,
    amount: resolvedAmount,
    date: resolvedDate,
    notes: notes ?? undefined,
    type: resolvedType,
    description: resolvedDescription,
  });

  const decimalAmount = new Decimal(resolvedAmount);
  const amountCents = amountToCents(decimalAmount);
  const transactionId = nanoid();
  const createBranchResult = await executeCreateBranchOrResponse({
    userId,
    householdId,
    transactionId,
    type: resolvedType as 'income' | 'expense' | 'transfer' | 'transfer_in' | 'transfer_out',
    accountId,
    account,
    toAccountId: toAccountId ?? null,
    toAccount,
    decimalAmount,
    amountCents,
    date: resolvedDate,
    description: resolvedDescription,
    notes: notes ?? null,
    isPending,
    savingsGoalId: savingsGoalId ?? null,
    goalContributions: goalContributions as GoalContribution[] | undefined,
    offlineId: offlineId ?? null,
    syncStatus: syncStatus ?? null,
    appliedCategoryId,
    finalMerchantId,
    debtId: debtId ?? null,
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
    categoryId: resolvedCategoryId,
    finalMerchantId,
    decimalAmount,
    appliedRuleId,
    appliedCategoryId,
    appliedActions,
    type: resolvedType,
    billInstanceId,
    description: resolvedDescription,
    finalDescription,
    date: resolvedDate,
    debtId,
    notes,
    isPending,
    startTime,
    postCreationMutations,
    isSalesTaxable,
  });
}
