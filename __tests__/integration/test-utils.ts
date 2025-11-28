/**
 * Integration Test Utilities
 *
 * Helper functions and data factories for integration tests.
 * Provides consistent test data creation and assertion patterns.
 * 
 * Updated to support Household Data Isolation (2025-11-28)
 */

import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import {
  households,
  householdMembers,
  accounts,
  budgetCategories,
  merchants,
  transactions,
  transactionSplits,
  categorizationRules,
  ruleExecutionLog,
  transferSuggestions,
} from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
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

export interface TestHousehold {
  id?: string;
  name: string;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TestHouseholdMember {
  id?: string;
  householdId: string;
  userId: string;
  userEmail: string;
  userName?: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt?: string;
  invitedBy?: string | null;
  isActive?: boolean;
  isFavorite?: boolean;
}

export interface TestTransaction {
  id?: string;
  userId: string;
  householdId: string;
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
  householdId: string;
  name: string;
  type: 'checking' | 'savings' | 'credit_card' | 'credit' | 'investment' | 'cash' | 'other';
  currentBalance: number;
  color?: string;
  icon?: string;
  isActive?: boolean;
  isBusinessAccount?: boolean;
  creditLimit?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TestCategory {
  id?: string;
  userId: string;
  householdId: string;
  name: string;
  type: 'income' | 'expense' | 'variable_expense' | 'monthly_bill' | 'savings' | 'debt' | 'non_monthly_bill';
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
  householdId: string;
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
  householdId: string;
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
// HOUSEHOLD DATA FACTORIES
// ============================================================================

/**
 * Create test household with sensible defaults
 */
export function createTestHousehold(
  createdBy: string,
  overrides?: Partial<TestHousehold>
): TestHousehold {
  return {
    id: nanoid(),
    name: "Test Household",
    createdBy,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create test household member with sensible defaults
 */
export function createTestHouseholdMember(
  householdId: string,
  userId: string,
  userEmail: string,
  overrides?: Partial<TestHouseholdMember>
): TestHouseholdMember {
  return {
    id: nanoid(),
    householdId,
    userId,
    userEmail,
    userName: "Test User",
    role: 'owner',
    joinedAt: new Date().toISOString(),
    invitedBy: null,
    isActive: true,
    isFavorite: false,
    ...overrides,
  };
}

// ============================================================================
// DATA FACTORIES
// ============================================================================

/**
 * Create test transaction with sensible defaults
 * @param userId - User ID
 * @param householdId - Household ID (required for household isolation)
 * @param accountId - Account ID
 * @param overrides - Optional field overrides
 */
export function createTestTransaction(
  userId: string,
  householdId: string,
  accountId: string,
  overrides?: Partial<TestTransaction>
): TestTransaction {
  return {
    id: nanoid(),
    userId,
    householdId,
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
 * @param userId - User ID
 * @param householdId - Household ID (required for household isolation)
 * @param overrides - Optional field overrides
 */
export function createTestAccount(
  userId: string,
  householdId: string,
  overrides?: Partial<TestAccount>
): TestAccount {
  return {
    id: nanoid(),
    userId,
    householdId,
    name: "Test Checking",
    type: "checking",
    currentBalance: 1000.00,
    color: "#10b981",
    icon: "wallet",
    isActive: true,
    isBusinessAccount: false,
    creditLimit: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create test category with sensible defaults
 * @param userId - User ID
 * @param householdId - Household ID (required for household isolation)
 * @param overrides - Optional field overrides
 */
export function createTestCategory(
  userId: string,
  householdId: string,
  overrides?: Partial<TestCategory>
): TestCategory {
  return {
    id: nanoid(),
    userId,
    householdId,
    name: "Test Category",
    type: "variable_expense",
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
 * @param userId - User ID
 * @param householdId - Household ID (required for household isolation)
 * @param overrides - Optional field overrides
 */
export function createTestMerchant(
  userId: string,
  householdId: string,
  overrides?: Partial<TestMerchant>
): TestMerchant {
  const name = overrides?.name || "Test Merchant";
  return {
    id: nanoid(),
    userId,
    householdId,
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
  configOrValue: Record<string, unknown> | string = {}
): RuleAction {
  const action: RuleAction = { type };

  // Handle different action types
  switch (type) {
    case 'set_category':
      // Expect { categoryId: string }
      action.value = typeof configOrValue === 'object' 
        ? (configOrValue.categoryId as string) || ''
        : configOrValue;
      break;

    case 'set_merchant':
      // Expect { merchantId: string }
      action.value = typeof configOrValue === 'object'
        ? (configOrValue.merchantId as string) || ''
        : configOrValue;
      break;

    case 'set_account':
      // Expect { targetAccountId: string }
      action.value = typeof configOrValue === 'object'
        ? (configOrValue.targetAccountId as string) || ''
        : configOrValue;
      break;

    case 'set_description':
    case 'prepend_description':
    case 'append_description':
      // Expect { pattern: string }
      action.pattern = typeof configOrValue === 'object'
        ? (configOrValue.pattern as string) || ''
        : configOrValue;
      break;

    case 'set_tax_deduction':
    case 'set_sales_tax':
      // These actions don't need additional config
      break;

    case 'convert_to_transfer':
    case 'create_split':
      // Complex actions use config field
      action.config = typeof configOrValue === 'object' ? configOrValue : {};
      break;

    default:
      // For unknown types, store in config
      action.config = typeof configOrValue === 'object' ? configOrValue : {};
      break;
  }

  return action;
}

/**
 * Create test rule with conditions and actions
 * @param userId - User ID
 * @param householdId - Household ID (required for household isolation)
 * @param conditions - Rule conditions
 * @param actions - Rule actions
 * @param overrides - Optional field overrides
 */
export function createTestRule(
  userId: string,
  householdId: string,
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
    householdId,
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
// SETUP & CLEANUP HELPERS
// ============================================================================

/**
 * Setup test user with household - call at start of each test suite
 * Creates a household and adds the user as owner
 */
export async function setupTestUserWithHousehold(): Promise<{
  userId: string;
  householdId: string;
}> {
  const userId = generateTestUserId();
  const userEmail = `${userId}@test.example.com`;
  
  // Create household
  const householdData = createTestHousehold(userId);
  const [household] = await db.insert(households).values(householdData).returning();
  
  // Create household member (owner)
  const memberData = createTestHouseholdMember(household.id, userId, userEmail);
  await db.insert(householdMembers).values(memberData);
  
  return { userId, householdId: household.id };
}

/**
 * Cleanup test household and all related data
 * Deletes in correct order for foreign key constraints
 */
export async function cleanupTestHousehold(
  userId: string,
  householdId: string
): Promise<void> {
  // Delete in correct order for foreign keys
  try {
    await db.delete(transferSuggestions).where(eq(transferSuggestions.userId, userId));
  } catch {
    // Ignore if table doesn't exist or is empty
  }
  await db.delete(ruleExecutionLog).where(eq(ruleExecutionLog.userId, userId));
  await db.delete(transactionSplits).where(eq(transactionSplits.userId, userId));
  await db.delete(transactions).where(eq(transactions.userId, userId));
  await db.delete(categorizationRules).where(eq(categorizationRules.userId, userId));
  await db.delete(merchants).where(eq(merchants.userId, userId));
  await db.delete(budgetCategories).where(eq(budgetCategories.userId, userId));
  await db.delete(accounts).where(eq(accounts.userId, userId));
  await db.delete(householdMembers).where(eq(householdMembers.householdId, householdId));
  await db.delete(households).where(eq(households.id, householdId));
}

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

/**
 * Verify transaction has expected fields
 */
export function expectTransactionToMatch(
  actual: Record<string, unknown>,
  expected: Partial<TestTransaction>
) {
  Object.keys(expected).forEach(key => {
    expect(actual[key]).toBe((expected as Record<string, unknown>)[key]);
  });
}

/**
 * Verify audit log entry has required fields
 */
export function expectAuditLogEntry(
  logEntry: Record<string, unknown>,
  expectedFields: {
    ruleId?: string;
    transactionId?: string;
    appliedCategoryId?: string | null;
    matched?: boolean;
    appliedActions?: unknown[];
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
      ? JSON.parse(logEntry.appliedActions as string)
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
  appliedActions: Array<Record<string, unknown>>,
  expectedActions: Array<{
    type: RuleActionType;
    field?: string;
    value?: unknown;
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
 * Generate unique test household ID for isolation
 */
export function generateTestHouseholdId(): string {
  return `test-household-${nanoid()}`;
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
 * Mock auth for integration tests
 * Usage: vi.mock('@/lib/auth', mockAuth(testUserId))
 */
export function mockAuth(userId: string) {
  return () => ({
    auth: vi.fn().mockResolvedValue({ userId }),
    currentUser: vi.fn().mockResolvedValue({ id: userId }),
  });
}
