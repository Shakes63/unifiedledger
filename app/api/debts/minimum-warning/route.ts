import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { debts, debtSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { calculatePayoffStrategy, type DebtInput } from '@/lib/debts/payoff-calculator';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user's active debts
    const activeDebts = await db
      .select()
      .from(debts)
      .where(eq(debts.userId, userId))
      .orderBy(debts.priority);

    // Filter to only active debts
    const activeOnly = activeDebts.filter(d => d.status === 'active');

    if (activeOnly.length === 0) {
      return Response.json({ error: 'No active debts found' }, { status: 404 });
    }

    // Fetch user's debt settings
    const settings = await db
      .select()
      .from(debtSettings)
      .where(eq(debtSettings.userId, userId))
      .limit(1);

    const extraPayment = settings.length > 0 ? (settings[0].extraMonthlyPayment || 0) : 0;
    const preferredMethod = settings.length > 0 ? (settings[0].preferredMethod || 'avalanche') : 'avalanche';

    // Transform debts to DebtInput format
    const debtInputs: DebtInput[] = activeOnly.map(debt => ({
      id: debt.id,
      name: debt.name,
      remainingBalance: debt.remainingBalance,
      minimumPayment: debt.minimumPayment || 0,
      interestRate: debt.interestRate || 0,
      type: debt.type || 'other',
      loanType: debt.loanType as 'revolving' | 'installment' | undefined,
      compoundingFrequency: debt.compoundingFrequency as 'daily' | 'monthly' | 'quarterly' | 'annually' | undefined,
      billingCycleDays: debt.billingCycleDays || undefined,
      color: debt.color || undefined,
      icon: debt.icon || undefined,
    }));

    // Calculate minimum-only scenario (no extra payments)
    const minimumOnlyResult = calculatePayoffStrategy(debtInputs, 0, preferredMethod);

    // Calculate current plan scenario (with extra payments)
    const currentPlanResult = calculatePayoffStrategy(debtInputs, extraPayment, preferredMethod);

    // Calculate total minimum payments
    const totalMinimums = debtInputs.reduce((sum, d) => sum + d.minimumPayment, 0);

    // Calculate comparison metrics
    const monthsSaved = minimumOnlyResult.totalMonths - currentPlanResult.totalMonths;
    const yearsSaved = Math.floor(monthsSaved / 12);
    const remainingMonths = monthsSaved % 12;
    const interestSaved = minimumOnlyResult.totalInterestPaid - currentPlanResult.totalInterestPaid;
    const percentageReduction = minimumOnlyResult.totalInterestPaid > 0
      ? (interestSaved / minimumOnlyResult.totalInterestPaid) * 100
      : 0;

    // Format response
    const response = {
      minimumOnlyScenario: {
        totalMonths: minimumOnlyResult.totalMonths,
        totalYears: Math.floor(minimumOnlyResult.totalMonths / 12),
        remainingMonths: minimumOnlyResult.totalMonths % 12,
        totalInterestPaid: minimumOnlyResult.totalInterestPaid,
        debtFreeDate: minimumOnlyResult.debtFreeDate,
        monthlyPayment: totalMinimums,
      },
      currentPlanScenario: {
        totalMonths: currentPlanResult.totalMonths,
        totalYears: Math.floor(currentPlanResult.totalMonths / 12),
        remainingMonths: currentPlanResult.totalMonths % 12,
        totalInterestPaid: currentPlanResult.totalInterestPaid,
        debtFreeDate: currentPlanResult.debtFreeDate,
        monthlyPayment: totalMinimums + extraPayment,
        extraPayment,
      },
      comparison: {
        monthsSaved,
        yearsSaved,
        remainingMonthsSaved: remainingMonths,
        interestSaved,
        percentageReduction,
        hasExtraPayment: extraPayment > 0,
      },
    };

    return Response.json(response);
  } catch (error) {
    console.error('Error calculating minimum payment warning:', error);
    return Response.json({ error: 'Failed to calculate minimum payment warning' }, { status: 500 });
  }
}
