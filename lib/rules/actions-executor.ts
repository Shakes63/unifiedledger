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
  SplitConfig,
  TransferConversionConfig,
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

    case 'set_account':
      if (!action.value) {
        return 'Account ID is required for set_account action';
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
      // No additional validation needed - depends on category
      break;

    case 'set_sales_tax':
      // Validate config.value is boolean
      if (typeof action.config?.value !== 'boolean') {
        return 'Sales tax action requires a boolean value (taxable or not taxable)';
      }
      break;

    case 'convert_to_transfer':
      // No additional validation needed - config is optional
      break;

    case 'create_split':
      if (!action.config || !action.config.splits || !Array.isArray(action.config.splits)) {
        return 'Splits configuration is required for create_split action';
      }
      if (action.config.splits.length === 0) {
        return 'At least one split is required for create_split action';
      }
      break;

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

  // Verify category exists and belongs to user (+ household when available)
  const categoryFilters = [
    eq(budgetCategories.id, action.value),
    eq(budgetCategories.userId, context.userId),
    ...(context.householdId ? [eq(budgetCategories.householdId, context.householdId)] : []),
  ];
  const category = await db
    .select()
    .from(budgetCategories)
    .where(
      and(...categoryFilters)
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

  // Verify merchant exists and belongs to user (+ household when available)
  const merchantFilters = [
    eq(merchants.id, action.value),
    eq(merchants.userId, context.userId),
    ...(context.householdId ? [eq(merchants.householdId, context.householdId)] : []),
  ];
  const merchant = await db
    .select()
    .from(merchants)
    .where(
      and(...merchantFilters)
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
 * Execute a set_tax_deduction action
 * Marks transaction as tax deductible if the category is configured as tax deductible
 */
async function executeSetTaxDeductionAction(
  action: RuleAction,
  context: ActionExecutionContext,
  mutations: TransactionMutations
): Promise<AppliedAction | null> {
  // Get the category ID (either from mutations or context)
  const categoryId = mutations.categoryId || context.transaction.categoryId;

  if (!categoryId) {
    // Can't set tax deduction without a category
    console.warn('Cannot set tax deduction: no category assigned to transaction');
    return null;
  }

  // Fetch category to check if it's tax deductible (+ household when available)
  const taxDeductionCategoryFilters = [
    eq(budgetCategories.id, categoryId),
    eq(budgetCategories.userId, context.userId),
    ...(context.householdId ? [eq(budgetCategories.householdId, context.householdId)] : []),
  ];
  const category = await db
    .select()
    .from(budgetCategories)
    .where(
      and(...taxDeductionCategoryFilters)
    )
    .limit(1);

  if (category.length === 0) {
    console.warn(`Category ${categoryId} not found for tax deduction check`);
    return null;
  }

  if (!category[0].isTaxDeductible) {
    // Category is not configured as tax deductible, skip this action
    console.info(`Category ${category[0].name} is not tax deductible, skipping action`);
    return null;
  }

  // Apply mutation
  const originalValue = context.transaction.isTaxDeductible || false;
  mutations.isTaxDeductible = true;

  return {
    type: 'set_tax_deduction',
    field: 'isTaxDeductible',
    originalValue: originalValue.toString(),
    newValue: 'true',
  };
}

/**
 * Execute a set_sales_tax action
 * Marks transaction as subject to sales tax (boolean flag)
 * Supports both true (taxable) and false (not taxable)
 */
async function executeSetSalesTaxAction(
  action: RuleAction,
  context: ActionExecutionContext,
  mutations: TransactionMutations
): Promise<AppliedAction | null> {
  try {
    // Only apply to income transactions
    if (context.transaction.type !== 'income') {
      console.warn('Sales tax can only be applied to income transactions, skipping');
      return null;
    }

    // Get the value from config (should be validated already)
    const value = action.config?.value;
    if (typeof value !== 'boolean') {
      console.error('Sales tax action missing boolean value in config');
      return null;
    }

    // Set the sales taxable flag to the configured value
    mutations.isSalesTaxable = value;

    return {
      type: 'set_sales_tax',
      field: 'isSalesTaxable',
      originalValue: context.transaction.isSalesTaxable || false,
      newValue: value,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to execute set_sales_tax action:', message);
    throw error;
  }
}

/**
 * Execute a set_account action
 * Changes the transaction's account
 * Note: Actual account change and balance updates happen AFTER transaction is created
 */
async function executeSetAccountAction(
  action: RuleAction,
  context: ActionExecutionContext,
  mutations: TransactionMutations
): Promise<AppliedAction | null> {
  const targetAccountId = action.value;

  if (!targetAccountId) {
    console.error('Set account action missing target account ID');
    return null;
  }

  // Validate not a transfer
  if (context.transaction.type === 'transfer_out' || context.transaction.type === 'transfer_in') {
    console.error('Cannot change account for transfer transactions');
    return null;
  }

  // Store for post-creation processing
  mutations.changeAccount = {
    targetAccountId
  };

  // Store original account ID
  const originalAccountId = context.transaction.accountId;

  return {
    type: 'set_account',
    field: 'accountId',
    originalValue: originalAccountId,
    newValue: targetAccountId,
  };
}

/**
 * Execute a create_split action
 * Creates transaction splits with specified categories and amounts
 * Note: Actual split creation happens AFTER transaction is created
 */
async function executeCreateSplitAction(
  action: RuleAction,
  context: ActionExecutionContext,
  mutations: TransactionMutations
): Promise<AppliedAction | null> {
  const config = (action.config ?? {}) as unknown as { splits?: SplitConfig[] };

  if (!config.splits || !Array.isArray(config.splits) || config.splits.length === 0) {
    console.warn('No splits configured for create_split action');
    return null;
  }

  // Validate split configuration
  const splits = config.splits as SplitConfig[];

  // Check total percentage if using percentages
  const totalPercentage = splits
    .filter((s) => s.isPercentage && s.percentage !== undefined)
    .reduce((sum, s) => sum + (s.percentage || 0), 0);

  if (totalPercentage > 100) {
    console.error(`Total split percentage (${totalPercentage}%) exceeds 100%`);
    return null;
  }

  // Store split request in mutations
  // Actual split creation happens AFTER transaction is created
  mutations.createSplits = splits;

  return {
    type: 'create_split',
    field: 'isSplit',
    originalValue: 'false',
    newValue: 'true',
  };
}

/**
 * Execute a convert_to_transfer action
 * Stores conversion configuration for post-creation processing
 * Note: Actual conversion happens AFTER transaction is created (needs transaction ID)
 */
async function executeConvertToTransferAction(
  action: RuleAction,
  context: ActionExecutionContext,
  mutations: TransactionMutations
): Promise<AppliedAction | null> {
  const config = (action.config ?? {}) as unknown as Partial<TransferConversionConfig>;

  // Validate: can't convert if already a transfer
  if (context.transaction.type === 'transfer_in' || context.transaction.type === 'transfer_out') {
    console.warn('Cannot convert transaction that is already a transfer');
    return null;
  }

  // Store conversion request in mutations
  // Actual conversion happens AFTER transaction is created
  mutations.convertToTransfer = {
    targetAccountId: config.targetAccountId,
    autoMatch: config.autoMatch ?? true,
    matchTolerance: config.matchTolerance ?? 1,
    matchDayRange: config.matchDayRange ?? 7,
    createIfNoMatch: config.createIfNoMatch ?? true,
  };

  return {
    type: 'convert_to_transfer',
    field: 'type',
    originalValue: context.transaction.type,
    newValue: 'transfer_out',
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
    type: string;
    isTaxDeductible?: boolean;
  },
  existingMerchant?: { id: string; name: string } | null,
  existingCategory?: { id: string; name: string; type: string } | null,
  householdId?: string
): Promise<ActionExecutionResult> {
  const mutations: TransactionMutations = {};
  const appliedActions: AppliedAction[] = [];
  const errors: string[] = [];

  // Create execution context
  const context: ActionExecutionContext = {
    userId,
    householdId,
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

        case 'set_tax_deduction':
          appliedAction = await executeSetTaxDeductionAction(action, context, mutations);
          break;

        case 'set_sales_tax':
          appliedAction = await executeSetSalesTaxAction(action, context, mutations);
          break;

        case 'set_account':
          appliedAction = await executeSetAccountAction(action, context, mutations);
          break;

        case 'create_split':
          appliedAction = await executeCreateSplitAction(action, context, mutations);
          break;

        case 'convert_to_transfer':
          appliedAction = await executeConvertToTransferAction(action, context, mutations);
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
    case 'set_sales_tax':
      return 'Apply sales tax';
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
    'set_tax_deduction',
    'set_sales_tax',
    'set_account',
    'convert_to_transfer',
    'create_split',
  ];
  return implementedActions.includes(actionType);
}
