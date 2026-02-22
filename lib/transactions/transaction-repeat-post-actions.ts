import { nanoid } from 'nanoid';

import { db } from '@/lib/db';
import { ruleExecutionLog } from '@/lib/db/schema';
import type { TransactionMutations } from '@/lib/rules/types';
import { handleAccountChange } from '@/lib/rules/account-action-handler';
import { handleSplitCreation } from '@/lib/rules/split-action-handler';
import { handleTransferConversion } from '@/lib/rules/transfer-action-handler';

export async function logRepeatRuleExecution({
  userId,
  householdId,
  appliedRuleId,
  transactionId,
  appliedCategoryId,
  appliedActions,
}: {
  userId: string;
  householdId: string;
  appliedRuleId: string | null;
  transactionId: string;
  appliedCategoryId: string | null;
  appliedActions: unknown[];
}): Promise<void> {
  if (!appliedRuleId) {
    return;
  }

  try {
    await db.insert(ruleExecutionLog).values({
      id: nanoid(),
      userId,
      householdId,
      ruleId: appliedRuleId,
      transactionId,
      appliedCategoryId: appliedCategoryId || null,
      appliedActions: appliedActions.length > 0 ? JSON.stringify(appliedActions) : null,
      matched: true,
      executedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error logging rule execution:', error);
  }
}

export async function runRepeatPostCreationActions({
  userId,
  transactionId,
  postCreationMutations,
}: {
  userId: string;
  transactionId: string;
  postCreationMutations: TransactionMutations | null;
}): Promise<void> {
  if (postCreationMutations?.convertToTransfer) {
    try {
      const transferResult = await handleTransferConversion(
        userId,
        transactionId,
        postCreationMutations.convertToTransfer
      );

      if (!transferResult.success) {
        console.warn('Repeat transaction transfer conversion failed:', transferResult.error);
      }
    } catch (error) {
      console.error('Error converting repeated transaction to transfer:', error);
    }
  }

  if (postCreationMutations?.createSplits) {
    try {
      const splitResult = await handleSplitCreation(
        userId,
        transactionId,
        postCreationMutations.createSplits
      );

      if (!splitResult.success) {
        console.warn('Repeat transaction split creation failed:', splitResult.error);
      }
    } catch (error) {
      console.error('Error creating splits for repeated transaction:', error);
    }
  }

  if (postCreationMutations?.changeAccount) {
    try {
      const accountResult = await handleAccountChange(
        userId,
        transactionId,
        postCreationMutations.changeAccount.targetAccountId
      );

      if (!accountResult.success) {
        console.warn('Repeat transaction account change failed:', accountResult.error);
      }
    } catch (error) {
      console.error('Error changing account for repeated transaction:', error);
    }
  }
}
