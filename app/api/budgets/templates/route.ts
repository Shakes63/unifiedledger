import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { budgetCategories } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import Decimal from 'decimal.js';

export const dynamic = 'force-dynamic';

interface BudgetTemplate {
  id: string;
  name: string;
  description: string;
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
 * Get available budget templates
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    // Note: Templates are static, but we verify auth for consistency
    await getAndVerifyHousehold(request, userId);

    return Response.json({ templates: TEMPLATES });
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
 * POST /api/budgets/templates/apply
 * Apply a budget template
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

    // Fetch user's categories for this household
    const categories = await db
      .select()
      .from(budgetCategories)
      .where(
        and(
          eq(budgetCategories.userId, userId),
          eq(budgetCategories.householdId, householdId),
          eq(budgetCategories.isActive, true)
        )
      );

    if (categories.length === 0) {
      return Response.json(
        {
          error:
            'No categories found. Please create categories before applying a template.',
        },
        { status: 404 }
      );
    }

    // Categorize user's categories into template buckets
    // "Needs" are essential expenses (based on name patterns)
    const needs = categories.filter(
      c =>
        c.type === 'expense' &&
        (c.name.toLowerCase().includes('rent') ||
        c.name.toLowerCase().includes('mortgage') ||
        c.name.toLowerCase().includes('utilities') ||
        c.name.toLowerCase().includes('insurance') ||
        c.name.toLowerCase().includes('groceries') ||
        c.name.toLowerCase().includes('transportation'))
    );

    // "Wants" are discretionary expenses (based on name patterns, excluding needs)
    const wants = categories.filter(
      c =>
        c.type === 'expense' &&
        !needs.some(n => n.id === c.id) &&
        (c.name.toLowerCase().includes('entertainment') ||
          c.name.toLowerCase().includes('dining') ||
          c.name.toLowerCase().includes('shopping') ||
          c.name.toLowerCase().includes('hobby') ||
          c.name.toLowerCase().includes('recreation'))
    );

    const savings = categories.filter(c => c.type === 'savings');

    // For backwards compatibility, debt category still used in templates (from debts module)
    const debt: typeof categories = [];

    // Apply template rules
    const suggestedBudgets: Array<{
      categoryId: string;
      categoryName: string;
      monthlyBudget: number;
      allocation: string;
    }> = [];

    const income = new Decimal(monthlyIncome);

    if (templateId === '50-30-20') {
      // 50% to needs
      const needsAmount = income.times(0.5);
      const perNeedCategory = needs.length > 0 ? needsAmount.div(needs.length) : 0;

      for (const category of needs) {
        suggestedBudgets.push({
          categoryId: category.id,
          categoryName: category.name,
          monthlyBudget: new Decimal(perNeedCategory).toNumber(),
          allocation: 'Needs (50%)',
        });
      }

      // 30% to wants
      const wantsAmount = income.times(0.3);
      const perWantCategory = wants.length > 0 ? wantsAmount.div(wants.length) : 0;

      for (const category of wants) {
        suggestedBudgets.push({
          categoryId: category.id,
          categoryName: category.name,
          monthlyBudget: new Decimal(perWantCategory).toNumber(),
          allocation: 'Wants (30%)',
        });
      }

      // 20% to savings & debt
      const savingsAmount = income.times(0.2);
      const savingsAndDebt = [...savings, ...debt];
      const perSavingsCategory =
        savingsAndDebt.length > 0 ? savingsAmount.div(savingsAndDebt.length) : 0;

      for (const category of savingsAndDebt) {
        suggestedBudgets.push({
          categoryId: category.id,
          categoryName: category.name,
          monthlyBudget: new Decimal(perSavingsCategory).toNumber(),
          allocation: 'Savings & Debt (20%)',
        });
      }
    } else if (templateId === 'zero-based') {
      // Distribute income evenly across all categories
      const perCategory = income.div(categories.length);

      for (const category of categories) {
        suggestedBudgets.push({
          categoryId: category.id,
          categoryName: category.name,
          monthlyBudget: new Decimal(perCategory).toNumber(),
          allocation: 'Equal Distribution',
        });
      }
    } else if (templateId === '60-solution') {
      // 60% committed (needs + bills)
      const committedAmount = income.times(0.6);
      const perCommittedCategory =
        needs.length > 0 ? committedAmount.div(needs.length) : 0;

      for (const category of needs) {
        suggestedBudgets.push({
          categoryId: category.id,
          categoryName: category.name,
          monthlyBudget: new Decimal(perCommittedCategory).toNumber(),
          allocation: 'Committed Expenses (60%)',
        });
      }

      // 10% retirement
      const retirementCategories = categories.filter(
        c =>
          c.type === 'savings' &&
          (c.name.toLowerCase().includes('retirement') ||
            c.name.toLowerCase().includes('401k') ||
            c.name.toLowerCase().includes('ira'))
      );

      const retirementAmount = income.times(0.1);
      const perRetirementCategory =
        retirementCategories.length > 0
          ? retirementAmount.div(retirementCategories.length)
          : 0;

      for (const category of retirementCategories) {
        suggestedBudgets.push({
          categoryId: category.id,
          categoryName: category.name,
          monthlyBudget: new Decimal(perRetirementCategory).toNumber(),
          allocation: 'Retirement (10%)',
        });
      }

      // 10% long-term savings
      const longTermCategories = savings.filter(
        c =>
          !retirementCategories.some(r => r.id === c.id) &&
          (c.name.toLowerCase().includes('emergency') ||
            c.name.toLowerCase().includes('house') ||
            c.name.toLowerCase().includes('car'))
      );

      const longTermAmount = income.times(0.1);
      const perLongTermCategory =
        longTermCategories.length > 0
          ? longTermAmount.div(longTermCategories.length)
          : 0;

      for (const category of longTermCategories) {
        suggestedBudgets.push({
          categoryId: category.id,
          categoryName: category.name,
          monthlyBudget: new Decimal(perLongTermCategory).toNumber(),
          allocation: 'Long-term Savings (10%)',
        });
      }

      // 10% short-term savings
      const shortTermCategories = savings.filter(
        c =>
          !retirementCategories.some(r => r.id === c.id) &&
          !longTermCategories.some(l => l.id === c.id)
      );

      const shortTermAmount = income.times(0.1);
      const perShortTermCategory =
        shortTermCategories.length > 0
          ? shortTermAmount.div(shortTermCategories.length)
          : 0;

      for (const category of shortTermCategories) {
        suggestedBudgets.push({
          categoryId: category.id,
          categoryName: category.name,
          monthlyBudget: new Decimal(perShortTermCategory).toNumber(),
          allocation: 'Short-term Savings (10%)',
        });
      }

      // 10% fun money
      const funAmount = income.times(0.1);
      const perFunCategory = wants.length > 0 ? funAmount.div(wants.length) : 0;

      for (const category of wants) {
        suggestedBudgets.push({
          categoryId: category.id,
          categoryName: category.name,
          monthlyBudget: new Decimal(perFunCategory).toNumber(),
          allocation: 'Fun Money (10%)',
        });
      }
    }

    // Calculate totals
    const totalAllocated = suggestedBudgets.reduce(
      (sum, b) => new Decimal(sum).plus(b.monthlyBudget).toNumber(),
      0
    );

    return Response.json({
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
      },
      monthlyIncome,
      suggestedBudgets,
      totalAllocated,
      remaining: new Decimal(monthlyIncome).minus(totalAllocated).toNumber(),
      categoriesMatched: suggestedBudgets.length,
      totalCategories: categories.length,
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
