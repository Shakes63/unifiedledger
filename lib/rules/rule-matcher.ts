/**
 * Rule Matching Engine
 * Matches transactions against categorization rules and returns matching rule
 */

import { db } from '@/lib/db';
import { categorizationRules } from '@/lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import {
  evaluateConditions,
  validateConditionGroup,
  ConditionGroup,
  Condition,
  TransactionData,
} from './condition-evaluator';
import type { RuleMatch, RuleEvaluationResult, RuleAction } from './types';

/**
 * Parse actions from database format
 * Handles backward compatibility for rules with only categoryId
 */
function parseRuleActions(rule: {
  actions?: string | null;
  categoryId?: string | null;
}): RuleAction[] {
  // First, try to parse actions array
  if (rule.actions) {
    try {
      const actions = JSON.parse(rule.actions);
      if (Array.isArray(actions) && actions.length > 0) {
        return actions;
      }
    } catch (error) {
      console.error('Failed to parse rule actions:', error);
    }
  }

  // Backward compatibility: if no actions but has categoryId, create set_category action
  if (rule.categoryId) {
    return [
      {
        type: 'set_category',
        value: rule.categoryId,
      },
    ];
  }

  // No actions defined
  return [];
}

/**
 * Evaluate a single rule against transaction data
 */
function evaluateRule(
  rule: {
    id: string;
    name: string;
    categoryId: string;
    priority: number;
    conditions: string;
  },
  transaction: TransactionData
): { matched: boolean; errors?: string[] } {
  try {
    // Parse conditions from JSON
    const conditions = JSON.parse(rule.conditions) as ConditionGroup | Condition;

    // Validate conditions first
    const validationErrors = validateConditionGroup(conditions);
    if (validationErrors.length > 0) {
      return {
        matched: false,
        errors: validationErrors,
      };
    }

    // Evaluate conditions against transaction
    const matched = evaluateConditions(conditions, transaction);

    return { matched };
  } catch (error) {
    return {
      matched: false,
      errors: [error instanceof Error ? error.message : 'Failed to evaluate rule'],
    };
  }
}

/**
 * Find the highest priority matching rule for a transaction
 * Returns the first matching rule (sorted by priority)
 */
export async function findMatchingRule(
  userId: string,
  transaction: TransactionData
): Promise<RuleEvaluationResult> {
  try {
    // Get all active rules for this user, sorted by priority (lower = higher priority)
    const rules = await db
      .select()
      .from(categorizationRules)
      .where(
        and(
          eq(categorizationRules.userId, userId),
          eq(categorizationRules.isActive, true)
        )
      )
      .orderBy(asc(categorizationRules.priority));

    // Evaluate each rule in order (filter out rules with null priority)
    for (const rule of rules) {
      if (rule.priority === null) continue;

      const result = evaluateRule(rule as { id: string; name: string; categoryId: string; priority: number; conditions: string }, transaction);

      if (result.matched) {
        // Parse actions from rule (with backward compatibility)
        const actions = parseRuleActions({
          actions: rule.actions,
          categoryId: rule.categoryId,
        });

        return {
          matched: true,
          rule: {
            ruleId: rule.id,
            ruleName: rule.name,
            actions,
            priority: rule.priority,
          },
        };
      }

      // If rule has errors, continue to next rule but collect errors
      if (result.errors) {
        console.warn(`Rule ${rule.id} has errors:`, result.errors);
      }
    }

    // No matching rules found
    return { matched: false };
  } catch (error) {
    return {
      matched: false,
      errors: [error instanceof Error ? error.message : 'Failed to evaluate rules'],
    };
  }
}

/**
 * Find all matching rules for a transaction (useful for debugging/testing)
 */
export async function findAllMatchingRules(
  userId: string,
  transaction: TransactionData
): Promise<RuleMatch[]> {
  try {
    const rules = await db
      .select()
      .from(categorizationRules)
      .where(
        and(
          eq(categorizationRules.userId, userId),
          eq(categorizationRules.isActive, true)
        )
      )
      .orderBy(asc(categorizationRules.priority));

    const matches: RuleMatch[] = [];

    for (const rule of rules) {
      if (rule.priority === null) continue;

      const result = evaluateRule(rule as { id: string; name: string; categoryId: string; priority: number; conditions: string }, transaction);

      if (result.matched) {
        // Parse actions from rule (with backward compatibility)
        const actions = parseRuleActions({
          actions: rule.actions,
          categoryId: rule.categoryId,
        });

        matches.push({
          ruleId: rule.id,
          ruleName: rule.name,
          actions,
          priority: rule.priority,
        });
      }
    }

    return matches;
  } catch (error) {
    console.error('Error finding matching rules:', error);
    return [];
  }
}

/**
 * Test a rule against a transaction (for UI preview)
 */
export function testRule(
  rule: {
    id?: string;
    name: string;
    categoryId: string;
    priority: number;
    conditions: string;
  },
  transaction: TransactionData
): { matched: boolean; errors?: string[] } {
  return evaluateRule(
    {
      id: rule.id || 'test',
      name: rule.name,
      categoryId: rule.categoryId,
      priority: rule.priority,
      conditions: rule.conditions,
    },
    transaction
  );
}

/**
 * Test a rule against multiple sample transactions
 */
export function testRuleOnMultiple(
  rule: {
    id?: string;
    name: string;
    categoryId: string;
    priority: number;
    conditions: string;
  },
  transactions: TransactionData[]
): { transaction: TransactionData; matched: boolean; errors?: string[] }[] {
  return transactions.map(transaction => ({
    transaction,
    ...testRule(rule, transaction),
  }));
}
