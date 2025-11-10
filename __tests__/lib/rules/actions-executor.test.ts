import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  parseDescriptionPattern,
  executeRuleActions,
  validateActions,
  getActionDescription,
  isActionImplemented,
} from "@/lib/rules/actions-executor";
import type {
  RuleAction,
  ActionExecutionContext,
  TransactionMutations,
  AppliedAction,
  SplitConfig,
} from "@/lib/rules/types";

/**
 * Comprehensive tests for the Rules System Actions Executor
 *
 * Coverage target: 95%+
 * Tests all 9 action types + pattern variables + error handling
 */

// ============================================================================
// MOCK DATABASE SETUP
// ============================================================================

// Mock the database module
vi.mock("@/lib/db", () => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
  };

  return {
    db: mockDb,
  };
});

// Mock database schema
vi.mock("@/lib/db/schema", () => ({
  budgetCategories: { name: "budgetCategories" },
  merchants: { name: "merchants" },
}));

// Mock sales tax action handler
vi.mock("@/lib/rules/sales-tax-action-handler", () => ({
  validateSalesTaxConfig: vi.fn((config: any) => {
    if (!config || !config.taxCategoryId) {
      throw new Error("Tax category ID is required");
    }
    return config;
  }),
}));

// Import mocked modules after mocking
import { db } from "@/lib/db";

// ============================================================================
// TEST DATA - MOCK DATABASE
// ============================================================================

const mockCategories = [
  {
    id: "cat-1",
    name: "Groceries",
    type: "expense",
    userId: "user-1",
    isTaxDeductible: false,
  },
  {
    id: "cat-2",
    name: "Business Expenses",
    type: "expense",
    userId: "user-1",
    isTaxDeductible: true,
  },
  {
    id: "cat-3",
    name: "Salary",
    type: "income",
    userId: "user-1",
    isTaxDeductible: false,
  },
  {
    id: "cat-other-user",
    name: "Other User Category",
    type: "expense",
    userId: "user-2",
    isTaxDeductible: false,
  },
];

