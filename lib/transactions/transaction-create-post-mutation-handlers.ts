import { apiDebugLog } from '@/lib/api/route-helpers';
import { handleAccountChange } from '@/lib/rules/account-action-handler';
import { handleSplitCreation } from '@/lib/rules/split-action-handler';
import { handleTransferConversion } from '@/lib/rules/transfer-action-handler';
import { autoClassifyTransaction } from '@/lib/tax/auto-classify';
import type { TransactionMutations } from '@/lib/rules/types';

export async function runTransferConversionMutation({
  userId,
  transactionId,
  postCreationMutations,
}: {
  userId: string;
  transactionId: string;
  postCreationMutations?: TransactionMutations;
}) {
  if (!postCreationMutations?.convertToTransfer) return;

  try {
    const transferResult = await handleTransferConversion(
      userId,
      transactionId,
      postCreationMutations.convertToTransfer
    );

    if (!transferResult.success) {
      console.error('Transfer conversion failed:', transferResult.error);
    } else if (transferResult.matchedTransactionId) {
      apiDebugLog(
        'transactions:create',
        `Transfer conversion: matched with transaction ${transferResult.matchedTransactionId}`
      );
    } else if (transferResult.createdTransactionId) {
      apiDebugLog(
        'transactions:create',
        `Transfer conversion: created new transaction ${transferResult.createdTransactionId}`
      );
    }
  } catch (error) {
    console.error('Transfer conversion error:', error);
  }
}

export async function runSplitCreationMutation({
  userId,
  transactionId,
  postCreationMutations,
}: {
  userId: string;
  transactionId: string;
  postCreationMutations?: TransactionMutations;
}) {
  if (!postCreationMutations?.createSplits) return;

  try {
    const splitResult = await handleSplitCreation(
      userId,
      transactionId,
      postCreationMutations.createSplits
    );

    if (!splitResult.success) {
      console.error('Split creation failed:', splitResult.error);
    } else {
      apiDebugLog(
        'transactions:create',
        `Split creation: created ${splitResult.createdSplits.length} splits`
      );
    }
  } catch (error) {
    console.error('Split creation error:', error);
  }
}

export async function runAccountChangeMutation({
  userId,
  transactionId,
  postCreationMutations,
}: {
  userId: string;
  transactionId: string;
  postCreationMutations?: TransactionMutations;
}) {
  if (!postCreationMutations?.changeAccount) return;

  try {
    const accountResult = await handleAccountChange(
      userId,
      transactionId,
      postCreationMutations.changeAccount.targetAccountId
    );

    if (!accountResult.success) {
      console.error('Account change failed:', accountResult.error);
    } else {
      apiDebugLog(
        'transactions:create',
        `Account change: moved from ${accountResult.oldAccountId} to ${accountResult.newAccountId}`
      );
    }
  } catch (error) {
    console.error('Account change error:', error);
  }
}

export async function runTaxAutoClassification({
  userId,
  householdId,
  transactionId,
  appliedCategoryId,
  amount,
  date,
  postCreationMutations,
}: {
  userId: string;
  householdId: string;
  transactionId: string;
  appliedCategoryId: string | null;
  amount: number;
  date: string;
  postCreationMutations?: TransactionMutations;
}) {
  const isTaxDeductible = postCreationMutations?.isTaxDeductible || false;
  if (!isTaxDeductible || !appliedCategoryId) return;

  try {
    const taxClassification = await autoClassifyTransaction(
      userId,
      householdId,
      transactionId,
      appliedCategoryId,
      amount,
      date,
      isTaxDeductible
    );
    if (taxClassification) {
      apiDebugLog(
        'transactions:create',
        `[TAX] Auto-classified transaction ${transactionId} to ${taxClassification.taxCategoryName}`
      );
    }
  } catch (error) {
    console.error('Error auto-classifying transaction for tax:', error);
  }
}
