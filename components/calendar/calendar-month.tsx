'use client';

import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
} from 'date-fns';
import { CalendarDay } from './calendar-day';

interface GoalSummary {
  id: string;
  name: string;
  color: string;
  targetAmount: number;
  currentAmount: number;
  progress: number;
  status: string;
}

interface DebtSummary {
  id: string;
  name: string;
  color: string;
  remainingBalance: number;
  originalAmount: number;
  progress: number;
  type: 'target' | 'milestone';
  milestonePercentage?: number;
  status: string;
}

interface AutopayEventSummary {
  id: string;
  billId: string;
  billName: string;
  amount: number;
  autopayAmountType: 'fixed' | 'minimum_payment' | 'statement_balance' | 'full_balance';
  sourceAccountId: string;
  sourceAccountName: string;
  linkedAccountName?: string;
}

interface UnifiedPayoffDateSummary {
  id: string;
  name: string;
  source: 'account' | 'bill';
  sourceType: string;
  remainingBalance: number;
  monthlyPayment: number;
  color?: string;
}

interface BillMilestoneSummary {
  id: string;
  billId?: string;
  accountId?: string;
  name: string;
  percentage: number;
  achievedAt?: string;
  color?: string;
}

interface DayTransactionSummary {
  incomeCount: number;
  expenseCount: number;
  transferCount: number;
  totalSpent: number;
  billDueCount: number;
  billOverdueCount: number;
  bills?: Array<{
    name: string;
    status: string;
    amount: number;
    isDebt?: boolean;
    isAutopayEnabled?: boolean;
    linkedAccountName?: string;
  }>;
  goalCount: number;
  goals?: GoalSummary[];
  debtCount: number;
  debts?: DebtSummary[];
  autopayCount: number;
  autopayEvents?: AutopayEventSummary[];
  payoffDateCount: number;
  payoffDates?: UnifiedPayoffDateSummary[];
  billMilestoneCount: number;
  billMilestones?: BillMilestoneSummary[];
}

interface CalendarMonthProps {
  currentMonth: Date;
  daySummaries?: Record<string, DayTransactionSummary>;
  onDayClick?: (date: Date) => void;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CalendarMonth({
  currentMonth,
  daySummaries = {},
  onDayClick,
}: CalendarMonthProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const weekStart = startOfWeek(monthStart);
  const weekEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const borderStyle = '1px solid color-mix(in oklch, var(--color-border) 35%, transparent)';

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
    >
      {/* Day names header */}
      <div
        className="grid grid-cols-7"
        style={{
          borderBottom: '1px solid var(--color-border)',
          backgroundColor: 'color-mix(in oklch, var(--color-elevated) 40%, transparent)',
        }}
      >
        {DAY_NAMES.map((day, i) => (
          <div
            key={day}
            className="text-center text-[11px] font-semibold uppercase tracking-widest py-2"
            style={{
              color: 'var(--color-muted-foreground)',
              borderRight: i < 6 ? borderStyle : 'none',
            }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Week rows */}
      {weeks.map((week, weekIndex) => (
        <div
          key={weekIndex}
          className="grid grid-cols-7 calendar-row-enter"
          style={{
            animationDelay: `${weekIndex * 40}ms`,
            borderBottom: weekIndex < weeks.length - 1 ? borderStyle : 'none',
          }}
        >
          {week.map((day, dayIdx) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const summary = daySummaries[dayKey];

            return (
              <CalendarDay
                key={dayKey}
                date={day}
                currentMonth={currentMonth}
                summary={summary}
                onClick={onDayClick}
                cellBorderRight={dayIdx < 6 ? borderStyle : undefined}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