const mockMerchants = [
  {
    id: "merch-1",
    name: "Whole Foods",
    userId: "user-1",
  },
  {
    id: "merch-2",
    name: "Amazon",
    userId: "user-1",
  },
  {
    id: "merch-3",
    name: "Starbucks",
    userId: "user-1",
  },
  {
    id: "merch-other-user",
    name: "Other User Merchant",
    userId: "user-2",
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Setup database mock to return specific data for queries
 * Call this before each test that needs database access
 */
function setupDbMock(data?: { categories?: any[]; merchants?: any[] }) {
  // Clear all previous mock calls
  vi.clearAllMocks();

  // Default to using mock data
  const categories = data?.categories || mockCategories;
  const merchants = data?.merchants || mockMerchants;

  // Setup the database mock to return data based on query
  (db.limit as any).mockImplementation((limitValue: number) => {
    // The previous calls in the chain tell us what we're querying
    // For simplicity, we'll return based on the most recent operation
    // In real tests, we'll set expectations more explicitly
    return Promise.resolve([]);
  });
}

/**
 * Mock database query to return specific category
 */
function mockCategoryQuery(categoryId: string, userId: string = "user-1") {
  const category = mockCategories.find(
    (cat) => cat.id === categoryId && cat.userId === userId
  );

  (db.limit as any).mockResolvedValueOnce(category ? [category] : []);
}

/**
 * Mock database query to return specific merchant
 */
function mockMerchantQuery(merchantId: string, userId: string = "user-1") {
  const merchant = mockMerchants.find(
    (merch) => merch.id === merchantId && merch.userId === userId
  );

  (db.limit as any).mockResolvedValueOnce(merchant ? [merchant] : []);
}

/**
 * Create a test transaction object
 */
function createTestTransaction(overrides?: Partial<any>): any {
  return {
    categoryId: null,
    description: "Coffee Shop Purchase",
    merchantId: null,
    accountId: "account-1",
    amount: 5.5,
    date: "2025-01-23",
    type: "expense",
    isTaxDeductible: false,
    ...overrides,
  };
}

/**
 * Create a test action object
 */
function createTestAction(
  type: string,
  options?: {
    value?: string;
    pattern?: string;
    config?: Record<string, any>;
  }
): RuleAction {
  return {
    type: type as any,
    value: options?.value,
    pattern: options?.pattern,
    config: options?.config,
  };
}

/**
 * Create a test category object
 */
function createTestCategory(
  id: string,
  name: string,
  isTaxDeductible = false
) {
  return {
    id,
    name,
    type: "expense",
    userId: "user-1",
    isTaxDeductible,
  };
}

/**
 * Create a test merchant object
 */
function createTestMerchant(id: string, name: string) {
  return {
    id,
    name,
    userId: "user-1",
  };
}

/**
 * Create a test context object
 */
function createTestContext(
  transaction: any,
  merchant?: any,
  category?: any
): ActionExecutionContext {
  return {
    userId: "user-1",
    transaction: { ...transaction },
    merchant: merchant || null,
    category: category || null,
  };
}

/**
 * Assert that mutations contain expected values
 */
function expectMutations(
  mutations: TransactionMutations,
  expected: Partial<TransactionMutations>
) {
  for (const [key, value] of Object.entries(expected)) {
    expect(mutations).toHaveProperty(key);
    expect((mutations as any)[key]).toEqual(value);
  }
}

/**
 * Assert that an applied action matches expected structure
 */
function expectAppliedAction(
  action: AppliedAction,
  expected: {
    type: string;
    field: string;
    originalValue?: any;
    newValue: any;
  }
) {
  expect(action.type).toBe(expected.type);
  expect(action.field).toBe(expected.field);
  expect(action.newValue).toBe(expected.newValue);
  if (expected.originalValue !== undefined) {
    expect(action.originalValue).toBe(expected.originalValue);
  }
}

// ============================================================================
// SETUP & TEARDOWN
// ============================================================================

beforeEach(() => {
  setupDbMock();
});

// ============================================================================
// TESTS START HERE
// ============================================================================

describe("Actions Executor - Setup & Infrastructure", () => {
  it("should have database mocked correctly", () => {
    expect(db.select).toBeDefined();
    expect(vi.isMockFunction(db.select)).toBe(true);
    expect(db.from).toBeDefined();
    expect(db.where).toBeDefined();
    expect(db.limit).toBeDefined();
  });

  it("should create test transaction with defaults", () => {
    const transaction = createTestTransaction();
    expect(transaction.description).toBe("Coffee Shop Purchase");
    expect(transaction.amount).toBe(5.5);
    expect(transaction.type).toBe("expense");
  });

  it("should create test transaction with overrides", () => {
    const transaction = createTestTransaction({
      description: "Custom Transaction",
      amount: 100,
    });
    expect(transaction.description).toBe("Custom Transaction");
    expect(transaction.amount).toBe(100);
  });

  it("should create test action", () => {
    const action = createTestAction("set_category", { value: "cat-1" });
    expect(action.type).toBe("set_category");
    expect(action.value).toBe("cat-1");
  });

  it("should create test context", () => {
    const transaction = createTestTransaction();
    const context = createTestContext(transaction);
    expect(context.userId).toBe("user-1");
    expect(context.transaction).toBeDefined();
    expect(context.merchant).toBeNull();
    expect(context.category).toBeNull();
  });

  it("helper functions should work correctly", () => {
    const category = createTestCategory("cat-1", "Groceries");
    expect(category.id).toBe("cat-1");
    expect(category.name).toBe("Groceries");

    const merchant = createTestMerchant("merch-1", "Whole Foods");
    expect(merchant.id).toBe("merch-1");
    expect(merchant.name).toBe("Whole Foods");
  });
});

// ============================================================================
// PATTERN VARIABLE SUBSTITUTION TESTS
// ============================================================================

describe("Actions Executor - Pattern Variables - Basic", () => {
  it("should replace {original} with current description", () => {
    const transaction = createTestTransaction({ description: "Coffee Shop" });
    const context = createTestContext(transaction);

    const result = parseDescriptionPattern("Purchase: {original}", context);

    expect(result).toBe("Purchase: Coffee Shop");
  });

  it("should replace {merchant} with merchant name", () => {
    const transaction = createTestTransaction();
    const merchant = createTestMerchant("merch-1", "Whole Foods");
    const context = createTestContext(transaction, merchant);

    const result = parseDescriptionPattern("Merchant: {merchant}", context);

    expect(result).toBe("Merchant: Whole Foods");
  });

  it("should replace {category} with category name", () => {
    const transaction = createTestTransaction();
    const category = createTestCategory("cat-1", "Groceries");
    const context = createTestContext(transaction, null, category);

    const result = parseDescriptionPattern("Category: {category}", context);

    expect(result).toBe("Category: Groceries");
  });

  it("should replace {amount} with transaction amount", () => {
    const transaction = createTestTransaction({ amount: 25.5 });
    const context = createTestContext(transaction);

    const result = parseDescriptionPattern("Amount: ${amount}", context);

    expect(result).toBe("Amount: $25.5");
  });

  it("should replace {date} with transaction date", () => {
    const transaction = createTestTransaction({ date: "2025-01-23" });
    const context = createTestContext(transaction);

    const result = parseDescriptionPattern("Date: {date}", context);

    expect(result).toBe("Date: 2025-01-23");
  });

  it("should handle missing merchant (replace with empty string)", () => {
    const transaction = createTestTransaction();
    const context = createTestContext(transaction); // No merchant

    const result = parseDescriptionPattern("Merchant: {merchant}", context);

    expect(result).toBe("Merchant: ");
  });

  it("should handle missing category (replace with empty string)", () => {
    const transaction = createTestTransaction();
    const context = createTestContext(transaction); // No category

    const result = parseDescriptionPattern("Category: {category}", context);

    expect(result).toBe("Category: ");
  });

  it("should return pattern as-is when no variables present", () => {
    const transaction = createTestTransaction();
    const context = createTestContext(transaction);

    const result = parseDescriptionPattern("Static text without variables", context);

    expect(result).toBe("Static text without variables");
  });
});

describe("Actions Executor - Pattern Variables - Advanced", () => {
  it("should replace multiple different variables in single pattern", () => {
    const transaction = createTestTransaction({
      description: "Purchase",
      amount: 25.0,
      date: "2025-01-23",
    });
    const merchant = createTestMerchant("merch-1", "Amazon");
    const category = createTestCategory("cat-1", "Shopping");
    const context = createTestContext(transaction, merchant, category);

    const result = parseDescriptionPattern(
      "{merchant} - {category} - ${amount} on {date}",
      context
    );

    expect(result).toBe("Amazon - Shopping - $25 on 2025-01-23");
  });

  it("should replace same variable used multiple times", () => {
    const transaction = createTestTransaction({ description: "Coffee" });
    const context = createTestContext(transaction);

    const result = parseDescriptionPattern(
      "{original} | {original} | {original}",
      context
    );

    expect(result).toBe("Coffee | Coffee | Coffee");
  });

  it("should replace all variables in comprehensive pattern", () => {
    const transaction = createTestTransaction({
      description: "Morning Coffee",
      amount: 4.5,
      date: "2025-01-23",
    });
    const merchant = createTestMerchant("merch-1", "Starbucks");
    const category = createTestCategory("cat-1", "Dining Out");
    const context = createTestContext(transaction, merchant, category);

    const result = parseDescriptionPattern(
      "{original} at {merchant} ({category}) for ${amount} on {date}",
      context
    );

    expect(result).toBe(
      "Morning Coffee at Starbucks (Dining Out) for $4.5 on 2025-01-23"
    );
  });

  it("should handle empty pattern string", () => {
    const transaction = createTestTransaction();
    const context = createTestContext(transaction);

    const result = parseDescriptionPattern("", context);

    expect(result).toBe("");
  });

  it("should handle pattern with special characters", () => {
    const transaction = createTestTransaction({ description: "Test & Co." });
    const context = createTestContext(transaction);

    const result = parseDescriptionPattern(
      "Purchase @ {original} - 100% satisfaction!",
      context
    );

    expect(result).toBe("Purchase @ Test & Co. - 100% satisfaction!");
  });

  it("should handle large amounts correctly", () => {
    const transaction = createTestTransaction({ amount: 1234567.89 });
    const context = createTestContext(transaction);

    const result = parseDescriptionPattern("Amount: {amount}", context);

    expect(result).toBe("Amount: 1234567.89");
  });

  it("should handle different date formats (ISO format)", () => {
    const transaction = createTestTransaction({ date: "2025-12-31" });
    const context = createTestContext(transaction);

    const result = parseDescriptionPattern("Expires on {date}", context);

    expect(result).toBe("Expires on 2025-12-31");
  });
});

// ============================================================================
// SET_CATEGORY ACTION TESTS
// ============================================================================

describe("Actions Executor - set_category Action", () => {
  it("should set valid category and update context", async () => {
    mockCategoryQuery("cat-1", "user-1");

    const action = createTestAction("set_category", { value: "cat-1" });
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.categoryId).toBe("cat-1");
    expect(result.appliedActions).toHaveLength(1);
    expect(result.appliedActions[0]).toEqual({
      type: "set_category",
      field: "categoryId",
      originalValue: null,
      newValue: "cat-1",
    });
  });

  it("should verify category exists and belongs to user", async () => {
    // Mock successful category query
    mockCategoryQuery("cat-2", "user-1");

    const action = createTestAction("set_category", { value: "cat-2" });
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.categoryId).toBe("cat-2");
    expect(result.appliedActions).toHaveLength(1);
    // Verify database was queried (mock was called)
    expect(db.limit).toHaveBeenCalled();
  });

  it("should skip action when category not found", async () => {
    // Mock category not found (empty array)
    (db.limit as any).mockResolvedValueOnce([]);

    const action = createTestAction("set_category", { value: "cat-invalid" });
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.categoryId).toBeUndefined();
    expect(result.appliedActions).toHaveLength(0);
  });

  it("should skip action when category belongs to different user", async () => {
    // Mock category not found (belongs to user-2, querying for user-1)
    (db.limit as any).mockResolvedValueOnce([]);

    const action = createTestAction("set_category", { value: "cat-other-user" });
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.categoryId).toBeUndefined();
    expect(result.appliedActions).toHaveLength(0);
  });

  it("should return validation error for missing category ID", () => {
    const actions = [createTestAction("set_category", {})]; // No value

    const errors = validateActions(actions);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Category ID is required");
  });

  it("should set mutations.categoryId correctly", async () => {
    mockCategoryQuery("cat-3", "user-1");

    const action = createTestAction("set_category", { value: "cat-3" });
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations).toHaveProperty("categoryId");
    expect(result.mutations.categoryId).toBe("cat-3");
  });

  it("should update context.category for subsequent actions", async () => {
    mockCategoryQuery("cat-1", "user-1");

    const actions = [
      createTestAction("set_category", { value: "cat-1" }),
      createTestAction("prepend_description", { pattern: "[{category}] " }),
    ];
    const transaction = createTestTransaction({ description: "Purchase" });

    const result = await executeRuleActions("user-1", actions, transaction);

    // Context was updated - description includes category name
    expect(result.mutations.description).toBe("[Groceries] Purchase");
    expect(result.appliedActions).toHaveLength(2);
  });

  it("should capture original value as null when no previous category", async () => {
    mockCategoryQuery("cat-1", "user-1");

    const action = createTestAction("set_category", { value: "cat-1" });
    const transaction = createTestTransaction({ categoryId: null });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.appliedActions[0].originalValue).toBeNull();
    expect(result.appliedActions[0].newValue).toBe("cat-1");
  });

  it("should capture original value when category already exists", async () => {
    mockCategoryQuery("cat-2", "user-1");

    const action = createTestAction("set_category", { value: "cat-2" });
    const transaction = createTestTransaction({ categoryId: "cat-1" });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.appliedActions[0].originalValue).toBe("cat-1");
    expect(result.appliedActions[0].newValue).toBe("cat-2");
  });

  it("should have correct applied action structure", async () => {
    mockCategoryQuery("cat-1", "user-1");

    const action = createTestAction("set_category", { value: "cat-1" });
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", [action], transaction);

    const appliedAction = result.appliedActions[0];
    expect(appliedAction).toHaveProperty("type");
    expect(appliedAction).toHaveProperty("field");
    expect(appliedAction).toHaveProperty("originalValue");
    expect(appliedAction).toHaveProperty("newValue");
    expect(appliedAction.type).toBe("set_category");
    expect(appliedAction.field).toBe("categoryId");
  });
});

