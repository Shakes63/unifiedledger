import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { debts, debtSettings, debtPayments } from '@/lib/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { calculatePayoffStrategy, type DebtInput, type PayoffMethod, type PaymentFrequency } from '@/lib/debts/payoff-calculator';
import Decimal from 'decimal.js';

export const dynamic = 'force-dynamic';

type AdherenceStatus = 'on_track' | 'ahead' | 'behind' | 'significantly_behind';

interface MonthlyAdherenceData {
  month: string; // "2025-01"
  monthLabel: string; // "Jan 2025"
  expectedPayment: number;
  actualPayment: number;
  adherence: number; // Percentage
  status: AdherenceStatus;
  difference: number; // actual - expected
}

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    // 1. Get user's debt settings for this household
    const settings = await db
      .select()
      .from(debtSettings)
      .where(
        and(
          eq(debtSettings.userId, userId),
          eq(debtSettings.householdId, householdId)
        )
      )
      .limit(1);

    const preferredMethod = (settings[0]?.preferredMethod || 'avalanche') as PayoffMethod;
    const paymentFrequency = (settings[0]?.paymentFrequency || 'monthly') as PaymentFrequency;
    const extraMonthlyPayment = settings[0]?.extraMonthlyPayment || 0;

    // 2. Get all active debts for this household
    const activeDebts = await db
      .select()
      .from(debts)
      .where(
        and(
          eq(debts.userId, userId),
          eq(debts.householdId, householdId),
          eq(debts.status, 'active')
        )
      );

    if (activeDebts.length === 0) {
      return Response.json({
        hasDebts: false,
        message: 'No active debts to track',
      });
    }

    // 3. Calculate total minimum payment and per-debt extras
    const totalMinimumPayment = activeDebts.reduce(
      (sum, debt) => new Decimal(sum).plus(debt.minimumPayment || 0).toNumber(),
      0
    );

    // Include per-debt additional payments as part of the planned payment
    const totalPerDebtExtras = activeDebts.reduce(
      (sum, debt) => new Decimal(sum).plus(debt.additionalMonthlyPayment || 0).toNumber(),
      0
    );

    // Total expected = minimums + per-debt extras + global extra from settings
    const totalExpectedPayment = new Decimal(totalMinimumPayment)
      .plus(totalPerDebtExtras)
      .plus(extraMonthlyPayment)
      .toNumber();

    // 4. Generate last 12 months
    const monthlyData: MonthlyAdherenceData[] = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      // Get start and end of month
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
        .toISOString()
        .split('T')[0];
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
        .toISOString()
        .split('T')[0];

      // Fetch actual payments for this month (filtered by household)
      const payments = await db
        .select()
        .from(debtPayments)
        .where(
          and(
            eq(debtPayments.userId, userId),
            eq(debtPayments.householdId, householdId),
            gte(debtPayments.paymentDate, monthStart),
            lte(debtPayments.paymentDate, monthEnd)
          )
        );

      const actualPayment = payments.reduce(
        (sum, payment) => new Decimal(sum).plus(payment.amount || 0).toNumber(),
        0
      );

      // Calculate adherence
      const adherence = totalExpectedPayment > 0
        ? new Decimal(actualPayment).div(totalExpectedPayment).times(100).toNumber()
        : 0;

      // Determine status
      let status: AdherenceStatus;
      if (adherence >= 105) {
        status = 'ahead';
      } else if (adherence >= 95) {
        status = 'on_track';
      } else if (adherence >= 80) {
        status = 'behind';
      } else {
        status = 'significantly_behind';
      }

      const difference = new Decimal(actualPayment).minus(totalExpectedPayment).toNumber();

      monthlyData.push({
        month: monthKey,
        monthLabel,
        expectedPayment: totalExpectedPayment,
        actualPayment,
        adherence: Math.round(adherence * 10) / 10, // Round to 1 decimal
        status,
        difference,
      });
    }

    // 5. Calculate overall stats
    const monthsWithData = monthlyData.filter(m => m.actualPayment > 0);
    const monthsTracked = monthsWithData.length;

    if (monthsTracked === 0) {
      return Response.json({
        hasDebts: true,
        hasHistory: false,
        message: 'No payment history yet. Make your first payment to start tracking!',
        totalExpectedPayment,
        totalMinimumPayment,
      });
    }

    const monthsOnTrack = monthlyData.filter(m => m.status === 'on_track').length;
    const monthsAhead = monthlyData.filter(m => m.status === 'ahead').length;
    const monthsBehind = monthlyData.filter(m => m.status === 'behind' || m.status === 'significantly_behind').length;

    // Calculate weighted average adherence (recent months weighted more)
    const recentMonths = monthlyData.slice(-3).filter(m => m.actualPayment > 0);
    const middleMonths = monthlyData.slice(-6, -3).filter(m => m.actualPayment > 0);
    const olderMonths = monthlyData.slice(0, -6).filter(m => m.actualPayment > 0);

    const recentAvg = recentMonths.length > 0
      ? recentMonths.reduce((sum, m) => sum + m.adherence, 0) / recentMonths.length
      : 100;
    const middleAvg = middleMonths.length > 0
      ? middleMonths.reduce((sum, m) => sum + m.adherence, 0) / middleMonths.length
      : 100;
    const olderAvg = olderMonths.length > 0
      ? olderMonths.reduce((sum, m) => sum + m.adherence, 0) / olderMonths.length
      : 100;

    const averageAdherence = new Decimal(recentAvg)
      .times(0.5) // 50% weight on last 3 months
      .plus(new Decimal(middleAvg).times(0.3)) // 30% on months 4-6
      .plus(new Decimal(olderAvg).times(0.2)) // 20% on older
      .toNumber();

    // Overall status based on weighted average
    let overallStatus: AdherenceStatus;
    if (averageAdherence >= 105) {
      overallStatus = 'ahead';
    } else if (averageAdherence >= 95) {
      overallStatus = 'on_track';
    } else if (averageAdherence >= 80) {
      overallStatus = 'behind';
    } else {
      overallStatus = 'significantly_behind';
    }

    // 6. Calculate projection adjustment
    // Use average of last 3 months to project future
    const recentActualPayments = recentMonths.map(m => m.actualPayment);
    const actualAveragePayment = recentActualPayments.length > 0
      ? recentActualPayments.reduce((sum, p) => sum + p, 0) / recentActualPayments.length
      : totalExpectedPayment;

    // Prepare debt inputs for calculator
    const debtInputs: DebtInput[] = activeDebts.map(debt => ({
      id: debt.id,
      name: debt.name || 'Unknown Debt',
      remainingBalance: debt.remainingBalance || 0,
      minimumPayment: debt.minimumPayment || 0,
      additionalMonthlyPayment: debt.additionalMonthlyPayment || 0,
      interestRate: debt.interestRate || 0,
      type: debt.type || 'credit_card',
      loanType: debt.loanType as 'revolving' | 'installment' | undefined,
      compoundingFrequency: debt.compoundingFrequency as 'daily' | 'monthly' | 'quarterly' | 'annually' | undefined,
      billingCycleDays: debt.billingCycleDays || undefined,
    }));

    let projectionAdjustment = null;

    // Only calculate projections if we have reasonable debt amounts and timeframes
    // Skip for very long-term debts to avoid timeout/memory issues
    const totalDebt = activeDebts.reduce((sum, d) => sum + (d.remainingBalance || 0), 0);
    const totalMinPayment = activeDebts.reduce((sum, d) => sum + (d.minimumPayment || 0), 0);

    // Calculate projections for reasonable debt scenarios
    // The payoff calculator has built-in safety limits (360 months max)
    const adjustedExtraPayment = Math.max(0, actualAveragePayment - totalMinimumPayment);
    const shouldCalculateProjections = totalDebt > 0 && totalMinPayment > 0;

    if (shouldCalculateProjections) {
      try {
        // Set a timeout to prevent long-running calculations
        const calculationPromise = Promise.race([
          (async () => {
            // Original projection (using current settings)
            const originalProjection = calculatePayoffStrategy(
              debtInputs,
              extraMonthlyPayment,
              preferredMethod,
              paymentFrequency
            );

            // Adjusted projection (using actual average)
            const adjustedProjection = calculatePayoffStrategy(
              debtInputs,
              adjustedExtraPayment,
              preferredMethod,
              paymentFrequency
            );

            return { originalProjection, adjustedProjection };
          })(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Calculation timeout')), 5000)
          )
        ]);

        const result = await calculationPromise as {
          originalProjection: any;
          adjustedProjection: any;
        };

        const monthsAheadOrBehind = result.originalProjection.totalMonths - result.adjustedProjection.totalMonths;
        const interestDifference = new Decimal(result.originalProjection.totalInterestPaid)
          .minus(result.adjustedProjection.totalInterestPaid)
          .toNumber();

        projectionAdjustment = {
          monthsAheadOrBehind,
          originalDebtFreeDate: result.originalProjection.debtFreeDate.toISOString(),
          adjustedDebtFreeDate: result.adjustedProjection.debtFreeDate.toISOString(),
          originalTotalInterest: Math.round(result.originalProjection.totalInterestPaid),
          adjustedTotalInterest: Math.round(result.adjustedProjection.totalInterestPaid),
          savingsFromBeingAhead: monthsAheadOrBehind > 0 ? Math.round(interestDifference) : undefined,
          additionalCostFromBehind: monthsAheadOrBehind < 0 ? Math.round(Math.abs(interestDifference)) : undefined,
        };
      } catch (projectionError) {
        console.error('Error calculating projections (skipped):', projectionError);
        // Continue without projection data - component will handle gracefully
      }
    }

    return Response.json({
      hasDebts: true,
      hasHistory: true,
      overallStatus,
      overallAdherence: Math.round(averageAdherence * 10) / 10,
      monthsTracked,
      monthsOnTrack,
      monthsAhead,
      monthsBehind,
      averageAdherence: Math.round(averageAdherence * 10) / 10,
      totalExpectedPayment,
      totalMinimumPayment,
      totalPerDebtExtras,
      actualAveragePayment: Math.round(actualAveragePayment * 100) / 100,
      projectionAdjustment,
      monthlyData,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household ID')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Payment adherence error:', error);
    return Response.json(
      { error: 'Failed to calculate payment adherence' },
      { status: 500 }
    );
  }
}
