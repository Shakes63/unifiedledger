/**
 * Branch execution for the transaction CREATE flow: routes a validated create
 * request to the transfer branch (paired transfer legs) or the non-transfer
 * branch (single movement + goal contributions, debt linking deferral, and
 * rule-driven post-mutations).
 *
 * Consolidated from 7 single-use shim files (goal-contributions /
 * post-mutations / nontransfer-execution / nontransfer-branch /
 * transfer-branch / branch-execution / branch-run) during the post-audit
 * cleanup; behavior is unchanged.
 */
import { handleGoalContribution, handleMultipleContributions } from '@/lib/goals/contribution-handler';
import { apiDebugLog } from '@/lib/api/route-helpers';
import { autoClassifyTransaction } from '@/lib/tax/auto-classify';
import { handleAccountChange } from '@/lib/rules/account-action-handler';
import { handleSplitCreation } from '@/lib/rules/split-action-handler';
import { handleTransferConversion } from '@/lib/rules/transfer-action-handler';
import type { TransactionMutations } from '@/lib/rules/types';
import { and, eq } from 'drizzle-orm';
import { runInDatabaseTransaction } from '@/lib/db/transaction-runner';
import { db } from '@/lib/db';
import { accounts, merchants } from '@/lib/db/schema';
import { resolveAccountEntityId } from '@/lib/household/entities';
import {
  computeBalanceDeltaCents,
  getAccountBalanceCents,
  insertTransactionMovement,
  updateScopedAccountBalance,
} from '@/lib/transactions/money-movement-service';
import Decimal from 'decimal.js';
import type { GoalContribution } from '@/lib/transactions/transaction-create-request';
import { createTransferTransactionBranch } from '@/lib/transactions/transaction-transfer-create';

// ---------------------------------------------------------------------------
// from transaction-create-goal-contributions.ts
// ---------------------------------------------------------------------------
interface HandleTransactionGoalContributionsParams {
  transactionId: string;
  userId: string;
  householdId: string;
  amount: number;
  savingsGoalId?: string;
  goalContributions?: GoalContribution[];
}

async function handleTransactionGoalContributions({
  transactionId,
  userId,
  householdId,
  amount,
  savingsGoalId,
  goalContributions,
}: HandleTransactionGoalContributionsParams): Promise<void> {
  if (!savingsGoalId && (!goalContributions || goalContributions.length === 0)) {
    return;
  }

  try {
    if (goalContributions && goalContributions.length > 0) {
      // Contributions cannot exceed the funding transaction (M-DBG-12: a $10
      // transaction with a $10,000 goalContributions payload previously credited
      // the goal $10,000 and fired milestones).
      const totalRequested = goalContributions.reduce(
        (sum, contribution) => sum + (Number(contribution.amount) || 0),
        0
      );
      if (totalRequested > Math.abs(amount) + 0.005) {
        console.error(
          `Goal contributions (${totalRequested}) exceed transaction amount (${amount}); skipping`
        );
        return;
      }

      const contributionResults = await handleMultipleContributions(
        goalContributions,
        transactionId,
        userId,
        householdId
      );
      const achievedMilestones = contributionResults.flatMap((result) => result.milestonesAchieved);
      if (achievedMilestones.length > 0) {
        apiDebugLog(
          'transactions:create',
          `Transaction ${transactionId}: Milestones achieved: ${achievedMilestones.join(', ')}%`
        );
      }
      return;
    }

    if (!savingsGoalId) {
      return;
    }

    const result = await handleGoalContribution(
      savingsGoalId,
      Math.abs(amount),
      transactionId,
      userId,
      householdId
    );
    if (result.milestonesAchieved.length > 0) {
      apiDebugLog(
        'transactions:create',
        `Transaction ${transactionId}: Milestones achieved: ${result.milestonesAchieved.join(', ')}%`
      );
    }
  } catch (error) {
    console.error('Error handling savings goal contribution:', error);
  }
}

// ---------------------------------------------------------------------------
// from transaction-create-post-mutations.ts
// ---------------------------------------------------------------------------
interface RunTransactionCreatePostMutationsParams {
  userId: string;
  householdId: string;
  transactionId: string;
  postCreationMutations?: TransactionMutations;
  transactionIsTaxDeductible?: boolean;
  appliedCategoryId: string | null;
  amount: number;
  date: string;
  savingsGoalId?: string;
  goalContributions?: GoalContribution[];
}