// ============================================================================
// SET_MERCHANT ACTION TESTS
// ============================================================================

describe("Actions Executor - set_merchant Action", () => {
  it("should set valid merchant and update context", async () => {
    mockMerchantQuery("merch-1", "user-1");

    const action = createTestAction("set_merchant", { value: "merch-1" });
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.merchantId).toBe("merch-1");
    expect(result.appliedActions).toHaveLength(1);
    expect(result.appliedActions[0]).toEqual({
      type: "set_merchant",
      field: "merchantId",
      originalValue: null,
      newValue: "merch-1",
    });
  });

  it("should verify merchant exists and belongs to user", async () => {
    mockMerchantQuery("merch-2", "user-1");

    const action = createTestAction("set_merchant", { value: "merch-2" });
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.merchantId).toBe("merch-2");
    expect(result.appliedActions).toHaveLength(1);
    expect(db.limit).toHaveBeenCalled();
  });

  it("should skip action when merchant not found", async () => {
    (db.limit as any).mockResolvedValueOnce([]);

    const action = createTestAction("set_merchant", { value: "merch-invalid" });
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.merchantId).toBeUndefined();
    expect(result.appliedActions).toHaveLength(0);
  });

  it("should skip action when merchant belongs to different user", async () => {
    (db.limit as any).mockResolvedValueOnce([]);

    const action = createTestAction("set_merchant", { value: "merch-other-user" });
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.merchantId).toBeUndefined();
    expect(result.appliedActions).toHaveLength(0);
  });

  it("should return validation error for missing merchant ID", () => {
    const actions = [createTestAction("set_merchant", {})];

    const errors = validateActions(actions);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Merchant ID is required");
  });

  it("should set mutations.merchantId correctly", async () => {
    mockMerchantQuery("merch-3", "user-1");

    const action = createTestAction("set_merchant", { value: "merch-3" });
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations).toHaveProperty("merchantId");
    expect(result.mutations.merchantId).toBe("merch-3");
  });

  it("should update context.merchant for subsequent actions", async () => {
    mockMerchantQuery("merch-1", "user-1");

    const actions = [
      createTestAction("set_merchant", { value: "merch-1" }),
      createTestAction("prepend_description", { pattern: "[{merchant}] " }),
    ];
    const transaction = createTestTransaction({ description: "Purchase" });

    const result = await executeRuleActions("user-1", actions, transaction);

    expect(result.mutations.description).toBe("[Whole Foods] Purchase");
    expect(result.appliedActions).toHaveLength(2);
  });

  it("should capture original value as null when no previous merchant", async () => {
    mockMerchantQuery("merch-1", "user-1");

    const action = createTestAction("set_merchant", { value: "merch-1" });
    const transaction = createTestTransaction({ merchantId: null });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.appliedActions[0].originalValue).toBeNull();
    expect(result.appliedActions[0].newValue).toBe("merch-1");
  });

  it("should capture original value when merchant already exists", async () => {
    mockMerchantQuery("merch-2", "user-1");

    const action = createTestAction("set_merchant", { value: "merch-2" });
    const transaction = createTestTransaction({ merchantId: "merch-1" });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.appliedActions[0].originalValue).toBe("merch-1");
    expect(result.appliedActions[0].newValue).toBe("merch-2");
  });

  it("should have correct applied action structure", async () => {
    mockMerchantQuery("merch-1", "user-1");

    const action = createTestAction("set_merchant", { value: "merch-1" });
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", [action], transaction);

    const appliedAction = result.appliedActions[0];
    expect(appliedAction).toHaveProperty("type");
    expect(appliedAction).toHaveProperty("field");
    expect(appliedAction).toHaveProperty("originalValue");
    expect(appliedAction).toHaveProperty("newValue");
    expect(appliedAction.type).toBe("set_merchant");
    expect(appliedAction.field).toBe("merchantId");
  });
});

// ============================================================================
// DESCRIPTION ACTIONS TESTS
// ============================================================================

describe("Actions Executor - Description Actions - set_description", () => {
  it("should replace entire description with static text", async () => {
    const action = createTestAction("set_description", { pattern: "New Description" });
    const transaction = createTestTransaction({ description: "Old Description" });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.description).toBe("New Description");
    expect(result.appliedActions).toHaveLength(1);
    expect(result.appliedActions[0].originalValue).toBe("Old Description");
    expect(result.appliedActions[0].newValue).toBe("New Description");
  });

  it("should replace description with pattern containing variables", async () => {
    const action = createTestAction("set_description", {
      pattern: "{merchant} purchase on {date}"
    });
    const transaction = createTestTransaction({
      description: "Old",
      date: "2025-01-23"
    });
    const merchant = createTestMerchant("merch-1", "Amazon");

    const result = await executeRuleActions("user-1", [action], transaction, merchant);

    expect(result.mutations.description).toBe("Amazon purchase on 2025-01-23");
  });

  it("should return validation error when pattern is missing", () => {
    const actions = [createTestAction("set_description", {})]; // No pattern

    const errors = validateActions(actions);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Pattern is required");
  });

  it("should update context.transaction.description for subsequent actions", async () => {
    const actions = [
      createTestAction("set_description", { pattern: "Modified" }),
      createTestAction("append_description", { pattern: " Text" }),
    ];
    const transaction = createTestTransaction({ description: "Original" });

    const result = await executeRuleActions("user-1", actions, transaction);

    // First action sets to "Modified", second appends " Text"
    expect(result.mutations.description).toBe("Modified Text");
    expect(result.appliedActions).toHaveLength(2);
  });

  it("should have correct applied action structure", async () => {
    const action = createTestAction("set_description", { pattern: "Test" });
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", [action], transaction);

    const appliedAction = result.appliedActions[0];
    expect(appliedAction.type).toBe("set_description");
    expect(appliedAction.field).toBe("description");
    expect(appliedAction).toHaveProperty("originalValue");
    expect(appliedAction).toHaveProperty("newValue");
  });

  it("should preserve original value correctly", async () => {
    const action = createTestAction("set_description", { pattern: "New" });
    const transaction = createTestTransaction({ description: "Original Description" });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.appliedActions[0].originalValue).toBe("Original Description");
  });
});

describe("Actions Executor - Description Actions - prepend_description", () => {
  it("should prepend static text to description", async () => {
    const action = createTestAction("prepend_description", { pattern: "[Prefix] " });
    const transaction = createTestTransaction({ description: "Purchase" });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.description).toBe("[Prefix] Purchase");
    expect(result.appliedActions).toHaveLength(1);
  });

  it("should prepend pattern with variables", async () => {
    const action = createTestAction("prepend_description", { pattern: "[{merchant}] " });
    const transaction = createTestTransaction({ description: "Purchase" });
    const merchant = createTestMerchant("merch-1", "Whole Foods");

    const result = await executeRuleActions("user-1", [action], transaction, merchant);

    expect(result.mutations.description).toBe("[Whole Foods] Purchase");
  });

  it("should return validation error when pattern is missing", () => {
    const actions = [createTestAction("prepend_description", {})];

    const errors = validateActions(actions);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Pattern is required");
  });

  it("should update context.transaction.description for subsequent actions", async () => {
    const actions = [
      createTestAction("prepend_description", { pattern: "Start: " }),
      createTestAction("append_description", { pattern: " :End" }),
    ];
    const transaction = createTestTransaction({ description: "Middle" });

    const result = await executeRuleActions("user-1", actions, transaction);

    expect(result.mutations.description).toBe("Start: Middle :End");
    expect(result.appliedActions).toHaveLength(2);
  });

  it("should have correct applied action structure", async () => {
    const action = createTestAction("prepend_description", { pattern: "Pre " });
    const transaction = createTestTransaction({ description: "Text" });

    const result = await executeRuleActions("user-1", [action], transaction);

    const appliedAction = result.appliedActions[0];
    expect(appliedAction.type).toBe("prepend_description");
    expect(appliedAction.field).toBe("description");
    expect(appliedAction.originalValue).toBe("Text");
    expect(appliedAction.newValue).toBe("Pre Text");
  });

  it("should preserve original value correctly", async () => {
    const action = createTestAction("prepend_description", { pattern: "New: " });
    const transaction = createTestTransaction({ description: "Original" });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.appliedActions[0].originalValue).toBe("Original");
    expect(result.appliedActions[0].newValue).toBe("New: Original");
  });
});

