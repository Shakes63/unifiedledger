import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { billPaymentEvents, debtPayments, transactions } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { subMonths, startOfMonth } from 'date-fns';
import {
  aggregateHistoricalBalances,
  generateProjection,
  mergeHistoricalAndProjection,
  calculateSummary,
  getDebtChartColors,
  DebtWithPayments,
  DebtDetail,
} from '@/lib/debts/reduction-chart-utils';
import { getDebtStrategySettings, getUnifiedDebtSources } from '@/lib/debts/unified-debt-sources';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    // Use unified debt sources so chart includes account/bill/debt origins.
    const userDebts = await getUnifiedDebtSources(householdId);

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

    const accountIds = userDebts
      .filter((debt) => debt.source === 'account')
      .map((debt) => debt.id);
    const billIds = userDebts
      .filter((debt) => debt.source === 'bill')
      .map((debt) => debt.id);
    const debtIds = userDebts
      .filter((debt) => debt.source === 'debt')
      .map((debt) => debt.id);

    const [accountPaymentRows, billPaymentRows, legacyBillTxRows, debtPaymentRows] = await Promise.all([
      accountIds.length > 0
        ? db
            .select({
              accountId: transactions.accountId,
              paymentDate: transactions.date,
              amount: transactions.amount,
            })
            .from(transactions)
            .where(
              and(
                eq(transactions.householdId, householdId),
                eq(transactions.userId, userId),
                eq(transactions.type, 'transfer_in'),
                inArray(transactions.accountId, accountIds)
              )
            )
        : Promise.resolve([]),
      billIds.length > 0
        ? db
            .select({
              billId: billPaymentEvents.templateId,
              paymentDate: billPaymentEvents.paymentDate,
              principalAmount: billPaymentEvents.principalCents,
              amount: billPaymentEvents.amountCents,
            })
            .from(billPaymentEvents)
            .where(
              and(
                eq(billPaymentEvents.householdId, householdId),
                inArray(billPaymentEvents.templateId, billIds)
              )
            )
        : Promise.resolve([]),
      billIds.length > 0
        ? db
            .select({
              billId: transactions.billId,
              paymentDate: transactions.date,
              amount: transactions.amount,
            })
            .from(transactions)
            .where(
              and(
                eq(transactions.householdId, householdId),
                eq(transactions.userId, userId),
                eq(transactions.type, 'expense'),
                inArray(transactions.billId, billIds)
              )
            )
        : Promise.resolve([]),
      debtIds.length > 0
        ? db
            .select({
              debtId: debtPayments.debtId,
              paymentDate: debtPayments.paymentDate,
              principalAmount: debtPayments.principalAmount,
              amount: debtPayments.amount,
            })
            .from(debtPayments)
            .where(
              and(
                eq(debtPayments.userId, userId),
                eq(debtPayments.householdId, householdId),
                inArray(debtPayments.debtId, debtIds)
              )
            )
        : Promise.resolve([]),
    ]);

    const paymentsBySourceId = new Map<
      string,
      Array<{ paymentDate: string; principalAmount: number }>
    >();
    const pushPayment = (
      sourceId: string,
      payment: { paymentDate: string; principalAmount: number }
    ) => {
      if (!paymentsBySourceId.has(sourceId)) {
        paymentsBySourceId.set(sourceId, []);
      }
      paymentsBySourceId.get(sourceId)!.push(payment);
    };

    for (const row of accountPaymentRows) {
      pushPayment(row.accountId, {
        paymentDate: row.paymentDate,
        principalAmount: Math.abs(row.amount || 0),
      });
    }
    for (const row of billPaymentRows) {
      pushPayment(row.billId, {
        paymentDate: row.paymentDate,
        principalAmount:
          row.principalAmount !== null && row.principalAmount !== undefined
            ? row.principalAmount / 100
            : (row.amount || 0) / 100,
      });
    }
    for (const row of legacyBillTxRows) {
      if (!row.billId) continue;
      pushPayment(row.billId, {
        paymentDate: row.paymentDate,
        principalAmount: Math.abs(row.amount || 0),
      });
    }
    for (const row of debtPaymentRows) {
      pushPayment(row.debtId, {
        paymentDate: row.paymentDate,
        principalAmount: row.principalAmount || row.amount || 0,
      });
    }

    const debtsWithPayments: DebtWithPayments[] = userDebts.map((debt) => {
      const payments = (paymentsBySourceId.get(debt.id) || []).sort(
        (a, b) =>
          new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime()
      );
      return {
        id: debt.id,
        name: debt.name,
        originalAmount: debt.originalBalance,
        remainingBalance: debt.remainingBalance,
        startDate: payments[0]?.paymentDate || new Date().toISOString(),
        status: 'active',
        minimumPayment: debt.minimumPayment || 0,
        interestRate: debt.interestRate || 0,
        loanType: debt.loanType || 'revolving',
        compoundingFrequency: debt.compoundingFrequency || 'monthly',
        payments,
      };
    });

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

    // Get household-level debt settings (with legacy fallback in helper).
    const settings = await getDebtStrategySettings(userId, householdId);
    const extraPayment = settings.extraMonthlyPayment || 0;
    const method = settings.preferredMethod || 'avalanche';
    // Projection util currently supports monthly|biweekly.
    const frequency = settings.paymentFrequency === 'biweekly' ? 'biweekly' : 'monthly';

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
