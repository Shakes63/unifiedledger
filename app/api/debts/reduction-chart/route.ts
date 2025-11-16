import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { debts, debtPayments } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { subMonths, startOfMonth, addMonths } from 'date-fns';
import {
  aggregateHistoricalBalances,
  generateProjection,
  mergeHistoricalAndProjection,
  calculateSummary,
  getDebtChartColors,
  DebtWithPayments,
  DebtDetail,
} from '@/lib/debts/reduction-chart-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    // Get all active debts for the user and household
    const userDebts = await db
      .select()
      .from(debts)
      .where(
        and(
          eq(debts.userId, userId),
          eq(debts.householdId, householdId),
          eq(debts.status, 'active')
        )
      );

    if (userDebts.length === 0) {
      return new Response(
        JSON.stringify({
          chartData: [],
          projectionStartDate: new Date().toISOString(),
          debtDetails: [],
          summary: {
            totalOriginalDebt: 0,
            totalCurrentDebt: 0,
            totalPaid: 0,
            percentageComplete: 0,
            debtFreeDate: null,
          },
        }),
        { status: 200 }
      );
    }

    // Get all payment history for the user and household (we'll filter by debt ID below)
    const allPayments = await db
      .select()
      .from(debtPayments)
      .where(
        and(
          eq(debtPayments.userId, userId),
          eq(debtPayments.householdId, householdId)
        )
      );

    // Filter payments to only those for active debts
    const debtIds = new Set(userDebts.map(d => d.id));
    const payments = allPayments.filter(p => debtIds.has(p.debtId));

    // Group payments by debt
    const paymentsByDebt = new Map<string, typeof payments>();
    for (const payment of payments) {
      const key = payment.debtId;
      if (!paymentsByDebt.has(key)) {
        paymentsByDebt.set(key, []);
      }
      paymentsByDebt.get(key)!.push(payment);
    }

    // Combine debts with their payment history and include loan details
    const debtsWithPayments: DebtWithPayments[] = userDebts.map(debt => ({
      id: debt.id,
      name: debt.name,
      originalAmount: debt.originalAmount,
      remainingBalance: debt.remainingBalance,
      startDate: debt.startDate,
      status: debt.status || 'active',
      minimumPayment: debt.minimumPayment || 0,
      interestRate: debt.interestRate || 0,
      loanType: debt.loanType || 'revolving',
      compoundingFrequency: debt.compoundingFrequency || 'monthly',
      payments: (paymentsByDebt.get(debt.id) || [])
        .map(p => ({
          paymentDate: p.paymentDate,
          principalAmount: p.principalAmount || 0,
        }))
        .sort((a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime()),
    }));

    // Calculate date range for historical data
    // Go back 12 months from today, or to when first debt was created, whichever is more recent
    const now = new Date();
    const earliestDebtDate = new Date(
      Math.min(...debtsWithPayments.map(d => new Date(d.startDate).getTime()))
    );
    const historyStartDate = startOfMonth(
      new Date(Math.max(
        subMonths(now, 12).getTime(),
        earliestDebtDate.getTime()
      ))
    );
    const historyEndDate = startOfMonth(now);

    // Calculate historical monthly balances
    const historicalData = aggregateHistoricalBalances(
      debtsWithPayments,
      historyStartDate,
      historyEndDate
    );

    // Get debt settings for extra payment and strategy for this household
    const { debtSettings } = await import('@/lib/db/schema');
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

    const extraPayment = settings[0]?.extraMonthlyPayment || 0;
    const method = (settings[0]?.preferredMethod as 'snowball' | 'avalanche') || 'avalanche';
    const frequency = (settings[0]?.paymentFrequency as 'monthly' | 'biweekly') || 'monthly';

    // Generate 24-month forward projection using actual calculator
    const projectionData = await generateProjection(
      debtsWithPayments,
      historyEndDate,
      24,
      extraPayment,
      method,
      frequency
    );

    // Merge historical and projected data
    const chartData = mergeHistoricalAndProjection(historicalData, projectionData);

    // Create debt details with colors
    const colors = getDebtChartColors(debtsWithPayments.length);
    const debtDetails: DebtDetail[] = debtsWithPayments.map((debt, index) => {
      // Find debt-free date in projection
      let payoffDate: string | null = null;
      for (const point of chartData) {
        if (point.byDebt[debt.id] <= 0) {
          payoffDate = point.month;
          break;
        }
      }

      return {
        id: debt.id,
        name: debt.name,
        originalBalance: debt.originalAmount,
        currentBalance: debt.remainingBalance,
        payoffDate,
        color: colors[index],
      };
    });

    // Calculate summary statistics
    const summary = calculateSummary(debtsWithPayments, chartData);

    // Return response
    return new Response(
      JSON.stringify({
        chartData: chartData.map(point => ({
          month: point.month,
          projectedTotal: Math.round(point.projectedTotal * 100) / 100,
          actualTotal: Math.round(point.actualTotal * 100) / 100,
          byDebt: Object.entries(point.byDebt).reduce(
            (acc, [id, balance]) => ({
              ...acc,
              [id]: Math.round(balance * 100) / 100,
            }),
            {} as Record<string, number>
          ),
        })),
        projectionStartDate: historyEndDate.toISOString(),
        debtDetails,
        summary,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
        },
      }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401 }
      );
    }
    if (error instanceof Error && error.message.includes('Household ID')) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400 }
      );
    }
    console.error('Error fetching debt reduction chart:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch debt reduction data',
      }),
      { status: 500 }
    );
  }
}