describe("Actions Executor - Description Actions - append_description", () => {
  it("should append static text to description", async () => {
    const action = createTestAction("append_description", { pattern: " [Suffix]" });
    const transaction = createTestTransaction({ description: "Purchase" });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.description).toBe("Purchase [Suffix]");
    expect(result.appliedActions).toHaveLength(1);
  });

  it("should append pattern with variables", async () => {
    const action = createTestAction("append_description", {
      pattern: " at {merchant}"
    });
    const transaction = createTestTransaction({ description: "Coffee" });
    const merchant = createTestMerchant("merch-3", "Starbucks");

    const result = await executeRuleActions("user-1", [action], transaction, merchant);

    expect(result.mutations.description).toBe("Coffee at Starbucks");
  });

  it("should return validation error when pattern is missing", () => {
    const actions = [createTestAction("append_description", {})];

    const errors = validateActions(actions);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Pattern is required");
  });

  it("should update context.transaction.description for subsequent actions", async () => {
    const actions = [
      createTestAction("append_description", { pattern: " - Part 1" }),
      createTestAction("append_description", { pattern: " - Part 2" }),
    ];
    const transaction = createTestTransaction({ description: "Base" });

    const result = await executeRuleActions("user-1", actions, transaction);

    expect(result.mutations.description).toBe("Base - Part 1 - Part 2");
    expect(result.appliedActions).toHaveLength(2);
  });

  it("should have correct applied action structure", async () => {
    const action = createTestAction("append_description", { pattern: " End" });
    const transaction = createTestTransaction({ description: "Start" });

    const result = await executeRuleActions("user-1", [action], transaction);

    const appliedAction = result.appliedActions[0];
    expect(appliedAction.type).toBe("append_description");
    expect(appliedAction.field).toBe("description");
    expect(appliedAction.originalValue).toBe("Start");
    expect(appliedAction.newValue).toBe("Start End");
  });

  it("should preserve original value correctly", async () => {
    const action = createTestAction("append_description", { pattern: " (Modified)" });
    const transaction = createTestTransaction({ description: "Original Text" });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.appliedActions[0].originalValue).toBe("Original Text");
    expect(result.appliedActions[0].newValue).toBe("Original Text (Modified)");
  });
});

describe("Actions Executor - Description Actions - Chaining", () => {
  it("should chain multiple description actions correctly", async () => {
    mockCategoryQuery("cat-1", "user-1");
    mockMerchantQuery("merch-1", "user-1");

    const actions = [
      createTestAction("set_category", { value: "cat-1" }),
      createTestAction("set_merchant", { value: "merch-1" }),
      createTestAction("prepend_description", { pattern: "[{category}] " }),
      createTestAction("append_description", { pattern: " @ {merchant}" }),
    ];
    const transaction = createTestTransaction({ description: "Purchase" });

    const result = await executeRuleActions("user-1", actions, transaction);

    expect(result.mutations.description).toBe("[Groceries] Purchase @ Whole Foods");
    expect(result.appliedActions).toHaveLength(4);
  });

  it("should chain prepend and append multiple times", async () => {
    const actions = [
      createTestAction("prepend_description", { pattern: "A:" }),
      createTestAction("prepend_description", { pattern: "B:" }),
      createTestAction("append_description", { pattern: ":X" }),
      createTestAction("append_description", { pattern: ":Y" }),
    ];
    const transaction = createTestTransaction({ description: "Core" });

    const result = await executeRuleActions("user-1", actions, transaction);

    // B: prepended to "A:Core", then X and Y appended
    expect(result.mutations.description).toBe("B:A:Core:X:Y");
  });

  it("should use {original} variable correctly in chained actions", async () => {
    const actions = [
      createTestAction("set_description", { pattern: "Modified: {original}" }),
      createTestAction("append_description", { pattern: " (Updated)" }),
    ];
    const transaction = createTestTransaction({ description: "Original" });

    const result = await executeRuleActions("user-1", actions, transaction);

    // {original} is "Original", then "(Updated)" is appended
    expect(result.mutations.description).toBe("Modified: Original (Updated)");
  });
});

// ============================================================================
// SET_TAX_DEDUCTION ACTION TESTS
// ============================================================================

describe("Actions Executor - set_tax_deduction Action", () => {
  it("should mark transaction as tax deductible when category allows", async () => {
    // Mock category query twice: once for set_category, once for set_tax_deduction
    mockCategoryQuery("cat-2", "user-1"); // For set_category
    mockCategoryQuery("cat-2", "user-1"); // For set_tax_deduction

    const actions = [
      createTestAction("set_category", { value: "cat-2" }),
      createTestAction("set_tax_deduction"),
    ];
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", actions, transaction);

    expect(result.mutations.isTaxDeductible).toBe(true);
    expect(result.appliedActions).toHaveLength(2);
    expect(result.appliedActions[1].type).toBe("set_tax_deduction");
  });

  it("should skip action when category is not tax deductible", async () => {
    mockCategoryQuery("cat-1", "user-1"); // For set_category
    mockCategoryQuery("cat-1", "user-1"); // For set_tax_deduction (will skip after checking)

    const actions = [
      createTestAction("set_category", { value: "cat-1" }),
      createTestAction("set_tax_deduction"),
    ];
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", actions, transaction);

    expect(result.mutations.isTaxDeductible).toBeUndefined();
    expect(result.appliedActions).toHaveLength(1); // Only set_category applied
  });

  it("should skip action when no category assigned", async () => {
    const action = createTestAction("set_tax_deduction");
    const transaction = createTestTransaction({ categoryId: null });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.isTaxDeductible).toBeUndefined();
    expect(result.appliedActions).toHaveLength(0);
  });

  it("should work with category from previous set_category action", async () => {
    mockCategoryQuery("cat-2", "user-1"); // For set_category
    mockCategoryQuery("cat-2", "user-1"); // For set_tax_deduction

    const actions = [
      createTestAction("set_category", { value: "cat-2" }),
      createTestAction("set_tax_deduction"),
    ];
    const transaction = createTestTransaction({ categoryId: null });

    const result = await executeRuleActions("user-1", actions, transaction);

    expect(result.mutations.categoryId).toBe("cat-2");
    expect(result.mutations.isTaxDeductible).toBe(true);
  });

  it("should work with existing category from transaction", async () => {
    mockCategoryQuery("cat-2", "user-1");

    const action = createTestAction("set_tax_deduction");
    const transaction = createTestTransaction({ categoryId: "cat-2" });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.isTaxDeductible).toBe(true);
    expect(result.appliedActions).toHaveLength(1);
  });

  it("should have correct applied action structure", async () => {
    mockCategoryQuery("cat-2", "user-1"); // For set_category
    mockCategoryQuery("cat-2", "user-1"); // For set_tax_deduction

    const actions = [
      createTestAction("set_category", { value: "cat-2" }),
      createTestAction("set_tax_deduction"),
    ];
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", actions, transaction);

    const appliedAction = result.appliedActions[1];
    expect(appliedAction.type).toBe("set_tax_deduction");
    expect(appliedAction.field).toBe("isTaxDeductible");
    expect(appliedAction.originalValue).toBe("false");
    expect(appliedAction.newValue).toBe("true");
  });

  it("should set mutations.isTaxDeductible to true", async () => {
    mockCategoryQuery("cat-2", "user-1"); // For set_category
    mockCategoryQuery("cat-2", "user-1"); // For set_tax_deduction

    const actions = [
      createTestAction("set_category", { value: "cat-2" }),
      createTestAction("set_tax_deduction"),
    ];
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", actions, transaction);

    expect(result.mutations).toHaveProperty("isTaxDeductible");
    expect(result.mutations.isTaxDeductible).toBe(true);
  });

  it("should capture original value as false by default", async () => {
    mockCategoryQuery("cat-2", "user-1"); // For set_category
    mockCategoryQuery("cat-2", "user-1"); // For set_tax_deduction

    const actions = [
      createTestAction("set_category", { value: "cat-2" }),
      createTestAction("set_tax_deduction"),
    ];
    const transaction = createTestTransaction({ isTaxDeductible: false });

    const result = await executeRuleActions("user-1", actions, transaction);

    expect(result.appliedActions[1].originalValue).toBe("false");
    expect(result.appliedActions[1].newValue).toBe("true");
  });
});

