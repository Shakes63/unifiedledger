import { requireAuth } from '@/lib/auth-helpers';
import { getAndVerifyHousehold } from '@/lib/api/household-auth';
import { db } from '@/lib/db';
import { debts, debtPayments } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import Decimal from 'decimal.js';

export const dynamic = 'force-dynamic';

interface StreakMilestone {
  months: number;
  label: string;
  icon: string;
}

const MILESTONES: StreakMilestone[] = [
  { months: 3, label: 'Quarter Streak', icon: 'Flame' },
  { months: 6, label: 'Half Year Streak', icon: 'Zap' },
  { months: 12, label: '1 Year Streak', icon: 'Trophy' },
  { months: 24, label: '2 Year Streak', icon: 'Award' },
  { months: 36, label: '3 Year Streak', icon: 'Gem' },
];

export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();
    const { householdId } = await getAndVerifyHousehold(request, userId);

    // 1. Get all active debts to calculate total minimum payment for this household
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
        message: 'No active debts to track payments for',
      });
    }

    const totalMinimumPayment = activeDebts.reduce(
      (sum, debt) => new Decimal(sum).plus(debt.minimumPayment || 0).toNumber(),
      0
    );

    // 2. Fetch all debt payments for this user and household
    const allPayments = await db
      .select()
      .from(debtPayments)
      .where(
        and(
          eq(debtPayments.userId, userId),
          eq(debtPayments.householdId, householdId)
        )
      )
      .orderBy(debtPayments.paymentDate);

    if (allPayments.length === 0) {
      return Response.json({
        hasDebts: true,
        hasPayments: false,
        currentStreak: 0,
        longestStreak: 0,
        isActive: false,
        message: 'Make your first payment to start your streak!',
        totalMinimumPayment,
      });
    }

    // 3. Group payments by month
    const paymentsByMonth = new Map<string, number>();

    for (const payment of allPayments) {
      const date = new Date(payment.paymentDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      const currentTotal = paymentsByMonth.get(monthKey) || 0;
      paymentsByMonth.set(
        monthKey,
        new Decimal(currentTotal).plus(payment.amount || 0).toNumber()
      );
    }

    // 4. Build monthly history (qualifying vs non-qualifying)
    const now = new Date();
    const monthlyHistory: Array<{
      month: string;
      totalPaid: number;
      qualifies: boolean;
    }> = [];

    // Get the first payment month
    const firstPaymentDate = new Date(allPayments[0].paymentDate);
    const firstPaymentMonth = new Date(firstPaymentDate.getFullYear(), firstPaymentDate.getMonth(), 1);

    // Iterate from first payment month to current month
    const currentMonth = new Date(firstPaymentMonth);
    const todayMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    while (currentMonth <= todayMonth) {
      const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
      const totalPaid = paymentsByMonth.get(monthKey) || 0;
      const qualifies = totalPaid >= totalMinimumPayment;

      monthlyHistory.push({
        month: monthKey,
        totalPaid,
        qualifies,
      });

      // Move to next month
      currentMonth.setMonth(currentMonth.getMonth() + 1);
    }

    // 5. Calculate current streak (from most recent backward)
    let currentStreak = 0;
    for (let i = monthlyHistory.length - 1; i >= 0; i--) {
      if (monthlyHistory[i].qualifies) {
        currentStreak++;
      } else {
        break; // Streak broken
      }
    }

    // Current streak is only "active" if the most recent month qualifies
    const isActive = monthlyHistory.length > 0 && monthlyHistory[monthlyHistory.length - 1].qualifies;

    // 6. Calculate longest streak ever
    let longestStreak = 0;
    let tempStreak = 0;
    const streakHistory: Array<{ startMonth: string; endMonth: string; months: number }> = [];
    let streakStart: string | null = null;

    for (const month of monthlyHistory) {
      if (month.qualifies) {
        if (tempStreak === 0) {
          streakStart = month.month;
        }
        tempStreak++;
      } else {
        if (tempStreak > 0 && streakStart) {
          // Streak ended
          const prevIndex = monthlyHistory.indexOf(month) - 1;
          const endMonth = prevIndex >= 0 ? monthlyHistory[prevIndex].month : streakStart;

          streakHistory.push({
            startMonth: streakStart,
            endMonth,
            months: tempStreak,
          });

          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 0;
          streakStart = null;
        }
      }
    }

    // Handle ongoing streak at the end
    if (tempStreak > 0 && streakStart) {
      const endMonth = monthlyHistory[monthlyHistory.length - 1].month;
      streakHistory.push({
        startMonth: streakStart,
        endMonth,
        months: tempStreak,
      });
      longestStreak = Math.max(longestStreak, tempStreak);
    }

    // 7. Determine next milestone
    const nextMilestoneData = MILESTONES.find(m => m.months > currentStreak);
    const nextMilestone = nextMilestoneData
      ? {
          months: nextMilestoneData.months,
          label: nextMilestoneData.label,
          icon: nextMilestoneData.icon,
          remaining: nextMilestoneData.months - currentStreak,
        }
      : null;

    // 8. Get achieved milestones
    const achievements = MILESTONES.filter(m => longestStreak >= m.months).map(m => ({
      milestone: m.months,
      label: m.label,
      icon: m.icon,
      achieved: currentStreak >= m.months || longestStreak >= m.months,
      currentlyActive: currentStreak >= m.months,
    }));

    // 9. Get last payment date and next payment due
    const lastPayment = allPayments[allPayments.length - 1];
    const lastPaymentDate = lastPayment.paymentDate;

    // Next payment is due at the start of next month
    const nextDueDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    return Response.json({
      hasDebts: true,
      hasPayments: true,
      currentStreak,
      longestStreak,
      isActive,
      lastPaymentDate,
      nextPaymentDue: nextDueDate.toISOString().split('T')[0],
      totalMinimumPayment,
      nextMilestone,
      achievements,
      streakHistory: streakHistory.map(sh => ({
        ...sh,
        startDate: `${sh.startMonth}-01`,
        endDate: `${sh.endMonth}-01`,
      })),
      monthlyQualification: monthlyHistory.slice(-12), // Last 12 months
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Household ID')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error('Payment streak error:', error);
    return Response.json(
      { error: 'Failed to calculate payment streak' },
      { status: 500 }
    );
  }
}
