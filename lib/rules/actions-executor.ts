/**
 * Rule Actions Executor
 *
 * Executes rule actions on transactions and returns mutations to apply.
 * Supports multiple action types: set_category, modify_description, set_merchant, etc.
 */

import { db } from '@/lib/db';
import { budgetCategories, merchants } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import type {
  RuleAction,
  AppliedAction,
  TransactionMutations,
  ActionExecutionContext,
  ActionExecutionResult,
  PATTERN_VARIABLES,
} from './types';

/**
 * Parse description pattern with variable substitution
 * Supports: {original}, {merchant}, {category}, {amount}, {date}
 */
export function parseDescriptionPattern(
  pattern: string,
  context: ActionExecutionContext
): string {
  let result = pattern;

  // Replace {original} with current description
  result = result.replace(/{original}/g, context.transaction.description);

  // Replace {merchant} with merchant name
  result = result.replace(/{merchant}/g, context.merchant?.name || '');

  // Replace {category} with category name
  result = result.replace(/{category}/g, context.category?.name || '');

  // Replace {amount} with transaction amount
  result = result.replace(/{amount}/g, context.transaction.amount.toString());

  // Replace {date} with transaction date
  result = result.replace(/{date}/g, context.transaction.date);

  return result;
}

/**
 * Validate a single action
 */
function validateAction(action: RuleAction): string | null {
  if (!action.type) {
    return 'Action type is required';
  }

  switch (action.type) {
    case 'set_category':
      if (!action.value) {
        return 'Category ID is required for set_category action';
      }
      break;

    case 'set_merchant':
      if (!action.value) {
        return 'Merchant ID is required for set_merchant action';
      }
      break;

    case 'set_description':
    case 'append_description':
    case 'prepend_description':
      if (!action.pattern) {
        return `Pattern is required for ${action.type} action`;
      }
      break;

    case 'set_tax_deduction':
    case 'set_account':
    case 'convert_to_transfer':
    case 'create_split':
      // Future actions - not yet implemented
      return `Action type ${action.type} is not yet implemented`;

    default:
      return `Unknown action type: ${action.type}`;
  }

  return null;
}

/**
 * Execute a single set_category action
 */
async function executeSetCategoryAction(
  action: RuleAction,
  context: ActionExecutionContext,
  mutations: TransactionMutations
): Promise<AppliedAction | null> {
  if (!action.value) {
    return null;
  }

  // Verify category exists and belongs to user
  const category = await db
    .select()
    .from(budgetCategories)
    .where(
      and(
        eq(budgetCategories.id, action.value),
        eq(budgetCategories.userId, context.userId)
      )
    )
    .limit(1);

  if (category.length === 0) {
    console.warn(`Category ${action.value} not found or doesn't belong to user`);
    return null;
  }

  // Apply mutation
  const originalValue = context.transaction.categoryId;
  mutations.categoryId = action.value;

  // Update category in context for subsequent actions
  context.category = {
    id: category[0].id,
    name: category[0].name,
    type: category[0].type,
  };

  return {
    type: 'set_category',
    field: 'categoryId',
    originalValue: originalValue || null,
    newValue: action.value,
  };
}

/**
 * Execute a single set_merchant action
 */
async function executeSetMerchantAction(
  action: RuleAction,
  context: ActionExecutionContext,
  mutations: TransactionMutations
): Promise<AppliedAction | null> {
  if (!action.value) {
    return null;
  }

  // Verify merchant exists and belongs to user
  const merchant = await db
    .select()
    .from(merchants)
    .where(
      and(
        eq(merchants.id, action.value),
        eq(merchants.userId, context.userId)
      )
    )
    .limit(1);

  if (merchant.length === 0) {
    console.warn(`Merchant ${action.value} not found or doesn't belong to user`);
    return null;
  }

  // Apply mutation
  const originalValue = context.transaction.merchantId;
  mutations.merchantId = action.value;

  // Update merchant in context for subsequent actions
  context.merchant = {
    id: merchant[0].id,
    name: merchant[0].name,
  };

  return {
    type: 'set_merchant',
    field: 'merchantId',
    originalValue: originalValue || null,
    newValue: action.value,
  };
}

/**
 * Execute a description modification action
 */
