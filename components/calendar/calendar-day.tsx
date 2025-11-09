'use client';

import { isToday, isSameMonth, format } from 'date-fns';
import { TransactionIndicators } from './transaction-indicators';
import { Check } from 'lucide-react';

interface DayTransactionSummary {
  incomeCount: number;
  expenseCount: number;
  transferCount: number;
  totalSpent: number;
  billDueCount: number;
  billOverdueCount: number;
  bills?: Array<{ name: string; status: string; amount: number }>;
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
    (summary.bills && summary.bills.length > 0)
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

      {/* Bills and Indicators */}
      {hasActivity && summary && (
        <div className="flex-1 overflow-hidden flex flex-col gap-1">
          {/* Bill Names */}
          {summary.bills && summary.bills.length > 0 && (
            <div className="space-y-0.5">
              {summary.bills.map((bill, idx) => (
                <div
                  key={idx}
                  className={`text-[10px] px-1.5 py-0.5 rounded truncate flex items-center gap-0.5 ${
                    bill.status === 'overdue'
                      ? 'bg-red-600/20 text-red-500 font-semibold'
                      : bill.status === 'paid'
                      ? 'bg-emerald-400/20 text-emerald-400'
                      : 'bg-amber-400/20 text-amber-400'
                  }`}
                  title={`${bill.name} - $${bill.amount.toFixed(2)}${bill.status === 'paid' ? ' (Paid)' : ''}`}
                >
                  {bill.status === 'paid' && <Check className="w-2.5 h-2.5 shrink-0" />}
                  <span className="truncate">{bill.name}</span>
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
