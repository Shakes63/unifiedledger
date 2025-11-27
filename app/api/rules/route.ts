import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { categorizationRules, budgetCategories, merchants } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { validateConditionGroup } from '@/lib/rules/condition-evaluator';
import { validateActions } from '@/lib/rules/actions-executor';
import type { RuleAction } from '@/lib/rules/types';
export const dynamic = 'force-dynamic';

/**
 * Migrate old sales tax actions to new format
 * Old: no config or config without value
 * New: config: { value: true }
 */
function migrateSalesTaxActions(actions: RuleAction[]): RuleAction[] {
  return actions.map(action => {
    if (action.type === 'set_sales_tax' && typeof action.config?.value !== 'boolean') {
      return {
        ...action,
        config: { value: true }
      };
    }
    return action;
  });
}

/**
 * GET /api/rules - List all rules for the user or get a single rule by ID
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const url = new URL(request.url);
    const ruleId = url.searchParams.get('id');

    // Get single rule by ID
    if (ruleId) {
      const rule = await db
        .select()
        .from(categorizationRules)
        .where(
          and(
            eq(categorizationRules.id, ruleId),
            eq(categorizationRules.userId, userId),
            eq(categorizationRules.householdId, householdId)
          )
        )
        .limit(1);

      if (rule.length === 0) {
        return Response.json(
          { error: 'Rule not found' },
          { status: 404 }
        );
      }

      // Parse actions from JSON string to array
      const ruleData = rule[0];
      try {
        let actions: RuleAction[] = [];

        if (ruleData.actions) {
          actions = typeof ruleData.actions === 'string'
            ? JSON.parse(ruleData.actions)
            : ruleData.actions;
        } else if (ruleData.categoryId) {
          // Backward compatibility: create action from categoryId if no actions exist
          actions = [{
            type: 'set_category',
            value: ruleData.categoryId,
          }];
        }

        // Migrate old sales tax actions to new format
        actions = migrateSalesTaxActions(actions);

        const parsedRule = {
          ...ruleData,
          conditions: typeof ruleData.conditions === 'string'
            ? JSON.parse(ruleData.conditions)
            : ruleData.conditions,
          actions,
        };

        return Response.json(parsedRule);
      } catch (parseError) {
        console.error('Error parsing rule data:', parseError);
        return Response.json(
          { error: 'Failed to parse rule data' },
          { status: 500 }
        );
      }
    }

    // List all rules
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const activeOnly = url.searchParams.get('active') === 'true';

    let query = db
      .select()
      .from(categorizationRules)
      .where(
        and(
          eq(categorizationRules.userId, userId),
          eq(categorizationRules.householdId, householdId)
        )
      );

    if (activeOnly) {
      query = db
        .select()
        .from(categorizationRules)
        .where(
          and(
            eq(categorizationRules.userId, userId),
            eq(categorizationRules.householdId, householdId),
            eq(categorizationRules.isActive, true)
          )
        );
    }

    const rules = await query
      .orderBy(desc(categorizationRules.priority))
      .limit(limit);

    // Parse actions for all rules
    try {
      const parsedRules = rules.map(rule => {
        let actions: RuleAction[] = [];

        if (rule.actions) {
          actions = typeof rule.actions === 'string'
            ? JSON.parse(rule.actions)
            : rule.actions;
        } else if (rule.categoryId) {
          // Backward compatibility: create action from categoryId if no actions exist
          actions = [{
            type: 'set_category',
            value: rule.categoryId,
          }];
        }

        // Migrate old sales tax actions to new format
        actions = migrateSalesTaxActions(actions);

        return {
          ...rule,
          actions,
        };
      });

      return Response.json(parsedRules);
    } catch (parseError) {
      console.error('Error parsing rules data:', parseError);
      // Return rules without parsing if there's an error
      return Response.json(rules);
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Rules fetch error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/rules - Create a new rule
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const { householdId } = await getAndVerifyHousehold(request, userId, body);

    const {
      name,
      categoryId,
      actions,
      description = '',
      priority = 100,
      conditions,
    } = body;

    // Validate required fields
    if (!name || (!categoryId && !actions) || !conditions) {
      return Response.json(
        { error: 'Missing required fields: name, actions (or categoryId), conditions' },
        { status: 400 }
      );
    }

    // Parse actions array (or create from categoryId for backward compatibility)
    let actionsArray: RuleAction[] = [];
    if (actions) {
      actionsArray = typeof actions === 'string' ? JSON.parse(actions) : actions;

      // Validate actions
      const actionErrors = validateActions(actionsArray);
      if (actionErrors.length > 0) {
        return Response.json(
          { error: 'Invalid actions', details: actionErrors },
          { status: 400 }
        );
      }

      // Validate referenced entities (categories, merchants)
      for (const action of actionsArray) {
        if (action.type === 'set_category' && action.value) {
          const category = await db
            .select()
            .from(budgetCategories)
            .where(
              and(
                eq(budgetCategories.id, action.value),
                eq(budgetCategories.userId, userId),
                eq(budgetCategories.householdId, householdId)
              )
            )
            .limit(1);

          if (category.length === 0) {
            return Response.json(
              { error: `Category ${action.value} not found or does not belong to this household` },
              { status: 404 }
            );
          }
        }

        if (action.type === 'set_merchant' && action.value) {
          const merchant = await db
            .select()
            .from(merchants)
            .where(
              and(
                eq(merchants.id, action.value),
                eq(merchants.userId, userId),
                eq(merchants.householdId, householdId)
              )
            )
            .limit(1);

          if (merchant.length === 0) {
            return Response.json(
              { error: `Merchant ${action.value} not found or does not belong to this household` },
              { status: 404 }
            );
          }
        }
      }
    } else if (categoryId) {
      // Backward compatibility: create actions array from categoryId
      const category = await db
        .select()
        .from(budgetCategories)
        .where(
          and(
            eq(budgetCategories.id, categoryId),
            eq(budgetCategories.userId, userId),
            eq(budgetCategories.householdId, householdId)
          )
        )
        .limit(1);

      if (category.length === 0) {
        return Response.json(
          { error: 'Category not found' },
          { status: 404 }
        );
      }

      actionsArray = [
        {
          type: 'set_category',
          value: categoryId,
        },
      ];
    }

    // Validate conditions
    try {
      const conditionsObj = typeof conditions === 'string'
        ? JSON.parse(conditions)
        : conditions;

      const validationErrors = validateConditionGroup(conditionsObj);
      if (validationErrors.length > 0) {
        return Response.json(
          { error: 'Invalid conditions', details: validationErrors },
          { status: 400 }
        );
      }
    } catch (_err) {
      return Response.json(
        { error: 'Conditions must be valid JSON' },
        { status: 400 }
      );
    }

    // Create rule
    const ruleId = nanoid();
    const conditionsStr = typeof conditions === 'string'
      ? conditions
      : JSON.stringify(conditions);
    const actionsStr = JSON.stringify(actionsArray);

    // Extract first set_category action for categoryId field (backward compatibility)
    const setCategoryAction = actionsArray.find(a => a.type === 'set_category');

    await db.insert(categorizationRules).values({
      id: ruleId,
      userId,
      householdId,
      name,
      categoryId: setCategoryAction?.value || categoryId || null,
      actions: actionsStr,
      description: description || null,
      priority: parseInt(String(priority), 10),
      isActive: true,
      conditions: conditionsStr,
      matchCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return Response.json(
      { id: ruleId, message: 'Rule created successfully' },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Rule creation error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/rules - Update a rule
 */
