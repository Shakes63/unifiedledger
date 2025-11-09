import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { debts, debtPayments } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    // Get all debts for user
    const allDebts = await db.select().from(debts).where(eq(debts.userId, userId));

    // Calculate totals
    const totalOriginalAmount = allDebts.reduce((sum, d) => sum + d.originalAmount, 0);
    const totalRemainingBalance = allDebts.reduce((sum, d) => sum + d.remainingBalance, 0);
    const totalPaidOff = totalOriginalAmount - totalRemainingBalance;

    // Get active debts
    const activeDebts = allDebts.filter((d) => d.status === 'active');
    const paidOffDebts = allDebts.filter((d) => d.status === 'paid_off');

    // Get total payments this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
      .toISOString();

    const thisMonthPayments = await db
      .select()
      .from(debtPayments)
      .where(
        and(
          eq(debtPayments.userId, userId),
          // Simple string comparison works for ISO dates
          // In production, consider using actual date comparison
        )
      );

    const thisMonthTotal = thisMonthPayments
      .filter(
        (p) =>
          new Date(p.paymentDate).getTime() >= new Date(monthStart).getTime() &&
          new Date(p.paymentDate).getTime() <= new Date(monthEnd).getTime()
      )
      .reduce((sum, p) => sum + p.amount, 0);

    // Calculate debt-to-income estimate (if we had income data)
    // For now, just return debt metrics

    // Find the debt with highest priority (fastest payoff target)
    const sortedDebts = activeDebts.sort((a, b) => (a.priority || 999) - (b.priority || 999));
    const priorityDebt = sortedDebts.length > 0 ? sortedDebts[0] : null;

    // Calculate estimated payoff dates
    const debtDetails = activeDebts.map((debt) => {
      const monthlyPayment = debt.minimumPayment || 0;
      let monthsToPayoff = Infinity;

      if (monthlyPayment > 0) {
        monthsToPayoff = Math.ceil(debt.remainingBalance / monthlyPayment);
      }

      const estimatedPayoffDate = new Date();
      estimatedPayoffDate.setMonth(estimatedPayoffDate.getMonth() + monthsToPayoff);

      return {
        id: debt.id,
        name: debt.name,
        remainingBalance: debt.remainingBalance,
        minimumPayment: debt.minimumPayment,
        estimatedMonthsToPayoff: monthsToPayoff === Infinity ? null : monthsToPayoff,
        estimatedPayoffDate: monthsToPayoff === Infinity ? null : estimatedPayoffDate.toISOString(),
        interestRate: debt.interestRate,
        priority: debt.priority,
      };
    });

    return new Response(
      JSON.stringify({
        totalOriginalAmount,
        totalRemainingBalance,
        totalPaidOff,
        percentagePaidOff:
          totalOriginalAmount > 0 ? (totalPaidOff / totalOriginalAmount) * 100 : 0,
        activeDebtCount: activeDebts.length,
        paidOffDebtCount: paidOffDebts.length,
        thisMonthPayments: thisMonthTotal,
        priorityDebt: priorityDebt || null,
        debtDetails,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching debt stats:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch debt statistics' }), {
      status: 500,
    });
  }
}
