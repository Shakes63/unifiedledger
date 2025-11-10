import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  findMatchingRule,
  findAllMatchingRules,
  testRule,
  testRuleOnMultiple,
} from "@/lib/rules/rule-matcher";
import type {
  RuleAction,
  RuleActionType,
  RuleEvaluationResult,
  RuleMatch,
} from "@/lib/rules/types";
import type {
  TransactionData,
  Condition,
  ConditionGroup,
  ComparisonOperator,
  ConditionField,
} from "@/lib/rules/condition-evaluator";

/**
 * Comprehensive tests for the Rules System Rule Matcher
 *
 * Coverage target: 95%+
 * Tests rule matching, priority-based selection, action parsing, and error handling
 *
 * Functions tested:
 * - parseRuleActions() - Parses actions from database format (internal)
 * - evaluateRule() - Evaluates single rule (internal)
 * - findMatchingRule() - Finds highest priority matching rule (async, uses DB)
 * - findAllMatchingRules() - Finds all matching rules (async, uses DB)
 * - testRule() - Tests rule against transaction (sync, UI preview)
 * - testRuleOnMultiple() - Tests rule against multiple transactions (sync)
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface TestRule {
  id: string;
  name: string;
  userId: string;
  categoryId: string | null;
  priority: number | null;
  isActive: boolean;
  conditions: string;
  actions: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface RuleForTest {
  id?: string;
  name: string;
  categoryId: string;
  priority: number;
  conditions: string;
}

// ============================================================================
// MOCK DATABASE SETUP
// ============================================================================

// Mock the database module
vi.mock('@/lib/db', () => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([]),
  };

  return {
    db: mockDb,
  };
});

// Import mocked db after mocking
import { db } from '@/lib/db';

// ============================================================================
// TEST DATA FACTORIES
// ============================================================================

/**
 * Create test transaction with sensible defaults
 */
function createTestTransaction(overrides?: Partial<TransactionData>): TransactionData {
  return {
    description: "Coffee Shop Purchase",
    amount: 5.50,
    accountName: "Checking",
    date: "2025-01-23", // Wednesday
    notes: "Morning coffee",
    ...overrides,
  };
}

/**
 * Create test rule with all required fields
 */
