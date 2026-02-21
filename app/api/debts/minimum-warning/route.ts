import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { calculatePayoffStrategy, type DebtInput, type PaymentFrequency } from '@/lib/debts/payoff-calculator';
import {
  getDebtStrategySettings,
  getUnifiedDebtSources,
  toDebtInputs,
} from '@/lib/debts/unified-debt-sources';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    const unifiedDebts = await getUnifiedDebtSources(householdId);
    if (unifiedDebts.length === 0) {
      return Response.json({ error: 'No active debts found' }, { status: 404 });
    }

    const settings = await getDebtStrategySettings(userId, householdId);
    const extraPayment = settings.extraMonthlyPayment || 0;
    const preferredMethod = settings.preferredMethod || 'avalanche';
    const paymentFrequency: PaymentFrequency = settings.paymentFrequency || 'monthly';

    const debtInputs: DebtInput[] = toDebtInputs(unifiedDebts, { inStrategyOnly: true });
    if (debtInputs.length === 0) {
      return Response.json(
        { error: 'No debts are currently included in the payoff strategy' },
        { status: 404 }
      );
    }

    // Calculate minimum-only scenario (no extra payments)
    const minimumOnlyResult = calculatePayoffStrategy(debtInputs, 0, preferredMethod, paymentFrequency);

    // Calculate current plan scenario (with extra payments)
    const currentPlanResult = calculatePayoffStrategy(debtInputs, extraPayment, preferredMethod, paymentFrequency);

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
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household ID')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error calculating minimum payment warning:', error);
    return Response.json({ error: 'Failed to calculate minimum payment warning' }, { status: 500 });
  }
}
