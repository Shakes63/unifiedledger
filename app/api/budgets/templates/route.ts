import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { budgetCategories } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';

export const dynamic = 'force-dynamic';

interface BudgetGroupDefinition {
  name: string;
  type: 'income' | 'expense' | 'savings';
  targetAllocation: number;
  description: string;
}

interface BudgetTemplate {
  id: string;
  name: string;
  description: string;
  groups: BudgetGroupDefinition[];
  rules: {
    needs?: number; // Percentage of income
    wants?: number;
    savings?: number;
    committed?: number;
    retirement?: number;
    longTermSavings?: number;
    shortTermSavings?: number;
    funMoney?: number;
  };
}

const TEMPLATES: BudgetTemplate[] = [
  {
    id: '50-30-20',
    name: '50/30/20 Rule',
    description:
      'Popular budgeting method: 50% needs (essentials, bills), 30% wants (discretionary), 20% savings & debt',
    groups: [
      { name: 'Needs', type: 'expense', targetAllocation: 50, description: 'Essential expenses like rent, utilities, groceries, insurance' },
      { name: 'Wants', type: 'expense', targetAllocation: 30, description: 'Discretionary spending like entertainment, dining out, hobbies' },
      { name: 'Savings', type: 'savings', targetAllocation: 20, description: 'Savings and debt repayment' },
    ],
    rules: {
      needs: 50,
      wants: 30,
      savings: 20,
    },
  },
  {
    id: 'zero-based',
    name: 'Zero-Based Budget',
    description:
      'Every dollar has a purpose. Allocate all income to categories until income - expenses - savings = 0',
    groups: [], // Zero-based doesn't use predefined groups
    rules: {
      // This template requires equal distribution or user customization
      // We'll distribute evenly across categories
    },
  },
  {
    id: '60-solution',
    name: '60% Solution',
    description:
      'Simplified approach: 60% committed expenses (bills, essentials), 10% retirement, 10% long-term savings, 10% short-term savings, 10% fun money',
    groups: [
      { name: 'Committed', type: 'expense', targetAllocation: 60, description: 'Fixed expenses like bills, rent, insurance' },
      { name: 'Retirement', type: 'savings', targetAllocation: 10, description: '401k, IRA, pension contributions' },
      { name: 'Long-term Savings', type: 'savings', targetAllocation: 10, description: 'Emergency fund, house down payment, big purchases' },
      { name: 'Short-term Savings', type: 'savings', targetAllocation: 10, description: 'Vacation, gifts, short-term goals' },
      { name: 'Fun Money', type: 'expense', targetAllocation: 10, description: 'Entertainment, hobbies, treats' },
    ],
    rules: {
      committed: 60,
      retirement: 10,
      longTermSavings: 10,
      shortTermSavings: 10,
      funMoney: 10,
    },
  },
];

/**
 * GET /api/budgets/templates
 * Get available budget templates with their budget group definitions
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    // Note: Templates are static, but we verify auth for consistency
    await getAndVerifyHousehold(request, userId);

    // Return templates with group info for UI
    const templatesWithInfo = TEMPLATES.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      groups: t.groups.map(g => ({
        name: g.name,
        type: g.type,
        targetAllocation: g.targetAllocation,
        description: g.description,
      })),
    }));

    return Response.json({ templates: templatesWithInfo });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Fetch templates error:', error);
    return Response.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/budgets/templates
 * Apply a budget template - creates budget groups with target allocations
 * Request body:
 * {
 *   templateId: '50-30-20' | 'zero-based' | '60-solution',
 *   monthlyIncome: number
 * }
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const { householdId } = await getAndVerifyHousehold(request, userId, body);
    const { templateId, monthlyIncome } = body;

    // Validate request
    if (!templateId) {
      return Response.json(
        { error: 'templateId is required' },
        { status: 400 }
      );
    }

    if (!monthlyIncome || monthlyIncome <= 0) {
      return Response.json(
        { error: 'monthlyIncome must be greater than 0' },
        { status: 400 }
      );
    }

    // Find template
    const template = TEMPLATES.find(t => t.id === templateId);

    if (!template) {
      return Response.json({ error: 'Invalid templateId' }, { status: 400 });
    }

    // For zero-based template, no groups are created - just return info
    if (template.groups.length === 0) {
      return Response.json({
        template: {
          id: template.id,
          name: template.name,
          description: template.description,
        },
        monthlyIncome,
        createdGroups: [],
        message: 'Zero-based budgeting does not use budget groups. Allocate your income directly to categories.',
      });
    }

    // Check for existing budget groups with the same names
    const existingGroups = await db
      .select()
      .from(budgetCategories)
      .where(
        and(
          eq(budgetCategories.userId, userId),
          eq(budgetCategories.householdId, householdId),
          eq(budgetCategories.isBudgetGroup, true),
          eq(budgetCategories.isActive, true)
        )
      );

    const existingGroupNames = new Set(existingGroups.map(g => g.name.toLowerCase()));

    // Create budget groups that don't already exist
    const income = new Decimal(monthlyIncome);
    const createdGroups: Array<{
      id: string;
      name: string;
      type: string;
      targetAllocation: number;
      targetAmount: number;
      description: string;
      isNew: boolean;
    }> = [];

    for (const groupDef of template.groups) {
      // Check if group already exists (case-insensitive)
      const existingGroup = existingGroups.find(
        g => g.name.toLowerCase() === groupDef.name.toLowerCase()
      );

      if (existingGroup) {
        // Update existing group's target allocation
        await db
          .update(budgetCategories)
          .set({ targetAllocation: groupDef.targetAllocation })
          .where(eq(budgetCategories.id, existingGroup.id));

        createdGroups.push({
          id: existingGroup.id,
          name: existingGroup.name,
          type: groupDef.type,
          targetAllocation: groupDef.targetAllocation,
          targetAmount: income.times(groupDef.targetAllocation / 100).toNumber(),
          description: groupDef.description,
          isNew: false,
        });
      } else {
        // Create new group
        const groupId = nanoid();
        const groupData = {
          id: groupId,
          userId,
          householdId,
          name: groupDef.name,
          type: groupDef.type,
          monthlyBudget: 0, // Budget groups don't have direct budgets
          isBudgetGroup: true,
          targetAllocation: groupDef.targetAllocation,
          createdAt: new Date().toISOString(),
          usageCount: 0,
          sortOrder: createdGroups.length,
        };

        await db.insert(budgetCategories).values(groupData);

        createdGroups.push({
          id: groupId,
          name: groupDef.name,
          type: groupDef.type,
          targetAllocation: groupDef.targetAllocation,
          targetAmount: income.times(groupDef.targetAllocation / 100).toNumber(),
          description: groupDef.description,
          isNew: true,
        });
      }
    }

    // Get count of unassigned categories
    const unassignedCategories = await db
      .select()
      .from(budgetCategories)
      .where(
        and(
          eq(budgetCategories.userId, userId),
          eq(budgetCategories.householdId, householdId),
          eq(budgetCategories.isBudgetGroup, false),
          eq(budgetCategories.isActive, true)
        )
      );

    const unassignedCount = unassignedCategories.filter(c => !c.parentId).length;

    return Response.json({
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
      },
      monthlyIncome,
      createdGroups,
      unassignedCategoriesCount: unassignedCount,
      message: unassignedCount > 0 
        ? `Budget groups created! You have ${unassignedCount} categories to assign to these groups.`
        : 'Budget groups created! All your categories are already assigned.',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Apply template error:', error);
    return Response.json(
      { error: 'Failed to apply template' },
      { status: 500 }
    );
  }
}
