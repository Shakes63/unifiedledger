import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { debtPayments, billPaymentEvents, transactions } from '@/lib/db/schema';
import { eq, and, inArray, gte, lte } from 'drizzle-orm';
import Decimal from 'decimal.js';
import { getUnifiedDebtSources } from '@/lib/debts/unified-debt-sources';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    // Get date range for this month's payments
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    // Unified mode: account + bill + standalone debt sources
    const unifiedDebts = await getUnifiedDebtSources(householdId, {
      includeZeroBalances: true,
    });

    // Calculate totals from unified sources
    let totalBalance = new Decimal(0);
    let totalOriginalBalance = new Decimal(0);
    let inStrategyCount = 0;
    let inStrategyBalance = new Decimal(0);

    for (const debt of unifiedDebts) {
      const balance = new Decimal(debt.remainingBalance || 0);
      const original = new Decimal(debt.originalBalance || debt.remainingBalance || 0);

      totalBalance = totalBalance.plus(balance);
      totalOriginalBalance = totalOriginalBalance.plus(original);

      if (debt.includeInPayoffStrategy) {
        inStrategyCount++;
        inStrategyBalance = inStrategyBalance.plus(balance);
      }
    }

    // Get this month's payments from bill + standalone debt + account transfer-in tables
    const accountDebtIds = unifiedDebts
      .filter((d) => d.source === 'account')
      .map((d) => d.id);
    const billDebtIds = unifiedDebts
      .filter((d) => d.source === 'bill')
      .map((d) => d.id);
    const [monthBillPayments, monthDebtPayments, monthAccountPayments] = await Promise.all([
      billDebtIds.length > 0
        ? db
            .select({
              amountCents: billPaymentEvents.amountCents,
            })
            .from(billPaymentEvents)
            .where(
              and(
                eq(billPaymentEvents.householdId, householdId),
                inArray(billPaymentEvents.templateId, billDebtIds),
                gte(billPaymentEvents.paymentDate, monthStart),
                lte(billPaymentEvents.paymentDate, monthEnd)
              )
            )
        : Promise.resolve([]),
      db
        .select()
        .from(debtPayments)
        .where(
          and(
            eq(debtPayments.householdId, householdId),
            gte(debtPayments.paymentDate, monthStart),
            lte(debtPayments.paymentDate, monthEnd)
          )
        ),
      accountDebtIds.length > 0
        ? db
            .select()
            .from(transactions)
            .where(
              and(
                eq(transactions.householdId, householdId),
                inArray(transactions.accountId, accountDebtIds),
                eq(transactions.type, 'transfer_in'),
                gte(transactions.date, monthStart.slice(0, 10)),
                lte(transactions.date, monthEnd.slice(0, 10))
              )
            )
        : Promise.resolve([]),
    ]);

    const thisMonthBillAndDebtTotal = [
      ...monthBillPayments.map((payment) => new Decimal(payment.amountCents || 0).div(100).toNumber()),
      ...monthDebtPayments.map((payment) => payment.amount || 0),
    ].reduce(
      (sum, amount) => sum.plus(new Decimal(amount)),
      new Decimal(0)
    );
    const thisMonthAccountTotal = monthAccountPayments.reduce(
      (sum, payment) => sum.plus(new Decimal(Math.abs(payment.amount || 0))),
      new Decimal(0)
    );
    const thisMonthTotal = thisMonthBillAndDebtTotal.plus(thisMonthAccountTotal);

    // Calculate unified debt details
    const debtDetails = unifiedDebts.map((debt) => ({
      id: debt.id,
      name: debt.name,
      source: debt.source,
      sourceType: debt.sourceType || 'other',
      remainingBalance: debt.remainingBalance || 0,
      minimumPayment: debt.minimumPayment || 0,
      interestRate: debt.interestRate || 0,
      includeInPayoffStrategy: debt.includeInPayoffStrategy,
      color: debt.color || undefined,
    }));

    // Sort by balance (highest first)
    debtDetails.sort((a, b) => b.remainingBalance - a.remainingBalance);

    const totalPaidOff = totalOriginalBalance.minus(totalBalance).toNumber();
    const percentagePaidOff = totalOriginalBalance.greaterThan(0)
      ? totalOriginalBalance.minus(totalBalance).div(totalOriginalBalance).times(100).toNumber()
      : 0;

    return Response.json({
      totalRemainingBalance: totalBalance.toNumber(),
      totalOriginalAmount: totalOriginalBalance.toNumber(),
      totalPaidOff: Math.max(0, totalPaidOff),
      percentagePaidOff: Math.max(0, Math.min(100, percentagePaidOff)),
      standaloneDebtCount: unifiedDebts.filter((d) => d.source === 'debt').length,
      activeDebtCount: unifiedDebts.length,
      creditAccountCount: unifiedDebts.filter((d) => d.source === 'account').length,
      debtBillCount: unifiedDebts.filter((d) => d.source === 'bill').length,
      inStrategyCount,
      inStrategyBalance: inStrategyBalance.toNumber(),
      thisMonthPayments: thisMonthTotal.toNumber(),
      debtDetails,
      paidOffDebtCount: 0, // Closed debt entities are not currently tracked in unified stats.
      priorityDebt: debtDetails.length > 0 ? debtDetails[0] : null,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household ID')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Error fetching debt stats:', error);
    return Response.json({ error: 'Failed to fetch debt statistics' }, { status: 500 });
  }
}