// ============================================================================
// SET_SALES_TAX ACTION TESTS
// ============================================================================

describe("Actions Executor - set_sales_tax Action", () => {
  it("should apply sales tax to income transaction", async () => {
    const action = createTestAction("set_sales_tax", {
      config: { taxCategoryId: "tax-cat-1", enabled: true }
    });
    const transaction = createTestTransaction({ type: "income" });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.applySalesTax).toEqual({
      taxCategoryId: "tax-cat-1",
      enabled: true
    });
    expect(result.appliedActions).toHaveLength(1);
    expect(result.appliedActions[0].type).toBe("set_sales_tax");
  });

  it("should skip action for expense transaction", async () => {
    const action = createTestAction("set_sales_tax", {
      config: { taxCategoryId: "tax-cat-1", enabled: true }
    });
    const transaction = createTestTransaction({ type: "expense" });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.applySalesTax).toBeUndefined();
    expect(result.appliedActions).toHaveLength(0);
  });

  it("should skip action for transfer_out transaction", async () => {
    const action = createTestAction("set_sales_tax", {
      config: { taxCategoryId: "tax-cat-1", enabled: true }
    });
    const transaction = createTestTransaction({ type: "transfer_out" });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.applySalesTax).toBeUndefined();
    expect(result.appliedActions).toHaveLength(0);
  });

  it("should skip action for transfer_in transaction", async () => {
    const action = createTestAction("set_sales_tax", {
      config: { taxCategoryId: "tax-cat-1", enabled: true }
    });
    const transaction = createTestTransaction({ type: "transfer_in" });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.applySalesTax).toBeUndefined();
    expect(result.appliedActions).toHaveLength(0);
  });

  it("should return validation error for missing config", () => {
    const actions = [createTestAction("set_sales_tax", {})];

    const errors = validateActions(actions);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Tax category ID is required");
  });

  it("should return validation error for missing taxCategoryId", () => {
    const actions = [createTestAction("set_sales_tax", { config: { enabled: true } })];

    const errors = validateActions(actions);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Tax category ID is required");
  });

  it("should have correct applied action structure", async () => {
    const action = createTestAction("set_sales_tax", {
      config: { taxCategoryId: "tax-cat-1", enabled: true }
    });
    const transaction = createTestTransaction({ type: "income" });

    const result = await executeRuleActions("user-1", [action], transaction);

    const appliedAction = result.appliedActions[0];
    expect(appliedAction.type).toBe("set_sales_tax");
    expect(appliedAction.field).toBe("salesTax");
    expect(appliedAction).toHaveProperty("originalValue");
    expect(appliedAction).toHaveProperty("newValue");
  });

  it("should capture original value as null by default", async () => {
    const action = createTestAction("set_sales_tax", {
      config: { taxCategoryId: "tax-cat-1", enabled: true }
    });
    const transaction = createTestTransaction({ type: "income" });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.appliedActions[0].originalValue).toBe(null);
  });

  it("should store complete config structure", async () => {
    const action = createTestAction("set_sales_tax", {
      config: { taxCategoryId: "tax-cat-1", enabled: true }
    });
    const transaction = createTestTransaction({ type: "income" });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.applySalesTax).toHaveProperty("taxCategoryId");
    expect(result.mutations.applySalesTax).toHaveProperty("enabled");
    expect(result.mutations.applySalesTax.taxCategoryId).toBe("tax-cat-1");
    expect(result.mutations.applySalesTax.enabled).toBe(true);
  });

  it("should work with enabled flag as boolean", async () => {
    const actionTrue = createTestAction("set_sales_tax", {
      config: { taxCategoryId: "tax-cat-1", enabled: true }
    });
    const actionFalse = createTestAction("set_sales_tax", {
      config: { taxCategoryId: "tax-cat-1", enabled: false }
    });
    const transaction = createTestTransaction({ type: "income" });

    const resultTrue = await executeRuleActions("user-1", [actionTrue], transaction);
    const resultFalse = await executeRuleActions("user-1", [actionFalse], transaction);

    expect(resultTrue.mutations.applySalesTax.enabled).toBe(true);
    expect(resultFalse.mutations.applySalesTax.enabled).toBe(false);
  });
});

// ============================================================================
// SET_ACCOUNT ACTION TESTS
// ============================================================================

describe("Actions Executor - set_account Action", () => {
  it("should set account change for income transaction", async () => {
    const action = createTestAction("set_account", { value: "account-2" });
    const transaction = createTestTransaction({
      accountId: "account-1",
      type: "income"
    });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.changeAccount).toEqual({
      targetAccountId: "account-2"
    });
    expect(result.appliedActions).toHaveLength(1);
    expect(result.appliedActions[0].type).toBe("set_account");
    expect(result.appliedActions[0].originalValue).toBe("account-1");
    expect(result.appliedActions[0].newValue).toBe("account-2");
  });

  it("should set account change for expense transaction", async () => {
    const action = createTestAction("set_account", { value: "account-3" });
    const transaction = createTestTransaction({
      accountId: "account-1",
      type: "expense"
    });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.changeAccount).toEqual({
      targetAccountId: "account-3"
    });
    expect(result.appliedActions).toHaveLength(1);
  });

  it("should reject transfer_out transaction", async () => {
    const action = createTestAction("set_account", { value: "account-2" });
    const transaction = createTestTransaction({ type: "transfer_out" });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.changeAccount).toBeUndefined();
    expect(result.appliedActions).toHaveLength(0);
  });

  it("should reject transfer_in transaction", async () => {
    const action = createTestAction("set_account", { value: "account-2" });
    const transaction = createTestTransaction({ type: "transfer_in" });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.changeAccount).toBeUndefined();
    expect(result.appliedActions).toHaveLength(0);
  });

  it("should return validation error for missing target account ID", () => {
    const actions = [createTestAction("set_account", {})];

    const errors = validateActions(actions);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Account ID is required");
  });

  it("should have correct applied action structure", async () => {
    const action = createTestAction("set_account", { value: "account-2" });
    const transaction = createTestTransaction({ accountId: "account-1", type: "expense" });

    const result = await executeRuleActions("user-1", [action], transaction);

    const appliedAction = result.appliedActions[0];
    expect(appliedAction.type).toBe("set_account");
    expect(appliedAction.field).toBe("accountId");
    expect(appliedAction).toHaveProperty("originalValue");
    expect(appliedAction).toHaveProperty("newValue");
  });

  it("should capture original account ID correctly", async () => {
    const action = createTestAction("set_account", { value: "account-new" });
    const transaction = createTestTransaction({ accountId: "account-original", type: "income" });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.appliedActions[0].originalValue).toBe("account-original");
    expect(result.appliedActions[0].newValue).toBe("account-new");
  });

  it("should store correct changeAccount mutation structure", async () => {
    const action = createTestAction("set_account", { value: "target-account-id" });
    const transaction = createTestTransaction({ type: "expense" });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.changeAccount).toHaveProperty("targetAccountId");
    expect(result.mutations.changeAccount.targetAccountId).toBe("target-account-id");
  });
});

// ============================================================================
// CREATE_SPLIT ACTION TESTS
// ============================================================================

