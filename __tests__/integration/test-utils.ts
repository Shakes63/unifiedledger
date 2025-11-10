/**
 * Integration Test Utilities
 *
 * Helper functions and data factories for integration tests.
 * Provides consistent test data creation and assertion patterns.
 */

import { nanoid } from 'nanoid';
import type {
  Condition,
  ConditionGroup,
  ComparisonOperator,
  ConditionField
} from '@/lib/rules/condition-evaluator';
import type { RuleAction, RuleActionType } from '@/lib/rules/types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface TestTransaction {
  id?: string;
  userId: string;
  accountId: string;
  description: string;
  amount: number;
  date: string;
  type?: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
  categoryId?: string | null;
  merchantId?: string | null;
  notes?: string | null;
  isPending?: boolean;
  isSplit?: boolean;
  parentTransactionId?: string | null;
  transferId?: string | null;
  isTaxDeductible?: boolean;
  isSalesTaxable?: boolean;
  createdAt?: string;
  updatedAt?: string;
  // Offline sync fields
  offlineId?: string | null;
  syncStatus?: 'synced' | 'pending' | 'error';
}

export interface TestAccount {
  id?: string;
  userId: string;
  name: string;
  type: 'checking' | 'savings' | 'credit_card' | 'investment' | 'other';
  currentBalance: number;
  color?: string;
  icon?: string;
  isActive?: boolean;
  isBusiness?: boolean;
  creditLimit?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TestCategory {
  id?: string;
  userId: string;
  name: string;
  type: 'income' | 'expense' | 'savings';
  color?: string;
  icon?: string;
  isTaxDeductible?: boolean;
  isActive?: boolean;
  usageCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface TestMerchant {
  id?: string;
  userId: string;
  name: string;
  normalizedName: string;
  categoryId?: string | null;
  usageCount?: number;
  lastUsedAt?: string;
  totalSpent?: number;
  averageTransaction?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface TestRule {
  id?: string;
  userId: string;
  name: string;
  priority: number;
  isActive?: boolean;
  conditions: string; // JSON string
  actions: string; // JSON string
  categoryId?: string | null; // Backward compatibility
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// DATA FACTORIES
// ============================================================================

/**
 * Create test transaction with sensible defaults
 */
export function createTestTransaction(
  userId: string,
  accountId: string,
  overrides?: Partial<TestTransaction>
): TestTransaction {
  return {
    id: nanoid(),
    userId,
    accountId,
    description: "Test Transaction",
    amount: 50.00,
    date: "2025-01-23",
    type: "expense",
    categoryId: null,
    merchantId: null,
    notes: null,
    isPending: false,
    isSplit: false,
    parentTransactionId: null,
    transferId: null,
    isTaxDeductible: false,
    isSalesTaxable: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    offlineId: null,
    syncStatus: 'synced',
    ...overrides,
  };
}

/**
 * Create test account with sensible defaults
 */
export function createTestAccount(
  userId: string,
  overrides?: Partial<TestAccount>
): TestAccount {
  return {
    id: nanoid(),
    userId,
    name: "Test Checking",
    type: "checking",
    currentBalance: 1000.00,
    color: "#10b981",
    icon: "wallet",
    isActive: true,
    isBusiness: false,
    creditLimit: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create test category with sensible defaults
 */
export function createTestCategory(
  userId: string,
  overrides?: Partial<TestCategory>
): TestCategory {
  return {
    id: nanoid(),
    userId,
    name: "Test Category",
    type: "expense",
    color: "#f59e0b",
    icon: "tag",
    isTaxDeductible: false,
    isActive: true,
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create test merchant with sensible defaults
 */
export function createTestMerchant(
  userId: string,
  overrides?: Partial<TestMerchant>
): TestMerchant {
  const name = overrides?.name || "Test Merchant";
  return {
    id: nanoid(),
    userId,
    name,
    normalizedName: name.toLowerCase(),
    categoryId: null,
    usageCount: 1,
    lastUsedAt: new Date().toISOString(),
    totalSpent: 0,
    averageTransaction: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
    // Re-compute normalized name if name was overridden
    ...(overrides?.name && !overrides?.normalizedName && { normalizedName: overrides.name.toLowerCase() }),
  };
}

/**
 * Create test condition with sensible defaults
 */
export function createTestCondition(
  field: ConditionField,
  operator: ComparisonOperator,
  value: string,
  overrides?: Partial<Condition>
): Condition {
  return {
    field,
    operator,
    value,
    caseSensitive: false,
    ...overrides,
  };
}

/**
 * Create test condition group (AND/OR)
 */
export function createTestConditionGroup(
  logic: 'and' | 'or' | 'AND' | 'OR',
  conditions: (Condition | ConditionGroup)[]
): ConditionGroup {
  return {
    logic: logic.toUpperCase() as 'AND' | 'OR',
    conditions,
  };
}

/**
 * Create test rule action
 *
 * Simple actions (set_category, set_merchant) use 'value' field.
 * Description actions use 'pattern' field.
 * Complex actions (splits, transfers) use 'config' field.
 */
export function createTestAction(
  type: RuleActionType,
  configOrValue: any = {}
): RuleAction {
  const action: RuleAction = { type };

  // Handle different action types
  switch (type) {
    case 'set_category':
      // Expect { categoryId: string }
      action.value = configOrValue.categoryId || configOrValue;
      break;

    case 'set_merchant':
      // Expect { merchantId: string }
      action.value = configOrValue.merchantId || configOrValue;
      break;

    case 'set_account':
      // Expect { targetAccountId: string }
      action.value = configOrValue.targetAccountId || configOrValue;
      break;

    case 'set_description':
    case 'prepend_description':
    case 'append_description':
      // Expect { pattern: string }
      action.pattern = configOrValue.pattern || configOrValue;
      break;

    case 'set_tax_deduction':
    case 'set_sales_tax':
      // These actions don't need additional config
      break;

    case 'convert_to_transfer':
    case 'create_split':
      // Complex actions use config field
      action.config = configOrValue;
      break;

    default:
      // For unknown types, store in config
      action.config = configOrValue;
      break;
  }

  return action;
}

/**
 * Create test rule with conditions and actions
 */
export function createTestRule(
  userId: string,
  conditions: Condition[] | ConditionGroup,
  actions: RuleAction[],
  overrides?: Partial<TestRule>
): TestRule {
  // Wrap conditions in a group if needed
  const conditionGroup: ConditionGroup = Array.isArray(conditions)
    ? { logic: 'AND', conditions } // Use uppercase AND for validation
    : conditions;

  // Extract categoryId from set_category action for backward compatibility
  const setCategoryAction = actions.find(a => a.type === 'set_category');
  const categoryIdFromAction = setCategoryAction?.value || null;

  return {
    id: nanoid(),
    userId,
    name: "Test Rule",
    priority: 1,
    isActive: true,
    conditions: JSON.stringify(conditionGroup),
    actions: JSON.stringify(actions),
    categoryId: categoryIdFromAction, // For backward compatibility with database constraint
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

/**
 * Verify transaction has expected fields
 */
export function expectTransactionToMatch(
  actual: any,
  expected: Partial<TestTransaction>
) {
  Object.keys(expected).forEach(key => {
    expect(actual[key]).toBe((expected as any)[key]);
  });
}

/**
 * Verify audit log entry has required fields
 */
export function expectAuditLogEntry(
  logEntry: any,
  expectedFields: {
    ruleId?: string;
    transactionId?: string;
    appliedCategoryId?: string | null;
    matched?: boolean;
    appliedActions?: any[];
  }
) {
  if (expectedFields.ruleId !== undefined) {
    expect(logEntry.ruleId).toBe(expectedFields.ruleId);
  }
  if (expectedFields.transactionId !== undefined) {
    expect(logEntry.transactionId).toBe(expectedFields.transactionId);
  }
  if (expectedFields.appliedCategoryId !== undefined) {
    expect(logEntry.appliedCategoryId).toBe(expectedFields.appliedCategoryId);
  }
  if (expectedFields.matched !== undefined) {
    expect(logEntry.matched).toBe(expectedFields.matched);
  }
  if (expectedFields.appliedActions !== undefined) {
    const actions = typeof logEntry.appliedActions === 'string'
      ? JSON.parse(logEntry.appliedActions)
      : logEntry.appliedActions;
    expect(actions).toEqual(expectedFields.appliedActions);
  }

  // Verify required fields exist
  expect(logEntry.id).toBeTruthy();
  expect(logEntry.userId).toBeTruthy();
  expect(logEntry.executedAt).toBeTruthy();
}

/**
 * Verify applied actions array structure
 */
export function expectAppliedActions(
  appliedActions: any[],
  expectedActions: Array<{
    type: RuleActionType;
    field?: string;
    value?: any;
  }>
) {
  expect(appliedActions).toHaveLength(expectedActions.length);

  expectedActions.forEach((expected, index) => {
    expect(appliedActions[index]).toMatchObject({
      type: expected.type,
      ...(expected.field && { field: expected.field }),
      ...(expected.value !== undefined && { newValue: expected.value }),
    });
  });
}

// ============================================================================
// CLEANUP HELPERS
// ============================================================================

/**
 * Generate unique test user ID for isolation
 */
export function generateTestUserId(): string {
  return `test-user-${nanoid()}`;
}

/**
 * Wait for async operations to complete
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// MOCK AUTH HELPER
// ============================================================================

/**
 * Mock Clerk auth for integration tests
 * Usage: vi.mock('@clerk/nextjs/server', mockAuth(testUserId))
 */
export function mockAuth(userId: string) {
  return () => ({
    auth: vi.fn().mockResolvedValue({ userId }),
    currentUser: vi.fn().mockResolvedValue({ id: userId }),
  });
}
