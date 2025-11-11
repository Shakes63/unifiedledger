/**
 * Rule Actions Type Definitions
 *
 * Defines all types for the enhanced rules system that supports multiple actions
 * beyond just setting a category.
 */

/**
 * Available action types that rules can perform
 */
export type RuleActionType =
  | 'set_category'           // Set transaction category
  | 'set_description'        // Replace entire description
  | 'append_description'     // Append text to description
  | 'prepend_description'    // Prepend text to description
  | 'set_merchant'           // Set transaction merchant
  | 'set_tax_deduction'      // Mark as tax deductible
  | 'set_account'            // Change transaction account
  | 'convert_to_transfer'    // Convert to transfer transaction
  | 'create_split'           // Split transaction
  | 'set_sales_tax';         // Mark transaction as subject to sales tax

/**
 * Rule action definition
 * Describes what action to perform and its configuration
 */
export interface RuleAction {
  /** Type of action to perform */
  type: RuleActionType;

  /** Value for set actions (category ID, merchant ID, etc.) */
  value?: string;

  /** Pattern for description modifications (supports variables like {original}, {merchant}, etc.) */
  pattern?: string;

  /** Additional configuration for complex actions (splits, transfers) */
  config?: Record<string, any>;
}

/**
 * Result of applying an action to a transaction
 * Used for audit logging and showing what changed
 */
export interface AppliedAction {
  /** Type of action that was applied */
  type: RuleActionType;

  /** Field that was modified */
  field: 'categoryId' | 'description' | 'merchantId' | 'accountId' | 'isTaxDeductible' | 'isSalesTaxable' | 'type' | 'isSplit';

  /** Original value before action */
  originalValue?: string | boolean | null;

  /** New value after action */
  newValue: string | boolean | null;
}

/**
 * Rule match result from rule-matcher
 * Extended to include actions instead of just categoryId
 */
export interface RuleMatch {
  /** ID of the matched rule */
  ruleId: string;

  /** Name of the matched rule */
  ruleName: string;

  /** Actions to apply (replaces single categoryId) */
  actions: RuleAction[];

  /** Priority of the rule (lower = higher priority) */
  priority: number;
}

/**
 * Result of rule evaluation
 */
export interface RuleEvaluationResult {
  /** Whether a rule matched */
  matched: boolean;

  /** The matched rule (if any) */
  rule?: RuleMatch;

  /** Errors encountered during evaluation */
  errors?: string[];
}

/**
 * Transfer conversion configuration
 */
export interface TransferConversionConfig {
  targetAccountId?: string;
  autoMatch: boolean;
  matchTolerance: number;
  matchDayRange: number;
  createIfNoMatch: boolean;
}

/**
 * Split configuration for create_split action
 */
export interface SplitConfig {
  categoryId: string;
  amount?: number;
  percentage?: number;
  isPercentage: boolean;
  description?: string;
}

/**
 * Sales tax configuration for set_sales_tax action
 * Simplified to boolean flag with bidirectional support
 */
export interface SalesTaxConfig {
  value: boolean; // true = taxable, false = not taxable
}

/**
 * Transaction mutations to apply
 * Result from actions executor
 */
export interface TransactionMutations {
  /** Category to set (if set_category action) */
  categoryId?: string | null;

  /** Description to set (if description actions) */
  description?: string;

  /** Merchant to set (if set_merchant action) */
  merchantId?: string | null;

  /** Account to move to (if set_account action - future) */
  accountId?: string | null;
  originalAccountId?: string | null;

  /** Tax deductible flag (if set_tax_deduction action) */
  isTaxDeductible?: boolean;

  /** Sales taxable flag (if set_sales_tax action) */
  isSalesTaxable?: boolean;

  /** Account change config (if set_account action - post-creation) */
  changeAccount?: {
    targetAccountId: string;
  };

  /** Transfer conversion config (if convert_to_transfer action) */
  convertToTransfer?: TransferConversionConfig;

  /** Split configurations (if create_split action) */
  createSplits?: SplitConfig[];
}

/**
 * Context needed for executing actions
 * Includes current transaction state and related entities
 */
export interface ActionExecutionContext {
  /** User ID (for fetching related entities) */
  userId: string;

  /** Current transaction data */
  transaction: {
    categoryId?: string | null;
    description: string;
    merchantId?: string | null;
    accountId: string;
    amount: number;
    date: string;
    type: string;
    isTaxDeductible?: boolean;
    isSalesTaxable?: boolean;
  };

  /** Merchant details (if available) */
  merchant?: {
    id: string;
    name: string;
  } | null;

  /** Category details (if available) */
  category?: {
    id: string;
    name: string;
    type: string;
  } | null;
}

/**
 * Result from executing actions
 */
export interface ActionExecutionResult {
  /** Mutations to apply to transaction */
  mutations: TransactionMutations;

  /** List of successfully applied actions */
  appliedActions: AppliedAction[];

  /** Errors encountered (non-fatal) */
  errors?: string[];
}

/**
 * Pattern variables available for description modifications
 */
export const PATTERN_VARIABLES = {
  original: '{original}',     // Original description
  merchant: '{merchant}',     // Merchant name
  category: '{category}',     // Category name
  amount: '{amount}',         // Transaction amount
  date: '{date}',             // Transaction date (YYYY-MM-DD)
} as const;

/**
 * Helper type for pattern variable keys
 */
export type PatternVariable = keyof typeof PATTERN_VARIABLES;

/**
 * Validation error for action configuration
 */
export interface ActionValidationError {
  /** Action index in array */
  actionIndex: number;

  /** Type of action */
  actionType: RuleActionType;

  /** Error message */
  message: string;

  /** Field that has the error */
  field?: string;
}