describe("Actions Executor - create_split Action", () => {
  it("should create valid percentage splits totaling 100%", async () => {
    const action = createTestAction("create_split", {
      config: {
        splits: [
          { categoryId: "cat-1", percentage: 60, isPercentage: true },
          { categoryId: "cat-2", percentage: 40, isPercentage: true }
        ]
      }
    });
    const transaction = createTestTransaction({ amount: 100 });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.createSplits).toHaveLength(2);
    expect(result.mutations.createSplits[0].percentage).toBe(60);
    expect(result.mutations.createSplits[1].percentage).toBe(40);
    expect(result.appliedActions).toHaveLength(1);
    expect(result.appliedActions[0].type).toBe("create_split");
  });

  it("should create valid percentage splits totaling less than 100%", async () => {
    const action = createTestAction("create_split", {
      config: {
        splits: [
          { categoryId: "cat-1", percentage: 50, isPercentage: true },
          { categoryId: "cat-2", percentage: 30, isPercentage: true }
        ]
      }
    });
    const transaction = createTestTransaction({ amount: 100 });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.createSplits).toHaveLength(2);
    expect(result.appliedActions).toHaveLength(1);
  });

  it("should reject splits with total percentage > 100%", async () => {
    const action = createTestAction("create_split", {
      config: {
        splits: [
          { categoryId: "cat-1", percentage: 60, isPercentage: true },
          { categoryId: "cat-2", percentage: 50, isPercentage: true } // Total = 110%
        ]
      }
    });
    const transaction = createTestTransaction({ amount: 100 });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.createSplits).toBeUndefined();
    expect(result.appliedActions).toHaveLength(0);
  });

  it("should create valid fixed amount splits", async () => {
    const action = createTestAction("create_split", {
      config: {
        splits: [
          { categoryId: "cat-1", amount: 25.50, isPercentage: false },
          { categoryId: "cat-2", amount: 74.50, isPercentage: false }
        ]
      }
    });
    const transaction = createTestTransaction({ amount: 100 });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.createSplits).toHaveLength(2);
    expect(result.mutations.createSplits[0].amount).toBe(25.50);
    expect(result.mutations.createSplits[1].amount).toBe(74.50);
    expect(result.appliedActions).toHaveLength(1);
  });

  it("should create mixed splits (percentage + fixed amount)", async () => {
    const action = createTestAction("create_split", {
      config: {
        splits: [
          { categoryId: "cat-1", percentage: 50, isPercentage: true },
          { categoryId: "cat-2", amount: 25.00, isPercentage: false }
        ]
      }
    });
    const transaction = createTestTransaction({ amount: 100 });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.createSplits).toHaveLength(2);
    expect(result.mutations.createSplits[0].percentage).toBe(50);
    expect(result.mutations.createSplits[1].amount).toBe(25.00);
    expect(result.appliedActions).toHaveLength(1);
  });

  it("should return validation error for missing config", () => {
    const actions = [createTestAction("create_split", {})];

    const errors = validateActions(actions);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Splits configuration is required");
  });

  it("should return validation error for empty splits array", () => {
    const actions = [createTestAction("create_split", { config: { splits: [] } })];

    const errors = validateActions(actions);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("At least one split is required");
  });

  it("should return validation error for missing splits in config", () => {
    const actions = [createTestAction("create_split", { config: {} })];

    const errors = validateActions(actions);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Splits configuration is required");
  });

  it("should have correct applied action structure", async () => {
    const action = createTestAction("create_split", {
      config: {
        splits: [
          { categoryId: "cat-1", percentage: 100, isPercentage: true }
        ]
      }
    });
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", [action], transaction);

    const appliedAction = result.appliedActions[0];
    expect(appliedAction.type).toBe("create_split");
    expect(appliedAction.field).toBe("isSplit");
    expect(appliedAction.originalValue).toBe("false");
    expect(appliedAction.newValue).toBe("true");
  });

  it("should support optional description field per split", async () => {
    const action = createTestAction("create_split", {
      config: {
        splits: [
          { categoryId: "cat-1", percentage: 60, isPercentage: true, description: "First part" },
          { categoryId: "cat-2", percentage: 40, isPercentage: true, description: "Second part" }
        ]
      }
    });
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.createSplits).toHaveLength(2);
    expect(result.mutations.createSplits[0].description).toBe("First part");
    expect(result.mutations.createSplits[1].description).toBe("Second part");
  });

  it("should store complete split configuration in mutations", async () => {
    const action = createTestAction("create_split", {
      config: {
        splits: [
          { categoryId: "cat-1", percentage: 50, isPercentage: true },
          { categoryId: "cat-2", amount: 25, isPercentage: false }
        ]
      }
    });
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations).toHaveProperty("createSplits");
    expect(result.mutations.createSplits).toBeInstanceOf(Array);
    expect(result.mutations.createSplits).toHaveLength(2);
  });

  it("should handle split with all fields (categoryId, amount, description)", async () => {
    const action = createTestAction("create_split", {
      config: {
        splits: [
          {
            categoryId: "cat-1",
            amount: 75.50,
            isPercentage: false,
            description: "Primary expense"
          },
          {
            categoryId: "cat-2",
            amount: 24.50,
            isPercentage: false,
            description: "Secondary expense"
          }
        ]
      }
    });
    const transaction = createTestTransaction({ amount: 100 });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.createSplits).toHaveLength(2);
    expect(result.mutations.createSplits[0]).toEqual({
      categoryId: "cat-1",
      amount: 75.50,
      isPercentage: false,
      description: "Primary expense"
    });
    expect(result.mutations.createSplits[1]).toEqual({
      categoryId: "cat-2",
      amount: 24.50,
      isPercentage: false,
      description: "Secondary expense"
    });
  });
});

// ============================================================================
// CONVERT_TO_TRANSFER ACTION TESTS
// ============================================================================

describe("Actions Executor - convert_to_transfer Action", () => {
  it("should set transfer conversion with target account", async () => {
    const action = createTestAction("convert_to_transfer", {
      config: { targetAccountId: "account-2" }
    });
    const transaction = createTestTransaction({ type: "expense" });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.convertToTransfer).toEqual({
      targetAccountId: "account-2",
      autoMatch: true,
      matchTolerance: 1,
      matchDayRange: 7,
      createIfNoMatch: true
    });
    expect(result.appliedActions).toHaveLength(1);
    expect(result.appliedActions[0].type).toBe("convert_to_transfer");
  });

  it("should set transfer conversion without target account (auto-detect)", async () => {
    const action = createTestAction("convert_to_transfer", {
      config: {}
    });
    const transaction = createTestTransaction({ type: "income" });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.convertToTransfer).toEqual({
      targetAccountId: undefined,
      autoMatch: true,
      matchTolerance: 1,
      matchDayRange: 7,
      createIfNoMatch: true
    });
    expect(result.appliedActions).toHaveLength(1);
  });

  it("should skip action for transfer_out transaction", async () => {
    const action = createTestAction("convert_to_transfer", {
      config: { targetAccountId: "account-2" }
    });
    const transaction = createTestTransaction({ type: "transfer_out" });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.convertToTransfer).toBeUndefined();
    expect(result.appliedActions).toHaveLength(0);
  });

  it("should skip action for transfer_in transaction", async () => {
    const action = createTestAction("convert_to_transfer", {
      config: { targetAccountId: "account-2" }
    });
    const transaction = createTestTransaction({ type: "transfer_in" });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.convertToTransfer).toBeUndefined();
    expect(result.appliedActions).toHaveLength(0);
  });

  it("should apply default configuration values", async () => {
    const action = createTestAction("convert_to_transfer", {
      config: { targetAccountId: "account-2" }
    });
    const transaction = createTestTransaction({ type: "expense" });

    const result = await executeRuleActions("user-1", [action], transaction);

    // Verify all defaults are applied
    expect(result.mutations.convertToTransfer.autoMatch).toBe(true);
    expect(result.mutations.convertToTransfer.matchTolerance).toBe(1);
    expect(result.mutations.convertToTransfer.matchDayRange).toBe(7);
    expect(result.mutations.convertToTransfer.createIfNoMatch).toBe(true);
  });

  it("should accept custom configuration values", async () => {
    const action = createTestAction("convert_to_transfer", {
      config: {
        targetAccountId: "account-2",
        autoMatch: false,
        matchTolerance: 5,
        matchDayRange: 14,
        createIfNoMatch: false
      }
    });
    const transaction = createTestTransaction({ type: "expense" });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.convertToTransfer).toEqual({
      targetAccountId: "account-2",
      autoMatch: false,
      matchTolerance: 5,
      matchDayRange: 14,
      createIfNoMatch: false
    });
  });

  it("should have correct applied action structure", async () => {
    const action = createTestAction("convert_to_transfer", {
      config: { targetAccountId: "account-2" }
    });
    const transaction = createTestTransaction({ type: "expense" });

    const result = await executeRuleActions("user-1", [action], transaction);

    const appliedAction = result.appliedActions[0];
    expect(appliedAction.type).toBe("convert_to_transfer");
    expect(appliedAction.field).toBe("type");
    expect(appliedAction).toHaveProperty("originalValue");
    expect(appliedAction).toHaveProperty("newValue");
  });

  it("should capture original transaction type correctly", async () => {
    const action = createTestAction("convert_to_transfer", {
      config: { targetAccountId: "account-2" }
    });
    const expenseTransaction = createTestTransaction({ type: "expense" });
    const incomeTransaction = createTestTransaction({ type: "income" });

    const expenseResult = await executeRuleActions("user-1", [action], expenseTransaction);
    const incomeResult = await executeRuleActions("user-1", [action], incomeTransaction);

    expect(expenseResult.appliedActions[0].originalValue).toBe("expense");
    expect(expenseResult.appliedActions[0].newValue).toBe("transfer_out");
    expect(incomeResult.appliedActions[0].originalValue).toBe("income");
    expect(incomeResult.appliedActions[0].newValue).toBe("transfer_out");
  });

  it("should store complete conversion config in mutations", async () => {
    const action = createTestAction("convert_to_transfer", {
      config: { targetAccountId: "account-target" }
    });
    const transaction = createTestTransaction({ type: "expense" });

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations).toHaveProperty("convertToTransfer");
    expect(result.mutations.convertToTransfer).toHaveProperty("targetAccountId");
    expect(result.mutations.convertToTransfer).toHaveProperty("autoMatch");
    expect(result.mutations.convertToTransfer).toHaveProperty("matchTolerance");
    expect(result.mutations.convertToTransfer).toHaveProperty("matchDayRange");
    expect(result.mutations.convertToTransfer).toHaveProperty("createIfNoMatch");
  });

  it("should handle all config fields correctly", async () => {
    const action = createTestAction("convert_to_transfer", {
      config: {
        targetAccountId: "target-id",
        autoMatch: true,
        matchTolerance: 2.5,
        matchDayRange: 10,
        createIfNoMatch: false
      }
    });
    const transaction = createTestTransaction({ type: "income" });

    const result = await executeRuleActions("user-1", [action], transaction);

    const config = result.mutations.convertToTransfer;
    expect(config.targetAccountId).toBe("target-id");
    expect(config.autoMatch).toBe(true);
    expect(config.matchTolerance).toBe(2.5);
    expect(config.matchDayRange).toBe(10);
    expect(config.createIfNoMatch).toBe(false);
  });
});