export async function PUT(request: Request) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const { householdId } = await getAndVerifyHousehold(request, userId, body);

    const {
      id,
      name,
      categoryId,
      actions,
      description,
      priority,
      conditions,
      isActive,
    } = body;

    if (!id) {
      return Response.json(
        { error: 'Rule ID is required' },
        { status: 400 }
      );
    }

    // Verify rule belongs to user and household
    const existingRule = await db
      .select()
      .from(categorizationRules)
      .where(
        and(
          eq(categorizationRules.id, id),
          eq(categorizationRules.userId, userId),
          eq(categorizationRules.householdId, householdId)
        )
      )
      .limit(1);

    if (existingRule.length === 0) {
      return Response.json(
        { error: 'Rule not found' },
        { status: 404 }
      );
    }

    // Validate and parse actions if provided
    let actionsArray: RuleAction[] | undefined;
    if (actions) {
      const parsedActions: RuleAction[] = typeof actions === 'string' ? JSON.parse(actions) : actions;
      actionsArray = parsedActions;

      // Validate actions
      const actionErrors = validateActions(parsedActions);
      if (actionErrors.length > 0) {
        return Response.json(
          { error: 'Invalid actions', details: actionErrors },
          { status: 400 }
        );
      }

      // Validate referenced entities (categories, merchants)
      for (const action of parsedActions) {
        if (action.type === 'set_category' && action.value) {
          const category = await db
            .select()
            .from(budgetCategories)
            .where(
              and(
                eq(budgetCategories.id, action.value),
                eq(budgetCategories.userId, userId),
                eq(budgetCategories.householdId, householdId)
              )
            )
            .limit(1);

          if (category.length === 0) {
            return Response.json(
              { error: `Category ${action.value} not found or does not belong to this household` },
              { status: 404 }
            );
          }
        }

        if (action.type === 'set_merchant' && action.value) {
          const merchant = await db
            .select()
            .from(merchants)
            .where(
              and(
                eq(merchants.id, action.value),
                eq(merchants.userId, userId),
                eq(merchants.householdId, householdId)
              )
            )
            .limit(1);

          if (merchant.length === 0) {
            return Response.json(
              { error: `Merchant ${action.value} not found or does not belong to this household` },
              { status: 404 }
            );
          }
        }
      }
    } else if (categoryId) {
      // Backward compatibility: if only categoryId is provided, validate it
      const category = await db
        .select()
        .from(budgetCategories)
        .where(
          and(
            eq(budgetCategories.id, categoryId),
            eq(budgetCategories.userId, userId),
            eq(budgetCategories.householdId, householdId)
          )
        )
        .limit(1);

      if (category.length === 0) {
        return Response.json(
          { error: 'Category not found' },
          { status: 404 }
        );
      }

      // Create actions array from categoryId
      actionsArray = [
        {
          type: 'set_category',
          value: categoryId,
        },
      ];
    }

    // Validate conditions if provided
    if (conditions) {
      try {
        const conditionsObj = typeof conditions === 'string'
          ? JSON.parse(conditions)
          : conditions;

        const validationErrors = validateConditionGroup(conditionsObj);
        if (validationErrors.length > 0) {
          return Response.json(
            { error: 'Invalid conditions', details: validationErrors },
            { status: 400 }
          );
        }
      } catch (_err) {
        return Response.json(
          { error: 'Conditions must be valid JSON' },
          { status: 400 }
        );
      }
    }

    // Update rule
    const updates: any = {
      updatedAt: new Date().toISOString(),
    };

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description || null;
    if (priority !== undefined) updates.priority = parseInt(String(priority), 10);
    if (conditions !== undefined) {
      updates.conditions = typeof conditions === 'string'
        ? conditions
        : JSON.stringify(conditions);
    }
    if (isActive !== undefined) updates.isActive = isActive;

    // Update actions array (and categoryId for backward compatibility)
    if (actionsArray !== undefined) {
      updates.actions = JSON.stringify(actionsArray);

      // Extract first set_category action for categoryId field
      const setCategoryAction = actionsArray.find(a => a.type === 'set_category');
      updates.categoryId = setCategoryAction?.value || null;
    } else if (categoryId !== undefined) {
      // Backward compatibility: if only categoryId is provided without actions
      updates.categoryId = categoryId;
    }

    await db
      .update(categorizationRules)
      .set(updates)
      .where(eq(categorizationRules.id, id));

    return Response.json({
      message: 'Rule updated successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Rule update error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/rules - Delete a rule
 */
export async function DELETE(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const url = new URL(request.url);
    const ruleId = url.searchParams.get('id');

    if (!ruleId) {
      return Response.json(
        { error: 'Rule ID is required' },
        { status: 400 }
      );
    }

    // Verify rule belongs to user and household
    const rule = await db
      .select()
      .from(categorizationRules)
      .where(
        and(
          eq(categorizationRules.id, ruleId),
          eq(categorizationRules.userId, userId),
          eq(categorizationRules.householdId, householdId)
        )
      )
      .limit(1);

    if (rule.length === 0) {
      return Response.json(
        { error: 'Rule not found' },
        { status: 404 }
      );
    }

    // Delete rule
    await db
      .delete(categorizationRules)
      .where(eq(categorizationRules.id, ruleId));

    return Response.json({
      message: 'Rule deleted successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Rule deletion error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
