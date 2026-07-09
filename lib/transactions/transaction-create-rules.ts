/**
 * Categorization-rule application for the transaction CREATE flow.
 *
 * When a transaction is created without an explicit category, the matching
 * rule (if any) can set the category, rewrite the description, assign a
 * merchant, and queue post-creation mutations; the execution is then recorded
 * in rule_execution_log.
 *
 * Consolidated from 6 single-use shim files (state / reference-load / helpers /
 * application / orchestration / log) during the post-audit cleanup; behavior
 * is unchanged.
 */
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { db } from '@/lib/db';
import { budgetCategories, merchants, ruleExecutionLog } from '@/lib/db/schema';
import { executeRuleActions } from '@/lib/rules/actions-executor';
import { findMatchingRule } from '@/lib/rules/rule-matcher';
import type { TransactionMutations } from '@/lib/rules/types';

// ---------------------------------------------------------------------------
// State + helpers
// ---------------------------------------------------------------------------

interface CreateRuleApplicationState {
  appliedActions: unknown[];
  appliedCategoryId: string | null;
  appliedRuleId: string | null;
  finalDescription: string;
  finalMerchantId: string | null;
  postCreationMutations: TransactionMutations | null;
}

function createRuleApplicationState({
  appliedCategoryId,
  finalDescription,
  finalMerchantId,
}: {
  appliedCategoryId: string | null;
  finalDescription: string;
  finalMerchantId: string | null;
}): CreateRuleApplicationState {
  return {
    appliedActions: [],
    appliedCategoryId,
    appliedRuleId: null,
    finalDescription,
    finalMerchantId,
    postCreationMutations: null,
  };
}

function shouldSkipCreateRuleApplication({
  appliedCategoryId,
  type,
}: {
  appliedCategoryId: string | null;
  type: string;
}): boolean {
  return (
    Boolean(appliedCategoryId) ||
    type === 'transfer_in' ||
    type === 'transfer_out' ||
    type === 'transfer'
  );
}

function buildRuleTransactionData({
  description,
  amount,
  accountName,
  date,
  notes,
}: {
  description: string;
  amount: string;
  accountName: string;
  date: string;
  notes?: string;
}): {
  description: string;
  amount: number;
  accountName: string;
  date: string;
  notes?: string;
} {
  return {
    description,
    amount: parseFloat(amount),
    accountName,
    date,
    notes: notes || undefined,
  };
}

function mergeRuleMutations({
  appliedCategoryId,
  finalDescription,
  finalMerchantId,
  mutations,
}: {
  appliedCategoryId: string | null;
  finalDescription: string;
  finalMerchantId: string | null;
  mutations: TransactionMutations;
}): {
  appliedCategoryId: string | null;
  finalDescription: string;
  finalMerchantId: string | null;
} {
  let nextCategoryId = appliedCategoryId;
  let nextDescription = finalDescription;
  let nextMerchantId = finalMerchantId;

  if (mutations.categoryId !== undefined) {
    nextCategoryId = mutations.categoryId;
  }
  if (mutations.description) {
    nextDescription = mutations.description;
  }
  if (mutations.merchantId !== undefined) {
    nextMerchantId = mutations.merchantId;
  }

  return {
    appliedCategoryId: nextCategoryId,
    finalDescription: nextDescription,
    finalMerchantId: nextMerchantId,
  };
}

async function loadRuleReferenceData({
  userId,
  householdId,
  merchantId,
  categoryId,
}: {
  userId: string;
  householdId: string;
  merchantId?: string | null;
  categoryId?: string | null;
}): Promise<{
  merchantInfo: { id: string; name: string } | null;
  categoryInfo: { id: string; name: string; type: string } | null;
}> {
  const [merchantResult, categoryResult] = await Promise.all([
    merchantId
      ? db
          .select()
          .from(merchants)
          .where(
            and(
              eq(merchants.id, merchantId),
              eq(merchants.householdId, householdId)
            )
          )
          .limit(1)
      : Promise.resolve([]),
    categoryId
      ? db
          .select()
          .from(budgetCategories)
          .where(
            and(
              eq(budgetCategories.id, categoryId),
              eq(budgetCategories.userId, userId),
              eq(budgetCategories.householdId, householdId)
            )
          )
          .limit(1)
      : Promise.resolve([]),
  ]);

  return {
    merchantInfo:
      merchantResult.length > 0
        ? {
            id: merchantResult[0].id,
            name: merchantResult[0].name,
          }
        : null,
    categoryInfo:
      categoryResult.length > 0
        ? {
            id: categoryResult[0].id,
            name: categoryResult[0].name,
            type: categoryResult[0].type,
          }
        : null,
  };
}