// ============================================================================
// MULTIPLE ACTIONS EXECUTION TESTS
// ============================================================================

describe("Actions Executor - Multiple Actions", () => {
  it("should execute 2 actions in sequence", async () => {
    mockCategoryQuery("cat-1", "user-1");
    mockMerchantQuery("merch-1", "user-1");

    const actions = [
      createTestAction("set_category", { value: "cat-1" }),
      createTestAction("set_merchant", { value: "merch-1" })
    ];
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", actions, transaction);

    expect(result.mutations.categoryId).toBe("cat-1");
    expect(result.mutations.merchantId).toBe("merch-1");
    expect(result.appliedActions).toHaveLength(2);
    expect(result.appliedActions[0].type).toBe("set_category");
    expect(result.appliedActions[1].type).toBe("set_merchant");
  });

  it("should execute 3+ actions in sequence", async () => {
    mockCategoryQuery("cat-1", "user-1");
    mockMerchantQuery("merch-1", "user-1");

    const actions = [
      createTestAction("set_category", { value: "cat-1" }),
      createTestAction("set_merchant", { value: "merch-1" }),
      createTestAction("prepend_description", { pattern: "[Store] " }),
      createTestAction("append_description", { pattern: " - Paid" })
    ];
    const transaction = createTestTransaction({ description: "Purchase" });

    const result = await executeRuleActions("user-1", actions, transaction);

    expect(result.mutations.categoryId).toBe("cat-1");
    expect(result.mutations.merchantId).toBe("merch-1");
    expect(result.mutations.description).toBe("[Store] Purchase - Paid");
    expect(result.appliedActions).toHaveLength(4);
  });

  it("should update context for subsequent actions", async () => {
    mockCategoryQuery("cat-1", "user-1");
    mockMerchantQuery("merch-1", "user-1");

    const actions = [
      createTestAction("set_category", { value: "cat-1" }),
      createTestAction("set_merchant", { value: "merch-1" }),
      createTestAction("prepend_description", { pattern: "[{merchant}] " }),
      createTestAction("append_description", { pattern: " - {category}" })
    ];
    const transaction = createTestTransaction({ description: "Purchase" });

    const result = await executeRuleActions("user-1", actions, transaction);

    // Merchant and category should be available in patterns
    expect(result.mutations.description).toBe("[Whole Foods] Purchase - Groceries");
    expect(result.appliedActions).toHaveLength(4);
  });

  it("should handle set_category then set_tax_deduction dependency", async () => {
    mockCategoryQuery("cat-2", "user-1"); // For set_category
    mockCategoryQuery("cat-2", "user-1"); // For set_tax_deduction

    const actions = [
      createTestAction("set_category", { value: "cat-2" }), // Business Expenses (tax deductible)
      createTestAction("set_tax_deduction")
    ];
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", actions, transaction);

    expect(result.mutations.categoryId).toBe("cat-2");
    expect(result.mutations.isTaxDeductible).toBe(true);
    expect(result.appliedActions).toHaveLength(2);
  });

  it("should handle set_merchant then description with {merchant} variable", async () => {
    mockMerchantQuery("merch-1", "user-1");

    const actions = [
      createTestAction("set_merchant", { value: "merch-1" }),
      createTestAction("set_description", { pattern: "Payment to {merchant}" })
    ];
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", actions, transaction);

    expect(result.mutations.merchantId).toBe("merch-1");
    expect(result.mutations.description).toBe("Payment to Whole Foods");
  });

  it("should chain multiple description actions", async () => {
    const actions = [
      createTestAction("prepend_description", { pattern: "[TAG] " }),
      createTestAction("append_description", { pattern: " - Part 1" }),
      createTestAction("append_description", { pattern: " - Part 2" })
    ];
    const transaction = createTestTransaction({ description: "Core" });

    const result = await executeRuleActions("user-1", actions, transaction);

    expect(result.mutations.description).toBe("[TAG] Core - Part 1 - Part 2");
    expect(result.appliedActions).toHaveLength(3);
  });

  it("should mix immediate and post-creation actions", async () => {
    mockCategoryQuery("cat-1", "user-1");

    const actions = [
      createTestAction("set_category", { value: "cat-1" }), // Immediate
      createTestAction("set_description", { pattern: "Updated" }), // Immediate
      createTestAction("set_account", { value: "account-2" }), // Post-creation
      createTestAction("convert_to_transfer", { config: { targetAccountId: "account-3" } }) // Post-creation
    ];
    const transaction = createTestTransaction({ type: "expense" });

    const result = await executeRuleActions("user-1", actions, transaction);

    expect(result.mutations.categoryId).toBe("cat-1");
    expect(result.mutations.description).toBe("Updated");
    expect(result.mutations.changeAccount).toEqual({ targetAccountId: "account-2" });
    expect(result.mutations.convertToTransfer).toBeDefined();
    expect(result.appliedActions).toHaveLength(4);
  });

  it("should maintain applied actions array in correct order", async () => {
    mockCategoryQuery("cat-1", "user-1");
    mockMerchantQuery("merch-1", "user-1");

    const actions = [
      createTestAction("set_category", { value: "cat-1" }),
      createTestAction("set_merchant", { value: "merch-1" }),
      createTestAction("set_description", { pattern: "Test" })
    ];
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", actions, transaction);

    expect(result.appliedActions).toHaveLength(3);
    expect(result.appliedActions[0].type).toBe("set_category");
    expect(result.appliedActions[1].type).toBe("set_merchant");
    expect(result.appliedActions[2].type).toBe("set_description");
  });

  it("should continue execution when one action fails", async () => {
    mockCategoryQuery("cat-1", "user-1");
    mockMerchantQuery("merch-invalid", "user-1", true); // This will fail

    const actions = [
      createTestAction("set_category", { value: "cat-1" }), // Success
      createTestAction("set_merchant", { value: "merch-invalid" }), // Fails
      createTestAction("set_description", { pattern: "Test" }) // Should still execute
    ];
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", actions, transaction);

    // Category and description should succeed even though merchant failed
    expect(result.mutations.categoryId).toBe("cat-1");
    expect(result.mutations.description).toBe("Test");
    expect(result.mutations.merchantId).toBeUndefined();
    expect(result.appliedActions).toHaveLength(2); // Only successful actions
  });

  it("should handle error in middle action without stopping subsequent actions", async () => {
    mockCategoryQuery("cat-1", "user-1");
    mockCategoryQuery("cat-invalid", "user-1", true); // This will fail
    mockMerchantQuery("merch-1", "user-1");

    const actions = [
      createTestAction("set_category", { value: "cat-1" }), // Success
      createTestAction("set_category", { value: "cat-invalid" }), // Fails (overwrites previous)
      createTestAction("set_merchant", { value: "merch-1" }) // Should still execute
    ];
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", actions, transaction);

    expect(result.mutations.categoryId).toBe("cat-1"); // First one succeeded
    expect(result.mutations.merchantId).toBe("merch-1"); // Third one succeeded
    expect(result.appliedActions).toHaveLength(2); // Two successful actions
  });

  it("should collect all mutations correctly", async () => {
    mockCategoryQuery("cat-1", "user-1");
    mockMerchantQuery("merch-1", "user-1");

    const actions = [
      createTestAction("set_category", { value: "cat-1" }),
      createTestAction("set_merchant", { value: "merch-1" }),
      createTestAction("set_description", { pattern: "Modified" }),
      createTestAction("set_account", { value: "account-2" })
    ];
    const transaction = createTestTransaction({ type: "expense" });

    const result = await executeRuleActions("user-1", actions, transaction);

    expect(result.mutations).toHaveProperty("categoryId");
    expect(result.mutations).toHaveProperty("merchantId");
    expect(result.mutations).toHaveProperty("description");
    expect(result.mutations).toHaveProperty("changeAccount");
    expect(Object.keys(result.mutations).length).toBeGreaterThanOrEqual(4);
  });

  it("should handle empty actions array", async () => {
    const actions: any[] = [];
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", actions, transaction);

    expect(result.mutations).toEqual({});
    expect(result.appliedActions).toHaveLength(0);
    expect(result.errors).toBeUndefined(); // No errors means undefined, not empty array
  });
});

