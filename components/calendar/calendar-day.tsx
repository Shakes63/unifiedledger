'use client';

import { isToday, isSameMonth, format } from 'date-fns';
import { TransactionIndicators } from './transaction-indicators';

interface DayTransactionSummary {
  incomeCount: number;
  expenseCount: number;
  transferCount: number;
  totalSpent: number;
  billDueCount: number;
  billOverdueCount: number;
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
    summary.billOverdueCount > 0
  );

  return (
    <button
      onClick={() => onClick?.(date)}
      className={`h-32 p-2 border-2 rounded-lg transition-all text-left flex flex-col ${
        !isCurrentMonth
          ? 'bg-[#0a0a0a] border-[#1a1a1a] text-[#6b7280]'
          : isTodayDate
          ? 'bg-blue-500/10 border-blue-400 shadow-lg shadow-blue-500/20'
          : 'bg-[#1a1a1a] border-[#2a2a2a] hover:border-[#3a3a3a] hover:bg-[#242424]'
      }`}
    >
      {/* Date Number */}
      <span
        className={`text-sm font-bold mb-2 ${
          isTodayDate ? 'text-blue-400' : 'text-white'
        }`}
      >
        {format(date, 'd')}
      </span>

      {/* Indicators */}
      {hasActivity && summary && (
        <div className="flex-1 overflow-hidden">
          <TransactionIndicators
            incomeCount={summary.incomeCount}
            expenseCount={summary.expenseCount}
            transferCount={summary.transferCount}
            billDueCount={summary.billDueCount}
            billOverdueCount={summary.billOverdueCount}
            totalSpent={summary.totalSpent}
            compact
          />
        </div>
      )}

      {/* Empty State */}
      {!hasActivity && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[#6b7280] text-xs text-center">
            No activity
          </p>
        </div>
      )}
    </button>
  );
}
