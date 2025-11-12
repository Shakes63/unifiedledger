import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { budgetCategories } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { name, monthlyBudget, dueDate, isTaxDeductible, incomeFrequency } = body;

    // Verify category belongs to user
    const category = await db
      .select()
      .from(budgetCategories)
      .where(and(eq(budgetCategories.id, id), eq(budgetCategories.userId, userId)))
      .limit(1);

    if (!category || category.length === 0) {
      return Response.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Validate income frequency if provided
    if (incomeFrequency) {
      const validFrequencies = ['weekly', 'biweekly', 'monthly', 'variable'];
      if (!validFrequencies.includes(incomeFrequency)) {
        return Response.json(
          { error: 'Invalid income frequency. Must be weekly, biweekly, monthly, or variable' },
          { status: 400 }
        );
      }
    }

    // Update the category
    await db.update(budgetCategories)
      .set({
        name: name || category[0].name,
        monthlyBudget: monthlyBudget ?? category[0].monthlyBudget,
        dueDate: dueDate !== undefined ? dueDate : category[0].dueDate,
        isTaxDeductible: isTaxDeductible !== undefined ? isTaxDeductible : category[0].isTaxDeductible,
        incomeFrequency: incomeFrequency !== undefined ? incomeFrequency : category[0].incomeFrequency,
      })
      .where(eq(budgetCategories.id, id));

    return Response.json(
      { message: 'Category updated successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Category update error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Verify category belongs to user
    const category = await db
      .select()
      .from(budgetCategories)
      .where(and(eq(budgetCategories.id, id), eq(budgetCategories.userId, userId)))
      .limit(1);

    if (!category || category.length === 0) {
      return Response.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Delete the category
    await db.delete(budgetCategories).where(eq(budgetCategories.id, id));

    return Response.json(
      { message: 'Category deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Category deletion error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