// ============================================================================
// VALIDATION TESTS
// ============================================================================

describe("Actions Executor - Validation", () => {
  it("should return no errors for valid actions", () => {
    const actions = [
      createTestAction("set_category", { value: "cat-1" }),
      createTestAction("set_merchant", { value: "merch-1" }),
      createTestAction("set_description", { pattern: "Test" })
    ];

    const errors = validateActions(actions);

    expect(errors).toHaveLength(0);
  });

  it("should return error for missing action type", () => {
    const actions = [{ value: "cat-1" }] as any;

    const errors = validateActions(actions);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("type");
  });

  it("should return error for missing required value", () => {
    const actions = [
      createTestAction("set_category", {}),
      createTestAction("set_merchant", {})
    ];

    const errors = validateActions(actions);

    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it("should return error for missing required pattern", () => {
    const actions = [
      createTestAction("set_description", {}),
      createTestAction("prepend_description", {}),
      createTestAction("append_description", {})
    ];

    const errors = validateActions(actions);

    expect(errors.length).toBeGreaterThanOrEqual(3);
    expect(errors.every(e => e.includes("Pattern"))).toBe(true);
  });

  it("should return error for missing required config", () => {
    const actions = [
      createTestAction("create_split", {}),
      createTestAction("set_sales_tax", {})
    ];

    const errors = validateActions(actions);

    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it("should detect invalid action type", () => {
    const actions = [{ type: "unknown_action", value: "test" }] as any;

    const errors = validateActions(actions);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Unknown action type");
  });

  it("should return multiple validation errors at once", () => {
    const actions = [
      { value: "cat-1" }, // Missing type
      createTestAction("set_description", {}), // Missing pattern
      createTestAction("unknown_action", { value: "test" }) // Invalid type
    ] as any;

    const errors = validateActions(actions);

    expect(errors.length).toBeGreaterThanOrEqual(3);
  });

  it("should validate empty actions array as valid", () => {
    const actions: any[] = [];

    const errors = validateActions(actions);

    expect(errors).toHaveLength(0);
  });
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

describe("Actions Executor - Error Handling", () => {
  it("should handle category not found error", async () => {
    mockCategoryQuery("cat-invalid", "user-1", true);

    const action = createTestAction("set_category", { value: "cat-invalid" });
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.categoryId).toBeUndefined();
    expect(result.appliedActions).toHaveLength(0);
  });

  it("should handle merchant not found error", async () => {
    mockMerchantQuery("merch-invalid", "user-1", true);

    const action = createTestAction("set_merchant", { value: "merch-invalid" });
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.merchantId).toBeUndefined();
    expect(result.appliedActions).toHaveLength(0);
  });

  it("should handle invalid split configuration gracefully", async () => {
    const action = createTestAction("create_split", {
      config: {
        splits: [
          { categoryId: "cat-1", percentage: 70, isPercentage: true },
          { categoryId: "cat-2", percentage: 50, isPercentage: true } // Total > 100%
        ]
      }
    });
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", [action], transaction);

    expect(result.mutations.createSplits).toBeUndefined();
    expect(result.appliedActions).toHaveLength(0);
  });

  it("should handle errors without stopping execution", async () => {
    mockCategoryQuery("cat-1", "user-1");
    mockMerchantQuery("merch-invalid", "user-1", true); // This will fail

    const actions = [
      createTestAction("set_category", { value: "cat-1" }), // Success
      createTestAction("set_merchant", { value: "merch-invalid" }), // Fail
      createTestAction("set_description", { pattern: "Test" }) // Success
    ];
    const transaction = createTestTransaction();

    const result = await executeRuleActions("user-1", actions, transaction);

    expect(result.mutations.categoryId).toBe("cat-1");
    expect(result.mutations.description).toBe("Test");
    expect(result.appliedActions).toHaveLength(2);
  });
});

// ============================================================================
// UTILITY FUNCTIONS TESTS
// ============================================================================

describe("Actions Executor - Utility Functions", () => {
  it("should return description for set_category", () => {
    const description = getActionDescription({ type: "set_category", value: "cat-1" });
    expect(description).toContain("category");
  });

  it("should return description for set_merchant", () => {
    const description = getActionDescription({ type: "set_merchant", value: "merch-1" });
    expect(description).toContain("merchant");
  });

  it("should return description for description actions", () => {
    const descSet = getActionDescription({ type: "set_description", pattern: "Test" });
    const descPrepend = getActionDescription({ type: "prepend_description", pattern: "Test" });
    const descAppend = getActionDescription({ type: "append_description", pattern: "Test" });

    expect(descSet).toContain("description");
    expect(descPrepend).toContain("description");
    expect(descAppend).toContain("description");
  });

  it("should return description for all action types", () => {
    const actionTypes: RuleAction['type'][] = [
      "set_category",
      "set_merchant",
      "set_description",
      "prepend_description",
      "append_description",
      "set_tax_deduction",
      "set_sales_tax",
      "convert_to_transfer",
      "create_split",
      "set_account"
    ];

    actionTypes.forEach(type => {
      const action = { type, value: "test", pattern: "test", config: {} } as any;
      const description = getActionDescription(action);
      expect(description).toBeTruthy();
      expect(typeof description).toBe("string");
    });
  });

  it("should check if action is implemented", () => {
    expect(isActionImplemented("set_category")).toBe(true);
    expect(isActionImplemented("set_merchant")).toBe(true);
    expect(isActionImplemented("set_description")).toBe(true);
    expect(isActionImplemented("convert_to_transfer")).toBe(true);
    expect(isActionImplemented("unknown_action" as any)).toBe(false);
  });
});
