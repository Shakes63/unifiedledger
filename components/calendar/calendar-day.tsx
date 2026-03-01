'use client';

import { isToday, isSameMonth, format } from 'date-fns';
import { TransactionIndicators } from './transaction-indicators';
import { Check, Target, CreditCard, Trophy, Clock, TrendingDown } from 'lucide-react';

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

interface AutopayEvent {
  id: string;
  billId: string;
  billName: string;
  amount: number;
  autopayAmountType: 'fixed' | 'minimum_payment' | 'statement_balance' | 'full_balance';
  sourceAccountId: string;
  sourceAccountName: string;
  linkedAccountName?: string;
}

interface UnifiedPayoffDate {
  id: string;
  name: string;
  source: 'account' | 'bill';
  sourceType: string;
  remainingBalance: number;
  monthlyPayment: number;
  color?: string;
}

interface BillMilestone {
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
  autopayEvents?: AutopayEvent[];
  payoffDateCount: number;
  payoffDates?: UnifiedPayoffDate[];
  billMilestoneCount: number;
  billMilestones?: BillMilestone[];
}

interface CalendarDayProps {
  date: Date;
  currentMonth: Date;
  summary?: DayTransactionSummary;
  onClick?: (date: Date) => void;
  cellBorderRight?: string;
}