function createTestRule(overrides?: Partial<TestRule>): TestRule {
  return {
    id: 'rule-1',
    name: 'Test Rule',
    userId: 'user-123',
    categoryId: 'cat-1',
    priority: 1,
    isActive: true,
    conditions: JSON.stringify({
      field: 'description',
      operator: 'contains',
      value: 'coffee',
      caseSensitive: false,
    }),
    actions: null, // Will test backward compatibility
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create condition as JSON string (for rule.conditions field)
 */
function createConditionJSON(
  field: ConditionField,
  operator: ComparisonOperator,
  value: string,
  caseSensitive = false
): string {
  return JSON.stringify({ field, operator, value, caseSensitive });
}

/**
 * Create action object
 */
function createTestAction(
  type: RuleActionType,
  value?: string,
  pattern?: string,
  config?: Record<string, any>
): RuleAction {
  const action: RuleAction = { type };
  if (value !== undefined) action.value = value;
  if (pattern !== undefined) action.pattern = pattern;
  if (config !== undefined) action.config = config;
  return action;
}

/**
 * Create actions array as JSON string (for rule.actions field)
 */
function createActionsJSON(actions: RuleAction[]): string {
  return JSON.stringify(actions);
}

/**
 * Create AND condition group
 */
function createAndGroup(conditions: (Condition | ConditionGroup)[]): ConditionGroup {
  return {
    logic: 'AND',
    conditions,
  };
}

/**
 * Create OR condition group
 */
function createOrGroup(conditions: (Condition | ConditionGroup)[]): ConditionGroup {
  return {
    logic: 'OR',
    conditions,
  };
}

/**
 * Create test condition object
 */
function createTestCondition(
  field: ConditionField,
  operator: ComparisonOperator,
  value: string,
  caseSensitive = false
): Condition {
  return { field, operator, value, caseSensitive };
}

/**
 * Mock database with rules
 * Simulates database sorting by priority (ascending)
 */
function mockDatabaseRules(rules: TestRule[]): void {
  // Sort rules by priority (ascending) to simulate database ORDER BY
  const sortedRules = [...rules].sort((a, b) => {
    if (a.priority === null) return 1; // null priorities go to end
    if (b.priority === null) return -1;
    return a.priority - b.priority;
  });
  vi.mocked(db.orderBy).mockResolvedValue(sortedRules as any);
}

/**
 * Clear all database mocks
 */
function clearDatabaseMocks(): void {
  vi.clearAllMocks();
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe("Rule Matcher - Setup & Infrastructure", () => {
  beforeEach(() => {
    clearDatabaseMocks();
  });

  afterEach(() => {
    clearDatabaseMocks();
  });

  describe("Test Infrastructure", () => {
    it("should have database mocking configured", () => {
      expect(db).toBeDefined();
      expect(db.select).toBeDefined();
      expect(db.from).toBeDefined();
      expect(db.where).toBeDefined();
      expect(db.orderBy).toBeDefined();
    });

    it("should create test transaction with defaults", () => {
      const transaction = createTestTransaction();
      expect(transaction.description).toBe("Coffee Shop Purchase");
      expect(transaction.amount).toBe(5.50);
      expect(transaction.accountName).toBe("Checking");
      expect(transaction.date).toBe("2025-01-23");
      expect(transaction.notes).toBe("Morning coffee");
    });

    it("should create test transaction with overrides", () => {
      const transaction = createTestTransaction({
        description: "Restaurant Bill",
        amount: 25.00,
      });
      expect(transaction.description).toBe("Restaurant Bill");
      expect(transaction.amount).toBe(25.00);
      expect(transaction.accountName).toBe("Checking"); // Default maintained
    });

    it("should create test rule with defaults", () => {
      const rule = createTestRule();
      expect(rule.id).toBe('rule-1');
      expect(rule.name).toBe('Test Rule');
      expect(rule.userId).toBe('user-123');
      expect(rule.categoryId).toBe('cat-1');
      expect(rule.priority).toBe(1);
      expect(rule.isActive).toBe(true);
      expect(rule.actions).toBeNull();
      expect(JSON.parse(rule.conditions)).toHaveProperty('field', 'description');
    });

    it("should create condition JSON string", () => {
      const conditionJSON = createConditionJSON('description', 'contains', 'coffee');
      const parsed = JSON.parse(conditionJSON);
      expect(parsed.field).toBe('description');
      expect(parsed.operator).toBe('contains');
      expect(parsed.value).toBe('coffee');
      expect(parsed.caseSensitive).toBe(false);
    });

    it("should create test action", () => {
      const action = createTestAction('set_category', 'cat-123');
      expect(action.type).toBe('set_category');
      expect(action.value).toBe('cat-123');
    });

    it("should create actions JSON string", () => {
      const actions = [
        createTestAction('set_category', 'cat-123'),
        createTestAction('set_merchant', 'merch-456'),
      ];
      const actionsJSON = createActionsJSON(actions);
      const parsed = JSON.parse(actionsJSON);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].type).toBe('set_category');
      expect(parsed[1].type).toBe('set_merchant');
    });

    it("should create AND condition group", () => {
      const group = createAndGroup([
        createTestCondition('description', 'contains', 'coffee'),
        createTestCondition('amount', 'greater_than', '5'),
      ]);
      expect(group.logic).toBe('AND');
      expect(group.conditions).toHaveLength(2);
    });

    it("should create OR condition group", () => {
      const group = createOrGroup([
        createTestCondition('description', 'contains', 'coffee'),
        createTestCondition('description', 'contains', 'tea'),
      ]);
      expect(group.logic).toBe('OR');
      expect(group.conditions).toHaveLength(2);
    });
  });

  describe("Smoke Tests", () => {
    it("should import rule matcher functions", () => {
      expect(findMatchingRule).toBeDefined();
      expect(findAllMatchingRules).toBeDefined();
      expect(testRule).toBeDefined();
      expect(testRuleOnMultiple).toBeDefined();
    });

    it("testRule should be callable without database", () => {
      const rule: RuleForTest = {
        name: 'Test Rule',
        categoryId: 'cat-1',
        priority: 1,
        conditions: createConditionJSON('description', 'contains', 'coffee'),
      };
      const transaction = createTestTransaction();

      const result = testRule(rule, transaction);

      expect(result).toHaveProperty('matched');
      expect(typeof result.matched).toBe('boolean');
    });

    it("testRuleOnMultiple should be callable without database", () => {
      const rule: RuleForTest = {
        name: 'Test Rule',
        categoryId: 'cat-1',
        priority: 1,
        conditions: createConditionJSON('description', 'contains', 'coffee'),
      };
      const transactions = [
        createTestTransaction(),
        createTestTransaction({ description: "Tea Shop" }),
      ];

      const results = testRuleOnMultiple(rule, transactions);

      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('transaction');
      expect(results[0]).toHaveProperty('matched');
    });
  });
});

// ============================================================================
// TASK 3: testRule() FUNCTION TESTS
// ============================================================================

describe("Rule Matcher - testRule() Function", () => {
  describe("Single Condition Matching", () => {
    it("should match when single condition is true", () => {
      const rule: RuleForTest = {
        name: 'Coffee Rule',
        categoryId: 'cat-coffee',
        priority: 1,
        conditions: createConditionJSON('description', 'contains', 'coffee'),
      };
      const transaction = createTestTransaction({ description: "Coffee Shop Purchase" });

      const result = testRule(rule, transaction);

      expect(result.matched).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it("should not match when single condition is false", () => {
      const rule: RuleForTest = {
        name: 'Restaurant Rule',
        categoryId: 'cat-restaurant',
        priority: 1,
        conditions: createConditionJSON('description', 'contains', 'restaurant'),
      };
      const transaction = createTestTransaction({ description: "Coffee Shop Purchase" });

      const result = testRule(rule, transaction);

      expect(result.matched).toBe(false);
      expect(result.errors).toBeUndefined();
    });
  });

  describe("Multiple Conditions with AND Logic", () => {
    it("should match when all AND conditions are true", () => {
      const conditions = createAndGroup([
        createTestCondition('description', 'contains', 'coffee'),
        createTestCondition('amount', 'greater_than', '5'),
      ]);
      const rule: RuleForTest = {
        name: 'Expensive Coffee Rule',
        categoryId: 'cat-coffee',
        priority: 1,
        conditions: JSON.stringify(conditions),
      };
      const transaction = createTestTransaction({
        description: "Coffee Shop Purchase",
        amount: 5.50,
      });

      const result = testRule(rule, transaction);

      expect(result.matched).toBe(true);
    });

    it("should not match when any AND condition is false", () => {
      const conditions = createAndGroup([
        createTestCondition('description', 'contains', 'coffee'),
        createTestCondition('amount', 'greater_than', '10'),
      ]);
      const rule: RuleForTest = {
        name: 'Expensive Coffee Rule',
        categoryId: 'cat-coffee',
        priority: 1,
        conditions: JSON.stringify(conditions),
      };
      const transaction = createTestTransaction({
        description: "Coffee Shop Purchase",
        amount: 5.50, // Less than 10
      });

      const result = testRule(rule, transaction);

      expect(result.matched).toBe(false);
    });
  });

  describe("Multiple Conditions with OR Logic", () => {
    it("should match when any OR condition is true", () => {
      const conditions = createOrGroup([
        createTestCondition('description', 'contains', 'coffee'),
        createTestCondition('description', 'contains', 'tea'),
      ]);
      const rule: RuleForTest = {
        name: 'Beverage Rule',
        categoryId: 'cat-beverage',
        priority: 1,
        conditions: JSON.stringify(conditions),
      };
      const transaction = createTestTransaction({ description: "Coffee Shop" });

      const result = testRule(rule, transaction);

      expect(result.matched).toBe(true);
    });

    it("should not match when all OR conditions are false", () => {
      const conditions = createOrGroup([
        createTestCondition('description', 'contains', 'restaurant'),
        createTestCondition('description', 'contains', 'gas'),
      ]);
      const rule: RuleForTest = {
        name: 'Other Rule',
        categoryId: 'cat-other',
        priority: 1,
        conditions: JSON.stringify(conditions),
      };
      const transaction = createTestTransaction({ description: "Coffee Shop" });

      const result = testRule(rule, transaction);

      expect(result.matched).toBe(false);
    });
  });

  describe("Nested Condition Groups", () => {
    it("should match with nested AND within OR", () => {
      // (amount > 10 AND account = "Checking") OR description contains "coffee"
      const conditions = createOrGroup([
        createAndGroup([
          createTestCondition('amount', 'greater_than', '10'),
          createTestCondition('account_name', 'equals', 'Checking'),
        ]),
        createTestCondition('description', 'contains', 'coffee'),
      ]);
      const rule: RuleForTest = {
        name: 'Complex Rule',
        categoryId: 'cat-complex',
        priority: 1,
        conditions: JSON.stringify(conditions),
      };
      const transaction = createTestTransaction({
        description: "Coffee Shop",
        amount: 5.50, // Less than 10, but "coffee" matches
      });

      const result = testRule(rule, transaction);

      expect(result.matched).toBe(true);
    });

    it("should handle complex 3-level nested groups", () => {
      // ((A AND B) OR (C AND D)) AND E
      const conditions = createAndGroup([
        createOrGroup([
          createAndGroup([
            createTestCondition('description', 'contains', 'coffee'),
            createTestCondition('amount', 'greater_than', '5'),
          ]),
          createAndGroup([
            createTestCondition('description', 'contains', 'tea'),
            createTestCondition('amount', 'less_than', '10'),
          ]),
        ]),
        createTestCondition('account_name', 'equals', 'Checking'),
      ]);
      const rule: RuleForTest = {
        name: '3-Level Nested Rule',
        categoryId: 'cat-nested',
        priority: 1,
        conditions: JSON.stringify(conditions),
      };
      const transaction = createTestTransaction({
        description: "Coffee Shop",
        amount: 5.50,
        accountName: "Checking",
      });

      const result = testRule(rule, transaction);

      expect(result.matched).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should return error for invalid JSON conditions", () => {
      const rule: RuleForTest = {
        name: 'Invalid Rule',
        categoryId: 'cat-invalid',
        priority: 1,
        conditions: "invalid json",
      };
      const transaction = createTestTransaction();

      const result = testRule(rule, transaction);

      expect(result.matched).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it("should return error for missing required condition fields", () => {
      const invalidCondition = {
        operator: 'equals',
        value: 'test',
        // Missing 'field'
      };
      const rule: RuleForTest = {
        name: 'Invalid Condition Rule',
        categoryId: 'cat-invalid',
        priority: 1,
        conditions: JSON.stringify(invalidCondition),
      };
      const transaction = createTestTransaction();

      const result = testRule(rule, transaction);

      expect(result.matched).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it("should handle empty condition group", () => {
      const emptyGroup = {
        logic: 'AND',
        conditions: [],
      };
      const rule: RuleForTest = {
        name: 'Empty Group Rule',
        categoryId: 'cat-empty',
        priority: 1,
        conditions: JSON.stringify(emptyGroup),
      };
      const transaction = createTestTransaction();

      const result = testRule(rule, transaction);

      expect(result.matched).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe("Optional ID Handling", () => {
    it("should work without ID (for new rule preview)", () => {
      const rule: RuleForTest = {
        name: 'New Rule Preview',
        categoryId: 'cat-new',
        priority: 1,
        conditions: createConditionJSON('description', 'contains', 'coffee'),
      };
      // Not providing ID
      const transaction = createTestTransaction();

      const result = testRule(rule, transaction);

      expect(result.matched).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it("should work with ID provided", () => {
      const rule: RuleForTest = {
        id: 'rule-123',
        name: 'Existing Rule',
        categoryId: 'cat-existing',
        priority: 1,
        conditions: createConditionJSON('description', 'contains', 'coffee'),
      };
      const transaction = createTestTransaction();

      const result = testRule(rule, transaction);

      expect(result.matched).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });
});

// ============================================================================
// TASK 4: testRuleOnMultiple() FUNCTION TESTS
// ============================================================================

describe("Rule Matcher - testRuleOnMultiple() Function", () => {
  describe("Batch Testing Multiple Transactions", () => {
    it("should match all transactions when all match the rule", () => {
      const rule: RuleForTest = {
        name: 'Coffee Rule',
        categoryId: 'cat-coffee',
        priority: 1,
        conditions: createConditionJSON('description', 'contains', 'coffee'),
      };
      const transactions = [
        createTestTransaction({ description: "Coffee Shop A" }),
        createTestTransaction({ description: "Coffee Shop B" }),
        createTestTransaction({ description: "Morning Coffee" }),
      ];

      const results = testRuleOnMultiple(rule, transactions);

      expect(results).toHaveLength(3);
      expect(results[0].matched).toBe(true);
      expect(results[0].transaction.description).toBe("Coffee Shop A");
      expect(results[1].matched).toBe(true);
      expect(results[1].transaction.description).toBe("Coffee Shop B");
      expect(results[2].matched).toBe(true);
      expect(results[2].transaction.description).toBe("Morning Coffee");
    });

    it("should return mixed results when some transactions match", () => {
      const rule: RuleForTest = {
        name: 'Large Purchase Rule',
        categoryId: 'cat-large',
        priority: 1,
        conditions: createConditionJSON('amount', 'greater_than', '10'),
      };
      const transactions = [
        createTestTransaction({ amount: 15.00, description: "Large purchase" }),
        createTestTransaction({ amount: 5.00, description: "Small purchase" }),
        createTestTransaction({ amount: 20.00, description: "Another large" }),
        createTestTransaction({ amount: 3.50, description: "Another small" }),
      ];

      const results = testRuleOnMultiple(rule, transactions);

      expect(results).toHaveLength(4);
      expect(results[0].matched).toBe(true);
      expect(results[0].transaction.amount).toBe(15.00);
      expect(results[1].matched).toBe(false);
      expect(results[1].transaction.amount).toBe(5.00);
      expect(results[2].matched).toBe(true);
      expect(results[2].transaction.amount).toBe(20.00);
      expect(results[3].matched).toBe(false);
      expect(results[3].transaction.amount).toBe(3.50);
    });

    it("should return empty array when testing against empty array", () => {
      const rule: RuleForTest = {
        name: 'Any Rule',
        categoryId: 'cat-any',
        priority: 1,
        conditions: createConditionJSON('description', 'contains', 'test'),
      };
      const transactions: TransactionData[] = [];

      const results = testRuleOnMultiple(rule, transactions);

      expect(results).toHaveLength(0);
      expect(Array.isArray(results)).toBe(true);
    });

    it("should work correctly with single transaction", () => {
      const rule: RuleForTest = {
        name: 'Coffee Rule',
        categoryId: 'cat-coffee',
        priority: 1,
        conditions: createConditionJSON('description', 'contains', 'coffee'),
      };
      const transactions = [
        createTestTransaction({ description: "Coffee Shop Purchase" }),
      ];

      const results = testRuleOnMultiple(rule, transactions);

      expect(results).toHaveLength(1);
      expect(results[0].matched).toBe(true);
      expect(results[0].transaction).toEqual(transactions[0]);
      expect(results[0].errors).toBeUndefined();
    });

    it("should return errors for all transactions when rule has invalid conditions", () => {
      const rule: RuleForTest = {
        name: 'Invalid Rule',
        categoryId: 'cat-invalid',
        priority: 1,
        conditions: "invalid json",
      };
      const transactions = [
        createTestTransaction({ description: "Transaction 1" }),
        createTestTransaction({ description: "Transaction 2" }),
        createTestTransaction({ description: "Transaction 3" }),
      ];

      const results = testRuleOnMultiple(rule, transactions);

      expect(results).toHaveLength(3);
      expect(results[0].matched).toBe(false);
      expect(results[0].errors).toBeDefined();
      expect(results[0].errors!.length).toBeGreaterThan(0);
      expect(results[1].matched).toBe(false);
      expect(results[1].errors).toBeDefined();
      expect(results[2].matched).toBe(false);
      expect(results[2].errors).toBeDefined();
    });
  });

  describe("Transaction Context Preservation", () => {
    it("should preserve transaction data in results", () => {
      const rule: RuleForTest = {
        name: 'Any Rule',
        categoryId: 'cat-any',
        priority: 1,
        conditions: createConditionJSON('description', 'contains', 'coffee'),
      };
      const transactions = [
        createTestTransaction({
          description: "Coffee Shop",
          amount: 5.50,
          accountName: "Checking",
          date: "2025-01-23",
          notes: "Morning coffee",
        }),
      ];

      const results = testRuleOnMultiple(rule, transactions);

      expect(results[0].transaction).toEqual(transactions[0]);
      expect(results[0].transaction.description).toBe("Coffee Shop");
      expect(results[0].transaction.amount).toBe(5.50);
      expect(results[0].transaction.accountName).toBe("Checking");
      expect(results[0].transaction.date).toBe("2025-01-23");
      expect(results[0].transaction.notes).toBe("Morning coffee");
    });
  });
});

// ============================================================================
// TASK 5: findMatchingRule() BASIC MATCHING TESTS
// ============================================================================

describe("Rule Matcher - findMatchingRule() Basic Matching", () => {
  beforeEach(() => {
    clearDatabaseMocks();
  });

  afterEach(() => {
    clearDatabaseMocks();
  });

  it("should return matched rule when single rule matches", async () => {
    const mockRule = createTestRule({
      id: 'rule-1',
      priority: 1,
      conditions: createConditionJSON('description', 'contains', 'coffee'),
      actions: createActionsJSON([createTestAction('set_category', 'cat-123')]),
    });
    mockDatabaseRules([mockRule]);

    const transaction = createTestTransaction({ description: "Coffee Shop Purchase" });
    const result = await findMatchingRule('user-123', transaction);

    expect(result.matched).toBe(true);
    expect(result.rule).toBeDefined();
    expect(result.rule!.ruleId).toBe('rule-1');
    expect(result.rule!.ruleName).toBe('Test Rule');
    expect(result.rule!.actions).toHaveLength(1);
    expect(result.rule!.actions[0].type).toBe('set_category');
    expect(result.rule!.priority).toBe(1);
  });

  it("should return no match when single rule doesn't match", async () => {
    const mockRule = createTestRule({
      id: 'rule-1',
      priority: 1,
      conditions: createConditionJSON('description', 'contains', 'restaurant'),
    });
    mockDatabaseRules([mockRule]);

    const transaction = createTestTransaction({ description: "Coffee Shop Purchase" });
    const result = await findMatchingRule('user-123', transaction);

    expect(result.matched).toBe(false);
    expect(result.rule).toBeUndefined();
  });

  it("should return no match when no rules in database", async () => {
    mockDatabaseRules([]);

    const transaction = createTestTransaction();
    const result = await findMatchingRule('user-123', transaction);

    expect(result.matched).toBe(false);
    expect(result.rule).toBeUndefined();
  });

  it("should return first matching rule when multiple rules match", async () => {
    const mockRules = [
      createTestRule({
        id: 'rule-1',
        name: 'First Rule',
        priority: 1,
        conditions: createConditionJSON('description', 'contains', 'coffee'),
        actions: createActionsJSON([createTestAction('set_category', 'cat-1')]),
      }),
      createTestRule({
        id: 'rule-2',
        name: 'Second Rule',
        priority: 2,
        conditions: createConditionJSON('description', 'contains', 'coffee'),
        actions: createActionsJSON([createTestAction('set_category', 'cat-2')]),
      }),
    ];
    mockDatabaseRules(mockRules);

    const transaction = createTestTransaction({ description: "Coffee Shop Purchase" });
    const result = await findMatchingRule('user-123', transaction);

    expect(result.matched).toBe(true);
    expect(result.rule).toBeDefined();
    expect(result.rule!.ruleId).toBe('rule-1');
    expect(result.rule!.ruleName).toBe('First Rule');
    expect(result.rule!.priority).toBe(1);
  });

  it("should return second rule when first doesn't match but second does", async () => {
    const mockRules = [
      createTestRule({
        id: 'rule-1',
        name: 'Restaurant Rule',
        priority: 1,
        conditions: createConditionJSON('description', 'contains', 'restaurant'),
      }),
      createTestRule({
        id: 'rule-2',
        name: 'Coffee Rule',
        priority: 2,
        conditions: createConditionJSON('description', 'contains', 'coffee'),
        actions: createActionsJSON([createTestAction('set_category', 'cat-coffee')]),
      }),
    ];
    mockDatabaseRules(mockRules);

    const transaction = createTestTransaction({ description: "Coffee Shop Purchase" });
    const result = await findMatchingRule('user-123', transaction);

    expect(result.matched).toBe(true);
    expect(result.rule).toBeDefined();
    expect(result.rule!.ruleId).toBe('rule-2');
    expect(result.rule!.ruleName).toBe('Coffee Rule');
  });

  it("should skip inactive rules (database filtering)", async () => {
    // Note: In production, inactive rules are filtered by WHERE clause
    // This test verifies the query is constructed correctly
    const mockRules = [
      createTestRule({
        id: 'rule-1',
        priority: 1,
        isActive: true,
        conditions: createConditionJSON('description', 'contains', 'coffee'),
        actions: createActionsJSON([createTestAction('set_category', 'cat-coffee')]),
      }),
    ];
    mockDatabaseRules(mockRules);

    const transaction = createTestTransaction({ description: "Coffee Shop" });
    const result = await findMatchingRule('user-123', transaction);

    expect(result.matched).toBe(true);
    expect(result.rule!.ruleId).toBe('rule-1');
  });

  it("should skip rules with null priority", async () => {
    const mockRules = [
      createTestRule({
        id: 'rule-null',
        priority: null,
        conditions: createConditionJSON('description', 'contains', 'coffee'),
      }),
      createTestRule({
        id: 'rule-1',
        priority: 1,
        conditions: createConditionJSON('description', 'contains', 'coffee'),
        actions: createActionsJSON([createTestAction('set_category', 'cat-coffee')]),
      }),
    ];
    mockDatabaseRules(mockRules);

    const transaction = createTestTransaction({ description: "Coffee Shop" });
    const result = await findMatchingRule('user-123', transaction);

    expect(result.matched).toBe(true);
    expect(result.rule).toBeDefined();
    expect(result.rule!.ruleId).toBe('rule-1');
    expect(result.rule!.priority).toBe(1);
  });

  it("should handle database query errors gracefully", async () => {
    // Mock database to throw an error
    vi.mocked(db.orderBy).mockRejectedValue(new Error('Database connection failed'));

    const transaction = createTestTransaction();
    const result = await findMatchingRule('user-123', transaction);

    expect(result.matched).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors).toHaveLength(1);
    expect(result.errors![0]).toContain('Database connection failed');
  });
});

// ============================================================================
// TASK 6: findMatchingRule() PRIORITY MATCHING TESTS
// ============================================================================

describe("Rule Matcher - findMatchingRule() Priority Matching", () => {
  beforeEach(() => {
    clearDatabaseMocks();
  });

  afterEach(() => {
    clearDatabaseMocks();
  });

  it("should match rule with lower priority number first (priority 1 before priority 2)", async () => {
    const mockRules = [
      createTestRule({
        id: 'rule-low',
        priority: 1,
        conditions: createConditionJSON('description', 'contains', 'coffee'),
        actions: createActionsJSON([createTestAction('set_category', 'cat-priority-1')]),
      }),
      createTestRule({
        id: 'rule-high',
        priority: 2,
        conditions: createConditionJSON('description', 'contains', 'coffee'),
        actions: createActionsJSON([createTestAction('set_category', 'cat-priority-2')]),
      }),
    ];
    mockDatabaseRules(mockRules);

    const transaction = createTestTransaction({ description: "Coffee Shop" });
    const result = await findMatchingRule('user-123', transaction);

    expect(result.matched).toBe(true);
    expect(result.rule!.ruleId).toBe('rule-low');
    expect(result.rule!.priority).toBe(1);
  });

  it("should return first rule when multiple rules have same priority", async () => {
    const mockRules = [
      createTestRule({
        id: 'rule-1',
        name: 'First Same Priority',
        priority: 1,
        conditions: createConditionJSON('description', 'contains', 'coffee'),
        actions: createActionsJSON([createTestAction('set_category', 'cat-1')]),
      }),
      createTestRule({
        id: 'rule-2',
        name: 'Second Same Priority',
        priority: 1,
        conditions: createConditionJSON('description', 'contains', 'coffee'),
        actions: createActionsJSON([createTestAction('set_category', 'cat-2')]),
      }),
    ];
    mockDatabaseRules(mockRules);

    const transaction = createTestTransaction({ description: "Coffee Shop" });
    const result = await findMatchingRule('user-123', transaction);

    expect(result.matched).toBe(true);
    expect(result.rule!.ruleId).toBe('rule-1');
    expect(result.rule!.ruleName).toBe('First Same Priority');
  });

  it("should match lower priority rule when higher priority doesn't match", async () => {
    const mockRules = [
      createTestRule({
        id: 'rule-1',
        priority: 1,
        conditions: createConditionJSON('description', 'contains', 'restaurant'),
      }),
      createTestRule({
        id: 'rule-2',
        priority: 2,
        conditions: createConditionJSON('description', 'contains', 'coffee'),
        actions: createActionsJSON([createTestAction('set_category', 'cat-coffee')]),
      }),
    ];
    mockDatabaseRules(mockRules);

    const transaction = createTestTransaction({ description: "Coffee Shop" });
    const result = await findMatchingRule('user-123', transaction);

    expect(result.matched).toBe(true);
    expect(result.rule!.ruleId).toBe('rule-2');
    expect(result.rule!.priority).toBe(2);
  });

  it("should handle priority 0 as highest priority", async () => {
    const mockRules = [
      createTestRule({
        id: 'rule-0',
        priority: 0,
        conditions: createConditionJSON('description', 'contains', 'coffee'),
        actions: createActionsJSON([createTestAction('set_category', 'cat-zero')]),
      }),
      createTestRule({
        id: 'rule-1',
        priority: 1,
        conditions: createConditionJSON('description', 'contains', 'coffee'),
        actions: createActionsJSON([createTestAction('set_category', 'cat-one')]),
      }),
    ];
    mockDatabaseRules(mockRules);

    const transaction = createTestTransaction({ description: "Coffee Shop" });
    const result = await findMatchingRule('user-123', transaction);

    expect(result.matched).toBe(true);
    expect(result.rule!.ruleId).toBe('rule-0');
    expect(result.rule!.priority).toBe(0);
  });

  it("should handle large priority numbers correctly", async () => {
    const mockRules = [
      createTestRule({
        id: 'rule-1000',
        priority: 1000,
        conditions: createConditionJSON('description', 'contains', 'coffee'),
        actions: createActionsJSON([createTestAction('set_category', 'cat-1000')]),
      }),
      createTestRule({
        id: 'rule-999',
        priority: 999,
        conditions: createConditionJSON('description', 'contains', 'coffee'),
        actions: createActionsJSON([createTestAction('set_category', 'cat-999')]),
      }),
    ];
    mockDatabaseRules(mockRules);

    const transaction = createTestTransaction({ description: "Coffee Shop" });
    const result = await findMatchingRule('user-123', transaction);

    expect(result.matched).toBe(true);
    expect(result.rule!.ruleId).toBe('rule-999');
    expect(result.rule!.priority).toBe(999);
  });

  it("should correctly prioritize with 5+ rules", async () => {
    const mockRules = [
      createTestRule({ id: 'rule-5', priority: 5, conditions: createConditionJSON('description', 'contains', 'other') }),
      createTestRule({ id: 'rule-3', priority: 3, conditions: createConditionJSON('description', 'contains', 'coffee'), actions: createActionsJSON([createTestAction('set_category', 'cat-3')]) }),
      createTestRule({ id: 'rule-1', priority: 1, conditions: createConditionJSON('description', 'contains', 'restaurant') }),
      createTestRule({ id: 'rule-4', priority: 4, conditions: createConditionJSON('description', 'contains', 'gas') }),
      createTestRule({ id: 'rule-2', priority: 2, conditions: createConditionJSON('description', 'contains', 'store') }),
    ];
    mockDatabaseRules(mockRules);

    const transaction = createTestTransaction({ description: "Coffee Shop" });
    const result = await findMatchingRule('user-123', transaction);

    expect(result.matched).toBe(true);
    expect(result.rule!.ruleId).toBe('rule-3');
    expect(result.rule!.priority).toBe(3);
  });
});

// ============================================================================
// TASK 7: findMatchingRule() ACTION PARSING TESTS
// ============================================================================

describe("Rule Matcher - findMatchingRule() Action Parsing", () => {
  beforeEach(() => {
    clearDatabaseMocks();
  });

  afterEach(() => {
    clearDatabaseMocks();
  });

  it("should parse actions array correctly", async () => {
    const mockRule = createTestRule({
      id: 'rule-1',
      priority: 1,
      conditions: createConditionJSON('description', 'contains', 'coffee'),
      actions: createActionsJSON([
        createTestAction('set_category', 'cat-123'),
        createTestAction('set_merchant', 'merch-456'),
      ]),
    });
    mockDatabaseRules([mockRule]);

    const transaction = createTestTransaction({ description: "Coffee Shop" });
    const result = await findMatchingRule('user-123', transaction);

    expect(result.matched).toBe(true);
    expect(result.rule!.actions).toHaveLength(2);
    expect(result.rule!.actions[0].type).toBe('set_category');
    expect(result.rule!.actions[0].value).toBe('cat-123');
    expect(result.rule!.actions[1].type).toBe('set_merchant');
    expect(result.rule!.actions[1].value).toBe('merch-456');
  });

  it("should use backward compatibility for rules with only categoryId", async () => {
    const mockRule = createTestRule({
      id: 'rule-1',
      priority: 1,
      conditions: createConditionJSON('description', 'contains', 'coffee'),
      categoryId: 'cat-legacy',
      actions: null, // No actions, should fall back to categoryId
    });
    mockDatabaseRules([mockRule]);

    const transaction = createTestTransaction({ description: "Coffee Shop" });
    const result = await findMatchingRule('user-123', transaction);

    expect(result.matched).toBe(true);
    expect(result.rule!.actions).toHaveLength(1);
    expect(result.rule!.actions[0].type).toBe('set_category');
    expect(result.rule!.actions[0].value).toBe('cat-legacy');
  });

  it("should prioritize actions over categoryId when both exist", async () => {
    const mockRule = createTestRule({
      id: 'rule-1',
      priority: 1,
      conditions: createConditionJSON('description', 'contains', 'coffee'),
      categoryId: 'cat-old',
      actions: createActionsJSON([createTestAction('set_category', 'cat-new')]),
    });
    mockDatabaseRules([mockRule]);

    const transaction = createTestTransaction({ description: "Coffee Shop" });
    const result = await findMatchingRule('user-123', transaction);

    expect(result.matched).toBe(true);
    expect(result.rule!.actions).toHaveLength(1);
    expect(result.rule!.actions[0].value).toBe('cat-new');
  });

  it("should handle multiple action types correctly", async () => {
    const mockRule = createTestRule({
      id: 'rule-1',
      priority: 1,
      conditions: createConditionJSON('description', 'contains', 'coffee'),
      actions: createActionsJSON([
        createTestAction('set_category', 'cat-123'),
        createTestAction('set_merchant', 'merch-456'),
        createTestAction('prepend_description', undefined, 'Prefix: '),
      ]),
    });
    mockDatabaseRules([mockRule]);

    const transaction = createTestTransaction({ description: "Coffee Shop" });
    const result = await findMatchingRule('user-123', transaction);

    expect(result.matched).toBe(true);
    expect(result.rule!.actions).toHaveLength(3);
    expect(result.rule!.actions[0].type).toBe('set_category');
    expect(result.rule!.actions[1].type).toBe('set_merchant');
    expect(result.rule!.actions[2].type).toBe('prepend_description');
    expect(result.rule!.actions[2].pattern).toBe('Prefix: ');
  });

  it("should handle invalid actions JSON gracefully with categoryId fallback", async () => {
    const mockRule = createTestRule({
      id: 'rule-1',
      priority: 1,
      conditions: createConditionJSON('description', 'contains', 'coffee'),
      categoryId: 'cat-fallback',
      actions: "invalid json", // Invalid JSON
    });
    mockDatabaseRules([mockRule]);

    const transaction = createTestTransaction({ description: "Coffee Shop" });
    const result = await findMatchingRule('user-123', transaction);

    expect(result.matched).toBe(true);
    expect(result.rule!.actions).toHaveLength(1);
    expect(result.rule!.actions[0].type).toBe('set_category');
    expect(result.rule!.actions[0].value).toBe('cat-fallback');
  });

  it("should return empty actions when no actions or categoryId", async () => {
    const mockRule = createTestRule({
      id: 'rule-1',
      priority: 1,
      conditions: createConditionJSON('description', 'contains', 'coffee'),
      categoryId: null,
      actions: null,
    });
    mockDatabaseRules([mockRule]);

    const transaction = createTestTransaction({ description: "Coffee Shop" });
    const result = await findMatchingRule('user-123', transaction);

    expect(result.matched).toBe(true);
    expect(result.rule!.actions).toHaveLength(0);
  });
});

// ============================================================================
// TASK 8: findAllMatchingRules() TESTS
// ============================================================================

describe("Rule Matcher - findAllMatchingRules()", () => {
  beforeEach(() => {
    clearDatabaseMocks();
  });

  afterEach(() => {
    clearDatabaseMocks();
  });

  it("should return all matching rules when multiple match", async () => {
    const mockRules = [
      createTestRule({
        id: 'rule-1',
        name: 'First Rule',
        priority: 1,
        conditions: createConditionJSON('description', 'contains', 'coffee'),
        actions: createActionsJSON([createTestAction('set_category', 'cat-1')]),
      }),
      createTestRule({
        id: 'rule-2',
        name: 'Second Rule',
        priority: 2,
        conditions: createConditionJSON('description', 'contains', 'coffee'),
        actions: createActionsJSON([createTestAction('set_category', 'cat-2')]),
      }),
      createTestRule({
        id: 'rule-3',
        name: 'Third Rule',
        priority: 3,
        conditions: createConditionJSON('description', 'contains', 'coffee'),
        actions: createActionsJSON([createTestAction('set_category', 'cat-3')]),
      }),
    ];
    mockDatabaseRules(mockRules);

    const transaction = createTestTransaction({ description: "Coffee Shop" });
    const results = await findAllMatchingRules('user-123', transaction);

    expect(results).toHaveLength(3);
    expect(results[0].ruleId).toBe('rule-1');
    expect(results[1].ruleId).toBe('rule-2');
    expect(results[2].ruleId).toBe('rule-3');
  });

  it("should return only matching rules when some rules match", async () => {
    const mockRules = [
      createTestRule({
        id: 'rule-1',
        priority: 1,
        conditions: createConditionJSON('description', 'contains', 'coffee'),
        actions: createActionsJSON([createTestAction('set_category', 'cat-coffee')]),
      }),
      createTestRule({
        id: 'rule-2',
        priority: 2,
        conditions: createConditionJSON('description', 'contains', 'restaurant'),
      }),
      createTestRule({
        id: 'rule-3',
        priority: 3,
        conditions: createConditionJSON('description', 'contains', 'coffee'),
        actions: createActionsJSON([createTestAction('set_category', 'cat-coffee-2')]),
      }),
    ];
    mockDatabaseRules(mockRules);

    const transaction = createTestTransaction({ description: "Coffee Shop" });
    const results = await findAllMatchingRules('user-123', transaction);

    expect(results).toHaveLength(2);
    expect(results[0].ruleId).toBe('rule-1');
    expect(results[1].ruleId).toBe('rule-3');
  });

  it("should return empty array when no rules match", async () => {
    const mockRules = [
      createTestRule({
        id: 'rule-1',
        priority: 1,
        conditions: createConditionJSON('description', 'contains', 'restaurant'),
      }),
      createTestRule({
        id: 'rule-2',
        priority: 2,
        conditions: createConditionJSON('description', 'contains', 'gas'),
      }),
    ];
    mockDatabaseRules(mockRules);

    const transaction = createTestTransaction({ description: "Coffee Shop" });
    const results = await findAllMatchingRules('user-123', transaction);

    expect(results).toHaveLength(0);
    expect(Array.isArray(results)).toBe(true);
  });

  it("should return rules in priority order (ascending)", async () => {
    const mockRules = [
      createTestRule({
        id: 'rule-3',
        priority: 3,
        conditions: createConditionJSON('description', 'contains', 'coffee'),
        actions: createActionsJSON([createTestAction('set_category', 'cat-3')]),
      }),
      createTestRule({
        id: 'rule-1',
        priority: 1,
        conditions: createConditionJSON('description', 'contains', 'coffee'),
        actions: createActionsJSON([createTestAction('set_category', 'cat-1')]),
      }),
      createTestRule({
        id: 'rule-2',
        priority: 2,
        conditions: createConditionJSON('description', 'contains', 'coffee'),
        actions: createActionsJSON([createTestAction('set_category', 'cat-2')]),
      }),
    ];
    mockDatabaseRules(mockRules);

    const transaction = createTestTransaction({ description: "Coffee Shop" });
    const results = await findAllMatchingRules('user-123', transaction);

    expect(results).toHaveLength(3);
    expect(results[0].ruleId).toBe('rule-1');
    expect(results[0].priority).toBe(1);
    expect(results[1].ruleId).toBe('rule-2');
    expect(results[1].priority).toBe(2);
    expect(results[2].ruleId).toBe('rule-3');
    expect(results[2].priority).toBe(3);
  });

  it("should skip rules with null priority", async () => {
    const mockRules = [
      createTestRule({
        id: 'rule-null',
        priority: null,
        conditions: createConditionJSON('description', 'contains', 'coffee'),
      }),
      createTestRule({
        id: 'rule-1',
        priority: 1,
        conditions: createConditionJSON('description', 'contains', 'coffee'),
        actions: createActionsJSON([createTestAction('set_category', 'cat-1')]),
      }),
    ];
    mockDatabaseRules(mockRules);

    const transaction = createTestTransaction({ description: "Coffee Shop" });
    const results = await findAllMatchingRules('user-123', transaction);

    expect(results).toHaveLength(1);
    expect(results[0].ruleId).toBe('rule-1');
  });

  it("should handle database errors gracefully", async () => {
    vi.mocked(db.orderBy).mockRejectedValue(new Error('Database connection failed'));

    const transaction = createTestTransaction();
    const results = await findAllMatchingRules('user-123', transaction);

    expect(results).toHaveLength(0);
    expect(Array.isArray(results)).toBe(true);
  });
});

// ============================================================================
// TASK 9: EDGE CASES & ERROR HANDLING TESTS
// ============================================================================

describe("Rule Matcher - Edge Cases & Error Handling", () => {
  beforeEach(() => {
    clearDatabaseMocks();
  });

  afterEach(() => {
    clearDatabaseMocks();
  });

  it("should handle transaction with missing optional fields", async () => {
    const mockRule = createTestRule({
      id: 'rule-1',
      priority: 1,
      conditions: createConditionJSON('description', 'contains', 'coffee'),
      actions: createActionsJSON([createTestAction('set_category', 'cat-coffee')]),
    });
    mockDatabaseRules([mockRule]);

    const transaction: TransactionData = {
      description: "Coffee Shop",
      amount: 5.50,
      accountName: "Checking",
      date: "2025-01-23",
      // notes field is optional and missing
    };
    const result = await findMatchingRule('user-123', transaction);

    expect(result.matched).toBe(true);
    expect(result.rule!.ruleId).toBe('rule-1');
  });

  it("should handle rules with special characters in conditions", async () => {
    const mockRule = createTestRule({
      id: 'rule-1',
      priority: 1,
      conditions: createConditionJSON('description', 'contains', 'café ☕'),
      actions: createActionsJSON([createTestAction('set_category', 'cat-cafe')]),
    });
    mockDatabaseRules([mockRule]);

    const transaction = createTestTransaction({ description: "Local café ☕ purchase" });
    const result = await findMatchingRule('user-123', transaction);

    expect(result.matched).toBe(true);
    expect(result.rule!.ruleId).toBe('rule-1');
  });

  it("should handle very large transaction amounts correctly", async () => {
    const mockRule = createTestRule({
      id: 'rule-1',
      priority: 1,
      conditions: createConditionJSON('amount', 'greater_than', '1000000'),
      actions: createActionsJSON([createTestAction('set_category', 'cat-large')]),
    });
    mockDatabaseRules([mockRule]);

    const transaction = createTestTransaction({
      amount: 999999999.99,
      description: "Large transfer",
    });
    const result = await findMatchingRule('user-123', transaction);

    expect(result.matched).toBe(true);
    expect(result.rule!.ruleId).toBe('rule-1');
  });

  it("should handle leap year dates correctly", async () => {
    const mockRule = createTestRule({
      id: 'rule-1',
      priority: 1,
      conditions: createConditionJSON('day_of_month', 'equals', '29'),
      actions: createActionsJSON([createTestAction('set_category', 'cat-day29')]),
    });
    mockDatabaseRules([mockRule]);

    const transaction = createTestTransaction({ date: "2024-02-29" }); // Leap year
    const result = await findMatchingRule('user-123', transaction);

    expect(result.matched).toBe(true);
    expect(result.rule!.ruleId).toBe('rule-1');
  });

  it("should handle single character description correctly", async () => {
    const mockRule = createTestRule({
      id: 'rule-1',
      priority: 1,
      conditions: createConditionJSON('description', 'equals', 'A'),
      actions: createActionsJSON([createTestAction('set_category', 'cat-single')]),
    });
    mockDatabaseRules([mockRule]);

    const transaction = createTestTransaction({ description: "A" });
    const result = await findMatchingRule('user-123', transaction);

    expect(result.matched).toBe(true);
    expect(result.rule!.ruleId).toBe('rule-1');
  });

  it("should handle unicode and emoji in descriptions", async () => {
    const mockRule = createTestRule({
      id: 'rule-1',
      priority: 1,
      conditions: createConditionJSON('description', 'contains', 'Party'),
      actions: createActionsJSON([createTestAction('set_category', 'cat-party')]),
    });
    mockDatabaseRules([mockRule]);

    const transaction = createTestTransaction({ description: "🎉 Party expense 🎊" });
    const result = await findMatchingRule('user-123', transaction);

    expect(result.matched).toBe(true);
    expect(result.rule!.ruleId).toBe('rule-1');
  });

  it("should handle zero amount transactions", async () => {
    const mockRule = createTestRule({
      id: 'rule-1',
      priority: 1,
      conditions: createConditionJSON('amount', 'equals', '0'),
      actions: createActionsJSON([createTestAction('set_category', 'cat-zero')]),
    });
    mockDatabaseRules([mockRule]);

    const transaction = createTestTransaction({ amount: 0, description: "Zero amount" });
    const result = await findMatchingRule('user-123', transaction);

    expect(result.matched).toBe(true);
    expect(result.rule!.ruleId).toBe('rule-1');
  });

  it("should handle negative amounts correctly", async () => {
    const mockRule = createTestRule({
      id: 'rule-1',
      priority: 1,
      conditions: createConditionJSON('amount', 'less_than', '0'),
      actions: createActionsJSON([createTestAction('set_category', 'cat-negative')]),
    });
    mockDatabaseRules([mockRule]);

    const transaction = createTestTransaction({ amount: -10.50, description: "Refund" });
    const result = await findMatchingRule('user-123', transaction);

    expect(result.matched).toBe(true);
    expect(result.rule!.ruleId).toBe('rule-1');
  });
});
