'use client';

import { isToday, isSameMonth, format } from 'date-fns';
import { TransactionIndicators } from './transaction-indicators';
import { Check, Target, CreditCard, Trophy } from 'lucide-react';

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

interface DayTransactionSummary {
  incomeCount: number;
  expenseCount: number;
  transferCount: number;
  totalSpent: number;
  billDueCount: number;
  billOverdueCount: number;
  bills?: Array<{ name: string; status: string; amount: number }>;
  goalCount: number;
  goals?: GoalSummary[];
  debtCount: number;
  debts?: DebtSummary[];
}

interface CalendarDayProps {
  date: Date;
  currentMonth: Date;
  summary?: DayTransactionSummary;
  onClick?: (date: Date) => void;
}

export function CalendarDay({
  date,
  currentMonth,
  summary,
  onClick,
}: CalendarDayProps) {
  const isCurrentMonth = isSameMonth(date, currentMonth);
  const isTodayDate = isToday(date);
  const hasActivity = summary && (
    summary.incomeCount > 0 ||
    summary.expenseCount > 0 ||
    summary.transferCount > 0 ||
    summary.billDueCount > 0 ||
    summary.billOverdueCount > 0 ||
    (summary.bills && summary.bills.length > 0) ||
    summary.goalCount > 0 ||
    (summary.goals && summary.goals.length > 0) ||
    summary.debtCount > 0 ||
    (summary.debts && summary.debts.length > 0)
  );

  return (
    <button
      onClick={() => onClick?.(date)}
      className={`h-32 p-2 border-2 rounded-lg transition-all text-left flex flex-col ${
        !isCurrentMonth
          ? 'bg-elevated/50 border-border/50 text-muted-foreground opacity-60'
          : isTodayDate
          ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] shadow-lg shadow-[var(--color-primary)]/20'
          : 'bg-card border-border hover:border-border hover:bg-elevated'
      }`}
    >
      {/* Date Number */}
      <span
        className={`text-sm font-bold mb-2 ${
          isTodayDate 
            ? 'text-[var(--color-primary)]' 
            : !isCurrentMonth 
            ? 'text-muted-foreground' 
            : 'text-foreground'
        }`}
      >
        {format(date, 'd')}
      </span>

      {/* Bills, Goals, and Indicators */}
      {hasActivity && summary && (
        <div className="flex-1 overflow-hidden flex flex-col gap-1">
          {/* Bill Names */}
          {summary.bills && summary.bills.length > 0 && (
            <div className="space-y-0.5">
              {summary.bills.map((bill, idx) => (
                <div
                  key={`${bill.name}-${bill.amount}-${idx}`}
                  className={`text-[10px] px-1.5 py-0.5 rounded truncate flex items-center gap-0.5 ${
                    bill.status === 'overdue'
                      ? 'bg-[var(--color-error)]/20 text-[var(--color-error)] font-semibold'
                      : bill.status === 'paid'
                      ? 'bg-[var(--color-income)]/20 text-[var(--color-income)]'
                      : 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]'
                  }`}
                  title={`${bill.name} - $${bill.amount.toFixed(2)}${bill.status === 'paid' ? ' (Paid)' : ''}`}
                >
                  {bill.status === 'paid' && <Check className="w-2.5 h-2.5 shrink-0" />}
                  <span className="truncate">{bill.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Goal Deadlines */}
          {summary.goals && summary.goals.length > 0 && (
            <div className="space-y-0.5">
              {summary.goals.map((goal) => (
                <div
                  key={goal.id}
                  className="text-[10px] px-1.5 py-0.5 rounded truncate flex items-center gap-0.5"
                  style={{
                    backgroundColor: `${goal.color}20`,
                    color: goal.color,
                  }}
                  title={`${goal.name} - ${goal.progress}% complete ($${goal.currentAmount.toLocaleString()} / $${goal.targetAmount.toLocaleString()})`}
                >
                  <Target className="w-2.5 h-2.5 shrink-0" />
                  <span className="truncate">{goal.name}</span>
                  <span className="text-[9px] ml-auto shrink-0">{goal.progress}%</span>
                </div>
              ))}
            </div>
          )}

          {/* Debt Milestones */}
          {summary.debts && summary.debts.length > 0 && (
            <div className="space-y-0.5">
              {summary.debts.map((debt) => (
                <div
                  key={debt.id}
                  className="text-[10px] px-1.5 py-0.5 rounded truncate flex items-center gap-0.5"
                  style={{
                    backgroundColor: `${debt.color}20`,
                    color: debt.color,
                  }}
                  title={`${debt.name} - ${debt.progress}% paid off ($${(debt.originalAmount - debt.remainingBalance).toLocaleString()} / $${debt.originalAmount.toLocaleString()})`}
                >
                  {debt.type === 'milestone' ? (
                    <Trophy className="w-2.5 h-2.5 shrink-0" />
                  ) : (
                    <CreditCard className="w-2.5 h-2.5 shrink-0" />
                  )}
                  <span className="truncate">{debt.name}</span>
                  <span className="text-[9px] ml-auto shrink-0">{debt.progress}%</span>
                </div>
              ))}
            </div>
          )}

          {/* Transaction Counts */}
          <TransactionIndicators
            incomeCount={summary.incomeCount}
            expenseCount={summary.expenseCount}
            transferCount={summary.transferCount}
            billDueCount={0}
            billOverdueCount={0}
            goalCount={0}
            debtCount={0}
            totalSpent={summary.totalSpent}
            compact
          />
        </div>
      )}

      {/* Empty State */}
      {!hasActivity && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground text-xs text-center">
            No activity
          </p>
        </div>
      )}
    </button>
  );
}