async function runTransactionCreatePostMutations({
  userId,
  householdId,
  transactionId,
  postCreationMutations,
  transactionIsTaxDeductible,
  appliedCategoryId,
  amount,
  date,
  savingsGoalId,
  goalContributions,
}: RunTransactionCreatePostMutationsParams): Promise<void> {
  if (postCreationMutations?.convertToTransfer) {
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

  if (postCreationMutations?.createSplits) {
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

  if (postCreationMutations?.changeAccount) {
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

  const isTaxDeductible =
    transactionIsTaxDeductible ?? postCreationMutations?.isTaxDeductible ?? false;
  if (isTaxDeductible && appliedCategoryId) {
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

  await handleTransactionGoalContributions({
    transactionId,
    userId,
    householdId,
    amount,
    savingsGoalId,
    goalContributions,
  });
}

// ---------------------------------------------------------------------------
// from transaction-create-nontransfer-execution.ts
// ---------------------------------------------------------------------------
interface ExecuteNonTransferCreateParams {
  userId: string;
  householdId: string;
  transactionId: string;
  accountId: string;
  account: {
    type: string;
    entityId?: string | null;
    usageCount?: number | null;
    currentBalance?: number | null;
    currentBalanceCents: number | null;
    enableTaxDeductions?: boolean | null;
    isBusinessAccount?: boolean | null;
  };
  appliedCategoryId: string | null;
  finalMerchantId: string | null;
  debtId?: string;
  savingsGoalId?: string;
  date: string;
  amountCents: number;
  finalDescription: string;
  notes?: string;
  type: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
  isPending: boolean;
  isSalesTaxable: boolean;
  postCreationMutations: TransactionMutations | null;
  effectiveIsTaxDeductible: boolean;
  effectiveTaxDeductionType: 'business' | 'personal' | 'none';
  offlineId?: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error' | 'offline';
}

async function executeNonTransferCreate({
  userId,
  householdId,
  transactionId,
  accountId,
  account,
  appliedCategoryId,
  finalMerchantId,
  debtId,
  savingsGoalId,
  date,
  amountCents,
  finalDescription,
  notes,
  type,
  isPending,
  isSalesTaxable,
  postCreationMutations,
  effectiveIsTaxDeductible,
  effectiveTaxDeductionType,
  offlineId,
  syncStatus,
}: ExecuteNonTransferCreateParams): Promise<void> {
  let merchantIsSalesTaxExempt = false;
  if (type === 'income' && finalMerchantId) {
    const merchantExemptCheck = await db
      .select({ isSalesTaxExempt: merchants.isSalesTaxExempt })
      .from(merchants)
      .where(eq(merchants.id, finalMerchantId))
      .limit(1);
    merchantIsSalesTaxExempt = merchantExemptCheck[0]?.isSalesTaxExempt || false;
  }

  const accountIsCreditAccount = account.type === 'credit' || account.type === 'line_of_credit';
  const isRefund = type === 'income' && accountIsCreditAccount;

  await runInDatabaseTransaction(async (tx) => {
    const nowIso = new Date().toISOString();
    const transactionEntityId = await resolveAccountEntityId(
      householdId,
      userId,
      account.entityId
    );

    await insertTransactionMovement(tx, {
      id: transactionId,
      userId,
      householdId,
      entityId: transactionEntityId,
      accountId,
      categoryId: appliedCategoryId || null,
      merchantId: finalMerchantId || null,
      debtId: debtId || null,
      savingsGoalId: savingsGoalId || null,
      date,
      amountCents,
      description: finalDescription,
      notes: notes || null,
      type,
      transferId: null,
      transferSourceAccountId: null,
      transferDestinationAccountId: null,
      isPending,
      isRefund,
      isTaxDeductible: effectiveIsTaxDeductible,
      taxDeductionType: effectiveTaxDeductionType,
      isSalesTaxable:
        (type === 'income' &&
          !merchantIsSalesTaxExempt &&
          (isSalesTaxable || postCreationMutations?.isSalesTaxable)) ||
        false,
      offlineId: offlineId || null,
      syncStatus,
      syncedAt: syncStatus === 'synced' ? nowIso : null,
      syncAttempts: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    // Read the balance INSIDE the transaction (not from the pre-load) so a
    // concurrent create can't be lost (C-ATOM-2). transfer_out is a debit like
    // expense; the previous `type === 'expense'` test wrongly ADDED for a lone
    // transfer_out leg (H-TXN-3).
    const [freshAccount] = await tx
      .select({
        currentBalanceCents: accounts.currentBalanceCents,
        usageCount: accounts.usageCount,
      })
      .from(accounts)
      .where(
        and(
          eq(accounts.id, accountId),
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId)
        )
      )
      .limit(1);

    const currentBalanceCents = getAccountBalanceCents(freshAccount ?? account);
    // Liability-aware: on a credit account a charge (expense/transfer_out)
    // INCREASES what you owe; a payment/refund decreases it (C-MATH-1).
    const updatedBalanceCents =
      currentBalanceCents +
      computeBalanceDeltaCents({
        accountType: account.type,
        transactionType: type,
        amountCents,
      });

    await updateScopedAccountBalance(tx, {
      accountId,
      userId,
      householdId,
      balanceCents: updatedBalanceCents,
      lastUsedAt: nowIso,
      usageCount: ((freshAccount?.usageCount ?? account.usageCount) || 0) + 1,
    });
  });
}

// ---------------------------------------------------------------------------
// from transaction-create-nontransfer-branch.ts
// ---------------------------------------------------------------------------
async function executeNonTransferCreateBranch({
  userId,
  householdId,
  transactionId,
  accountId,
  account,
  appliedCategoryId,
  finalMerchantId,
  debtId,
  savingsGoalId,
  date,
  amountCents,
  description,
  notes,
  type,
  isPending,
  isSalesTaxable,
  postCreationMutations,
  effectiveIsTaxDeductible,
  effectiveTaxDeductionType,
  offlineId,
  syncStatus,
  decimalAmount,
  goalContributions,
}: {
  userId: string;
  householdId: string;
  transactionId: string;
  accountId: string;
  account: typeof accounts.$inferSelect;
  appliedCategoryId: string | null;
  finalMerchantId: string | null;
  debtId?: string | null;
  savingsGoalId?: string | null;
  date: string;
  amountCents: number;
  description: string;
  notes?: string | null;
  type: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
  isPending: boolean;
  isSalesTaxable: boolean;
  postCreationMutations: TransactionMutations | null;
  effectiveIsTaxDeductible: boolean;
  effectiveTaxDeductionType: 'business' | 'personal' | 'none';
  offlineId?: string | null;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error' | 'offline';
  decimalAmount: Decimal;
  goalContributions?: GoalContribution[];
}): Promise<void> {
  await executeNonTransferCreate({
    userId,
    householdId,
    transactionId,
    accountId,
    account,
    appliedCategoryId,
    finalMerchantId,
    debtId: debtId ?? undefined,
    savingsGoalId: savingsGoalId ?? undefined,
    date,
    amountCents,
    finalDescription: description,
    notes: notes ?? undefined,
    type,
    isPending,
    isSalesTaxable,
    postCreationMutations,
    effectiveIsTaxDeductible,
    effectiveTaxDeductionType,
    offlineId: offlineId ?? undefined,
    syncStatus,
  });

  await runTransactionCreatePostMutations({
    transactionId,
    userId,
    householdId,
    postCreationMutations: postCreationMutations ?? undefined,
    transactionIsTaxDeductible: effectiveIsTaxDeductible,
    appliedCategoryId,
    amount: decimalAmount.toNumber(),
    date,
    savingsGoalId: savingsGoalId ?? undefined,
    goalContributions,
  });
}

// ---------------------------------------------------------------------------
// from transaction-create-transfer-branch.ts
// ---------------------------------------------------------------------------
function isTransferValidationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message;
  return (
    message.includes('required') ||
    message.includes('Cannot transfer to the same account') ||
    message.includes('Amount must') ||
    message.includes('Date must be a valid date string') ||
    message.includes('Description is required')
  );
}

async function executeTransferCreateBranchOrValidationError({
  userId,
  householdId,
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
  goalContributions,
  offlineId,
  syncStatus,
  transactionId,
}: {
  userId: string;
  householdId: string;
  accountId: string;
  account: typeof accounts.$inferSelect;
  toAccountId?: string;
  toAccount: typeof accounts.$inferSelect | null;
  decimalAmount: Decimal;
  amountCents: number;
  date: string;
  description: string;
  notes?: string | null;
  isPending: boolean;
  savingsGoalId?: string | null;
  goalContributions?: GoalContribution[];
  offlineId?: string | null;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error' | 'offline';
  transactionId: string;
}): Promise<{ transferInId: string | null; validationError: string | null }> {
  if (!toAccount) {
    return {
      transferInId: null,
      validationError: 'Destination account is required for transfer',
    };
  }
  if (!toAccountId) {
    return {
      transferInId: null,
      validationError: 'Destination account is required for transfer',
    };
  }

  try {
    const transferResult = await createTransferTransactionBranch({
      userId,
      householdId,
      sourceAccountId: accountId,
      destinationAccountId: toAccountId,
      sourceAccount: account,
      destinationAccount: toAccount,
      amount: decimalAmount,
      amountCents,
      date,
      description,
      notes: notes || null,
      isPending,
      savingsGoalId: savingsGoalId || null,
      goalContributions: (goalContributions || []) as GoalContribution[],
      offlineId: offlineId || null,
      syncStatus,
      transactionId,
    });

    return { transferInId: transferResult.transferInId, validationError: null };
  } catch (error) {
    if (isTransferValidationError(error)) {
      return {
        transferInId: null,
        validationError: error instanceof Error ? error.message : 'Transfer validation failed',
      };
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// from transaction-create-branch-execution.ts
// ---------------------------------------------------------------------------
async function executeCreateTransactionBranch({
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
  goalContributions,
  offlineId,
  syncStatus,
  appliedCategoryId,
  finalMerchantId,
  debtId,
  isSalesTaxable,
  postCreationMutations,
  effectiveIsTaxDeductible,
  effectiveTaxDeductionType,
}: {
  userId: string;
  householdId: string;
  transactionId: string;
  type: 'income' | 'expense' | 'transfer' | 'transfer_in' | 'transfer_out';
  accountId: string;
  account: typeof accounts.$inferSelect;
  toAccountId?: string;
  toAccount: typeof accounts.$inferSelect | null;
  decimalAmount: Decimal;
  amountCents: number;
  date: string;
  description: string;
  notes?: string | null;
  isPending: boolean;
  savingsGoalId?: string | null;
  goalContributions?: GoalContribution[];
  offlineId?: string | null;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error' | 'offline';
  appliedCategoryId: string | null;
  finalMerchantId: string | null;
  debtId?: string | null;
  isSalesTaxable: boolean;
  postCreationMutations: TransactionMutations | null;
  effectiveIsTaxDeductible: boolean;
  effectiveTaxDeductionType: 'business' | 'personal' | 'none';
}): Promise<{ transferInId: string | null; validationError: string | null }> {
  if (type === 'transfer' && toAccount) {
    return executeTransferCreateBranchOrValidationError({
      userId,
      householdId,
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
      goalContributions,
      offlineId,
      syncStatus,
      transactionId,
    });
  }

  const nonTransferType = type as 'income' | 'expense' | 'transfer_in' | 'transfer_out';

  await executeNonTransferCreateBranch({
    userId,
    householdId,
    transactionId,
    accountId,
    account,
    appliedCategoryId,
    finalMerchantId,
    debtId,
    savingsGoalId,
    date,
    amountCents,
    description,
    notes,
    type: nonTransferType,
    isPending,
    isSalesTaxable,
    postCreationMutations,
    effectiveIsTaxDeductible,
    effectiveTaxDeductionType,
    offlineId,
    syncStatus,
    decimalAmount,
    goalContributions,
  });

  return { transferInId: null, validationError: null };
}

// ---------------------------------------------------------------------------
// from transaction-create-branch-run.ts
// ---------------------------------------------------------------------------
export async function executeCreateBranchOrResponse({
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
  goalContributions,
  offlineId,
  syncStatus,
  appliedCategoryId,
  finalMerchantId,
  debtId,
  isSalesTaxable,
  postCreationMutations,
  effectiveIsTaxDeductible,
  effectiveTaxDeductionType,
}: {
  userId: string;
  householdId: string;
  transactionId: string;
  type: 'income' | 'expense' | 'transfer' | 'transfer_in' | 'transfer_out';
  accountId: string;
  account: typeof accounts.$inferSelect;
  toAccountId: string | null;
  toAccount: typeof accounts.$inferSelect | null;
  decimalAmount: Decimal;
  amountCents: number;
  date: string;
  description: string;
  notes: string | null;
  isPending: boolean;
  savingsGoalId: string | null;
  goalContributions: GoalContribution[] | undefined;
  offlineId: string | null;
  syncStatus: string | null;
  appliedCategoryId: string | null;
  finalMerchantId: string | null;
  debtId: string | null;
  isSalesTaxable: boolean;
  postCreationMutations: TransactionMutations | null;
  effectiveIsTaxDeductible: boolean;
  effectiveTaxDeductionType: 'business' | 'personal' | 'none';
}): Promise<{ transferInId: string | null } | Response> {
  const { transferInId, validationError } = await executeCreateTransactionBranch({
    userId,
    householdId,
    transactionId,
    type,
    accountId,
    account,
    toAccountId: toAccountId ?? undefined,
    toAccount,
    decimalAmount,
    amountCents,
    date,
    description,
    notes,
    isPending,
    savingsGoalId,
    goalContributions,
    offlineId,
    syncStatus: (syncStatus ?? 'pending') as 'pending' | 'syncing' | 'synced' | 'error' | 'offline',
    appliedCategoryId,
    finalMerchantId,
    debtId,
    isSalesTaxable,
    postCreationMutations,
    effectiveIsTaxDeductible,
    effectiveTaxDeductionType,
  });

  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  return { transferInId };
}