export function CalendarDay({
  date,
  currentMonth,
  summary,
  onClick,
  cellBorderRight,
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
    (summary.debts && summary.debts.length > 0) ||
    summary.autopayCount > 0 ||
    (summary.autopayEvents && summary.autopayEvents.length > 0) ||
    summary.payoffDateCount > 0 ||
    (summary.payoffDates && summary.payoffDates.length > 0) ||
    summary.billMilestoneCount > 0 ||
    (summary.billMilestones && summary.billMilestones.length > 0)
  );

  return (
    <button
      onClick={() => onClick?.(date)}
      className={`h-28 sm:h-32 p-1 sm:p-1.5 text-left flex flex-col transition-colors ${
        !isCurrentMonth ? 'opacity-35' : 'hover:bg-elevated/50'
      }`}
      style={{
        borderRight: cellBorderRight || 'none',
        ...(isTodayDate && {
          backgroundColor: 'color-mix(in oklch, var(--color-primary) 6%, transparent)',
        }),
      }}
    >
      {/* Date number */}
      <div className="mb-0.5">
        {isTodayDate ? (
          <span
            className="inline-flex items-center justify-center w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full text-[10px] sm:text-xs font-bold"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-primary-foreground)',
            }}
          >
            {format(date, 'd')}
          </span>
        ) : (
          <span
            className={`text-[10px] sm:text-xs font-medium pl-0.5 ${
              !isCurrentMonth ? 'text-muted-foreground' : 'text-foreground'
            }`}
          >
            {format(date, 'd')}
          </span>
        )}
      </div>

      {/* Events */}
      {hasActivity && summary && (
        <div className="flex-1 overflow-hidden flex flex-col gap-px">
          {/* Bills */}
          {summary.bills && summary.bills.length > 0 && (
            <div className="space-y-px">
              {summary.bills
                .sort((a, b) => {
                  const statusOrder = { overdue: 0, pending: 1, paid: 2 };
                  return (statusOrder[a.status as keyof typeof statusOrder] || 2) -
                         (statusOrder[b.status as keyof typeof statusOrder] || 2);
                })
                .slice(0, 3)
                .map((bill, idx) => (
                <div
                  key={`${bill.name}-${bill.amount}-${idx}`}
                  className="text-[9px] leading-tight px-1 py-px rounded-sm truncate flex items-center gap-0.5"
                  style={{
                    backgroundColor: bill.status === 'overdue'
                      ? 'color-mix(in oklch, var(--color-error) 15%, transparent)'
                      : bill.status === 'paid'
                      ? 'color-mix(in oklch, var(--color-income) 15%, transparent)'
                      : 'color-mix(in oklch, var(--color-warning) 15%, transparent)',
                    color: bill.status === 'overdue'
                      ? 'var(--color-error)'
                      : bill.status === 'paid'
                      ? 'var(--color-income)'
                      : 'var(--color-warning)',
                  }}
                  title={`${bill.name} - $${bill.amount.toFixed(2)}${bill.status === 'paid' ? ' (Paid)' : ''}${bill.linkedAccountName ? ` (${bill.linkedAccountName})` : ''}`}
                >
                  {bill.status === 'paid' && <Check className="w-2 h-2 shrink-0" />}
                  {bill.linkedAccountName && <CreditCard className="w-2 h-2 shrink-0" />}
                  <span className="truncate">{bill.name}</span>
                </div>
              ))}
              {summary.bills.length > 3 && (
                <span className="text-[8px] pl-1" style={{ color: 'var(--color-muted-foreground)' }}>+{summary.bills.length - 3} more</span>
              )}
            </div>
          )}

          {/* Autopay */}
          {summary.autopayEvents && summary.autopayEvents.length > 0 && (
            <div className="space-y-px">
              {summary.autopayEvents.slice(0, 2).map((autopay) => (
                <div
                  key={autopay.id}
                  className="text-[9px] leading-tight px-1 py-px rounded-sm truncate flex items-center gap-0.5"
                  style={{
                    backgroundColor: 'color-mix(in oklch, var(--color-primary) 12%, transparent)',
                    color: 'var(--color-primary)',
                  }}
                  title={`Autopay: ${autopay.billName} - $${autopay.amount.toFixed(2)} from ${autopay.sourceAccountName}`}
                >
                  <Clock className="w-2 h-2 shrink-0" />
                  <span className="truncate">{autopay.billName}</span>
                </div>
              ))}
            </div>
          )}

          {/* Goals */}
          {summary.goals && summary.goals.length > 0 && (
            <div className="space-y-px">
              {summary.goals.slice(0, 2).map((goal) => (
                <div
                  key={goal.id}
                  className="text-[9px] leading-tight px-1 py-px rounded-sm truncate flex items-center gap-0.5"
                  style={{
                    backgroundColor: `color-mix(in oklch, ${goal.color} 12%, transparent)`,
                    color: goal.color,
                  }}
                  title={`${goal.name} - ${goal.progress}% ($${goal.currentAmount.toLocaleString()} / $${goal.targetAmount.toLocaleString()})`}
                >
                  <Target className="w-2 h-2 shrink-0" />
                  <span className="truncate">{goal.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Payoff dates */}
          {summary.payoffDates && summary.payoffDates.length > 0 && (
            <div className="space-y-px">
              {summary.payoffDates.slice(0, 2).map((payoff) => (
                <div
                  key={payoff.id}
                  className="text-[9px] leading-tight px-1 py-px rounded-sm truncate flex items-center gap-0.5"
                  style={{
                    backgroundColor: `color-mix(in oklch, ${payoff.color || 'var(--color-error)'} 12%, transparent)`,
                    color: payoff.color || 'var(--color-error)',
                  }}
                  title={`${payoff.name} payoff - $${payoff.remainingBalance.toLocaleString()} remaining`}
                >
                  <TrendingDown className="w-2 h-2 shrink-0" />
                  <span className="truncate">{payoff.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Debt milestones */}
          {summary.debts && summary.debts.length > 0 && (
            <div className="space-y-px">
              {summary.debts.slice(0, 2).map((debt) => (
                <div
                  key={debt.id}
                  className="text-[9px] leading-tight px-1 py-px rounded-sm truncate flex items-center gap-0.5"
                  style={{
                    backgroundColor: `color-mix(in oklch, ${debt.color} 12%, transparent)`,
                    color: debt.color,
                  }}
                  title={`${debt.name} - ${debt.progress}% paid`}
                >
                  {debt.type === 'milestone' ? (
                    <Trophy className="w-2 h-2 shrink-0" />
                  ) : (
                    <CreditCard className="w-2 h-2 shrink-0" />
                  )}
                  <span className="truncate">{debt.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Bill milestones */}
          {summary.billMilestones && summary.billMilestones.length > 0 && (
            <div className="space-y-px">
              {summary.billMilestones.slice(0, 2).map((milestone) => (
                <div
                  key={milestone.id}
                  className="text-[9px] leading-tight px-1 py-px rounded-sm truncate flex items-center gap-0.5"
                  style={{
                    backgroundColor: `color-mix(in oklch, ${milestone.color || 'var(--color-success)'} 12%, transparent)`,
                    color: milestone.color || 'var(--color-success)',
                  }}
                  title={`${milestone.name} - ${milestone.percentage}% milestone`}
                >
                  <Trophy className="w-2 h-2 shrink-0" />
                  <span className="truncate">{milestone.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Transaction indicators */}
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
    </button>
  );
}
