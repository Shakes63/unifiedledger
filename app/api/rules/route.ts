import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { categorizationRules, budgetCategories } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { validateConditionGroup } from '@/lib/rules/condition-evaluator';
export const dynamic = 'force-dynamic';

/**
 * GET /api/rules - List all rules for the user
 */
export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const activeOnly = url.searchParams.get('active') === 'true';

    let query = db
      .select()
      .from(categorizationRules)
      .where(eq(categorizationRules.userId, userId));

    if (activeOnly) {
      query = db
        .select()
        .from(categorizationRules)
        .where(
          and(
            eq(categorizationRules.userId, userId),
            eq(categorizationRules.isActive, true)
          )
        );
    }

    const rules = await query
      .orderBy(desc(categorizationRules.priority))
      .limit(limit);

    return Response.json(rules);
  } catch (error) {
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
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      name,
      categoryId,
      description = '',
      priority = 100,
      conditions,
    } = body;

    // Validate required fields
    if (!name || !categoryId || !conditions) {
      return Response.json(
        { error: 'Missing required fields: name, categoryId, conditions' },
        { status: 400 }
      );
    }

    // Validate category exists and belongs to user
    const category = await db
      .select()
      .from(budgetCategories)
      .where(
        and(
          eq(budgetCategories.id, categoryId),
          eq(budgetCategories.userId, userId)
        )
      )
      .limit(1);

    if (category.length === 0) {
      return Response.json(
        { error: 'Category not found' },
        { status: 404 }
      );
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
    } catch (err) {
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

    await db.insert(categorizationRules).values({
      id: ruleId,
      userId,
      name,
      categoryId,
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
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      id,
      name,
      categoryId,
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

    // Verify rule belongs to user
    const existingRule = await db
      .select()
      .from(categorizationRules)
      .where(
        and(
          eq(categorizationRules.id, id),
          eq(categorizationRules.userId, userId)
        )
      )
      .limit(1);

    if (existingRule.length === 0) {
      return Response.json(
        { error: 'Rule not found' },
        { status: 404 }
      );
    }

    // Validate category if provided
    if (categoryId) {
      const category = await db
        .select()
        .from(budgetCategories)
        .where(
          and(
            eq(budgetCategories.id, categoryId),
            eq(budgetCategories.userId, userId)
          )
        )
        .limit(1);

      if (category.length === 0) {
        return Response.json(
          { error: 'Category not found' },
          { status: 404 }
        );
      }
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
      } catch (err) {
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
    if (categoryId !== undefined) updates.categoryId = categoryId;
    if (description !== undefined) updates.description = description || null;
    if (priority !== undefined) updates.priority = parseInt(String(priority), 10);
    if (conditions !== undefined) {
      updates.conditions = typeof conditions === 'string'
        ? conditions
        : JSON.stringify(conditions);
    }
    if (isActive !== undefined) updates.isActive = isActive;

    await db
      .update(categorizationRules)
      .set(updates)
      .where(eq(categorizationRules.id, id));

    return Response.json({
      message: 'Rule updated successfully',
    });
  } catch (error) {
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
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const ruleId = url.searchParams.get('id');

    if (!ruleId) {
      return Response.json(
        { error: 'Rule ID is required' },
        { status: 400 }
      );
    }

    // Verify rule belongs to user
    const rule = await db
      .select()
      .from(categorizationRules)
      .where(
        and(
          eq(categorizationRules.id, ruleId),
          eq(categorizationRules.userId, userId)
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
    console.error('Rule deletion error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