function executeDescriptionAction(
  action: RuleAction,
  context: ActionExecutionContext,
  mutations: TransactionMutations
): AppliedAction | null {
  if (!action.pattern) {
    return null;
  }

  const originalValue = mutations.description || context.transaction.description;
  let newDescription: string;

  switch (action.type) {
    case 'set_description':
      // Replace entire description
      newDescription = parseDescriptionPattern(action.pattern, context);
      break;

    case 'prepend_description':
      // Prepend to current description
      const prependText = parseDescriptionPattern(action.pattern, context);
      newDescription = prependText + originalValue;
      break;

    case 'append_description':
      // Append to current description
      const appendText = parseDescriptionPattern(action.pattern, context);
      newDescription = originalValue + appendText;
      break;

    default:
      return null;
  }

  // Apply mutation
  mutations.description = newDescription;

  // Update description in context for subsequent actions
  context.transaction.description = newDescription;

  return {
    type: action.type,
    field: 'description',
    originalValue,
    newValue: newDescription,
  };
}

/**
 * Execute all rule actions on a transaction
 * Returns mutations to apply and list of applied actions for audit
 */
export async function executeRuleActions(
  userId: string,
  actions: RuleAction[],
  transaction: {
    categoryId?: string | null;
    description: string;
    merchantId?: string | null;
    accountId: string;
    amount: number;
    date: string;
  },
  existingMerchant?: { id: string; name: string } | null,
  existingCategory?: { id: string; name: string; type: string } | null
): Promise<ActionExecutionResult> {
  const mutations: TransactionMutations = {};
  const appliedActions: AppliedAction[] = [];
  const errors: string[] = [];

  // Create execution context
  const context: ActionExecutionContext = {
    userId,
    transaction: { ...transaction },
    merchant: existingMerchant || null,
    category: existingCategory || null,
  };

  // Execute each action in order
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];

    // Validate action
    const validationError = validateAction(action);
    if (validationError) {
      errors.push(`Action ${i + 1}: ${validationError}`);
      continue;
    }

    try {
      let appliedAction: AppliedAction | null = null;

      // Execute based on action type
      switch (action.type) {
        case 'set_category':
          appliedAction = await executeSetCategoryAction(action, context, mutations);
          break;

        case 'set_merchant':
          appliedAction = await executeSetMerchantAction(action, context, mutations);
          break;

        case 'set_description':
        case 'prepend_description':
        case 'append_description':
          appliedAction = executeDescriptionAction(action, context, mutations);
          break;

        default:
          errors.push(`Action ${i + 1}: Unsupported action type ${action.type}`);
      }

      if (appliedAction) {
        appliedActions.push(appliedAction);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Action ${i + 1}: Failed to execute - ${errorMessage}`);
      console.error(`Failed to execute action ${i + 1}:`, error);
    }
  }

  return {
    mutations,
    appliedActions,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Validate multiple actions without executing them
 * Useful for form validation in UI
 */
export function validateActions(actions: RuleAction[]): string[] {
  const errors: string[] = [];

  for (let i = 0; i < actions.length; i++) {
    const error = validateAction(actions[i]);
    if (error) {
      errors.push(`Action ${i + 1}: ${error}`);
    }
  }

  return errors;
}

/**
 * Get a human-readable description of an action
 * Useful for displaying in UI
 */
export function getActionDescription(action: RuleAction): string {
  switch (action.type) {
    case 'set_category':
      return `Set category to ${action.value || '(unknown)'}`;
    case 'set_merchant':
      return `Set merchant to ${action.value || '(unknown)'}`;
    case 'set_description':
      return `Set description to "${action.pattern || ''}"`;
    case 'prepend_description':
      return `Prepend "${action.pattern || ''}" to description`;
    case 'append_description':
      return `Append "${action.pattern || ''}" to description`;
    case 'set_tax_deduction':
      return 'Mark as tax deductible';
    case 'set_account':
      return `Move to account ${action.value || '(unknown)'}`;
    case 'convert_to_transfer':
      return 'Convert to transfer';
    case 'create_split':
      return 'Split transaction';
    default:
      return `Unknown action: ${action.type}`;
  }
}

/**
 * Check if an action type is implemented
 */
export function isActionImplemented(actionType: string): boolean {
  const implementedActions = [
    'set_category',
    'set_merchant',
    'set_description',
    'prepend_description',
    'append_description',
  ];
  return implementedActions.includes(actionType);
}