// ---------------------------------------------------------------------------
// Rule application
// ---------------------------------------------------------------------------

async function applyCreateTransactionRules({
  userId,
  householdId,
  accountId,
  accountName,
  merchantId,
  categoryId,
  amount,
  date,
  notes,
  type,
  description,
  appliedCategoryId,
  finalDescription,
  finalMerchantId,
}: {
  userId: string;
  householdId: string;
  accountId: string;
  accountName: string;
  merchantId?: string | null;
  categoryId?: string | null;
  amount: string;
  date: string;
  notes?: string;
  type: string;
  description: string;
  appliedCategoryId: string | null;
  finalDescription: string;
  finalMerchantId: string | null;
}): Promise<CreateRuleApplicationState> {
  const state = createRuleApplicationState({
    appliedCategoryId,
    finalDescription,
    finalMerchantId,
  });

  if (shouldSkipCreateRuleApplication({ appliedCategoryId, type })) {
    return {
      ...state,
    };
  }

  try {
    const transactionData = buildRuleTransactionData({
      description,
      amount,
      accountName,
      date,
      notes,
    });

    const ruleMatch = await findMatchingRule(userId, householdId, transactionData);
    if (!ruleMatch.matched || !ruleMatch.rule) {
      return {
        ...state,
      };
    }

    state.appliedRuleId = ruleMatch.rule.ruleId;

    const { merchantInfo, categoryInfo } = await loadRuleReferenceData({
      userId,
      householdId,
      merchantId,
      categoryId,
    });

    const executionResult = await executeRuleActions(
      userId,
      ruleMatch.rule.actions,
      {
        categoryId: appliedCategoryId || null,
        description,
        merchantId: merchantId || null,
        accountId,
        amount: parseFloat(amount),
        date,
        type,
        isTaxDeductible: false,
      },
      merchantInfo,
      categoryInfo,
      householdId
    );

    ({
      appliedCategoryId: state.appliedCategoryId,
      finalDescription: state.finalDescription,
      finalMerchantId: state.finalMerchantId,
    } = mergeRuleMutations({
      appliedCategoryId: state.appliedCategoryId,
      finalDescription: state.finalDescription,
      finalMerchantId: state.finalMerchantId,
      mutations: executionResult.mutations,
    }));

    state.appliedActions = executionResult.appliedActions;
    state.postCreationMutations = executionResult.mutations;

    if (executionResult.errors && executionResult.errors.length > 0) {
      console.warn('Rule action execution errors:', executionResult.errors);
    }
  } catch (error) {
    console.error('Error applying categorization rules:', error);
  }

  return {
    ...state,
  };
}

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

export async function executeCreateRuleApplication({
  userId,
  householdId,
  accountId,
  accountName,
  merchantId,
  categoryId,
  amount,
  date,
  notes,
  type,
  description,
}: {
  userId: string;
  householdId: string;
  accountId: string;
  accountName: string;
  merchantId?: string | null;
  categoryId?: string | null;
  amount: string;
  date: string;
  notes?: string;
  type: string;
  description: string;
}): Promise<{
  appliedCategoryId: string | null;
  appliedRuleId: string | null;
  appliedActions: unknown[];
  finalDescription: string;
  finalMerchantId: string | null;
  postCreationMutations: TransactionMutations | null;
}> {
  const state = await applyCreateTransactionRules({
    userId,
    householdId,
    accountId,
    accountName,
    merchantId,
    categoryId,
    amount,
    date,
    notes,
    type,
    description,
    appliedCategoryId: categoryId ?? null,
    finalDescription: description,
    finalMerchantId: merchantId ?? null,
  });

  return {
    appliedCategoryId: state.appliedCategoryId,
    appliedRuleId: state.appliedRuleId,
    appliedActions: state.appliedActions,
    finalDescription: state.finalDescription,
    finalMerchantId: state.finalMerchantId,
    postCreationMutations: state.postCreationMutations,
  };
}

export async function logCreateRuleExecution({
  userId,
  householdId,
  transactionId,
  appliedRuleId,
  appliedCategoryId,
  appliedActions,
}: {
  userId: string;
  householdId: string;
  transactionId: string;
  appliedRuleId?: string | null;
  appliedCategoryId?: string | null;
  appliedActions: unknown[];
}): Promise<void> {
  if (!appliedRuleId) {
    return;
  }

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
}
