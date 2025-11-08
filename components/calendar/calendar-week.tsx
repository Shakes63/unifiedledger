'use client';

import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isToday,
} from 'date-fns';
import { TransactionIndicators } from './transaction-indicators';

interface DayTransactionSummary {
  incomeCount: number;
  expenseCount: number;
  transferCount: number;
  totalSpent: number;
  billDueCount: number;
  billOverdueCount: number;
}

interface CalendarWeekProps {
  currentDate: Date;
  daySummaries?: Record<string, DayTransactionSummary>;
  onDayClick?: (date: Date) => void;
}

export function CalendarWeek({
  currentDate,
  daySummaries = {},
  onDayClick,
}: CalendarWeekProps) {
  const weekStart = startOfWeek(currentDate);
  const weekEnd = endOfWeek(currentDate);
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  return (
    <div className="space-y-4">
      {/* Week date range */}
      <div className="text-center text-[#9ca3af] text-sm mb-4">
        {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const dayKey = format(day, 'yyyy-MM-dd');
          const summary = daySummaries[dayKey];
          const isTodayDate = isToday(day);
          const hasActivity = summary && (
            summary.incomeCount > 0 ||
            summary.expenseCount > 0 ||
            summary.transferCount > 0 ||
            summary.billDueCount > 0 ||
            summary.billOverdueCount > 0
          );

          return (
            <button
              key={dayKey}
              onClick={() => onDayClick?.(day)}
              className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-3 ${
                isTodayDate
                  ? 'bg-blue-500/10 border-blue-400 shadow-lg shadow-blue-500/20'
                  : 'bg-[#1a1a1a] border-[#2a2a2a] hover:border-[#3a3a3a] hover:bg-[#242424]'
              }`}
            >
              {/* Day name and date */}
              <div className="text-center w-full">
                <p className="text-xs text-[#6b7280] font-medium">
                  {format(day, 'EEE')}
                </p>
                <p
                  className={`text-lg font-bold ${
                    isTodayDate ? 'text-blue-400' : 'text-white'
                  }`}
                >
                  {format(day, 'd')}
                </p>
              </div>

              {/* Indicators */}
              {hasActivity && summary && (
                <div className="w-full border-t border-[#2a2a2a] pt-3">
                  <div className="text-xs space-y-1">
                    {summary.incomeCount > 0 && (
                      <div className="flex items-center justify-center gap-1 text-emerald-400">
                        <span className="font-semibold">
                          +{summary.incomeCount}
                        </span>
                      </div>
                    )}
                    {summary.expenseCount > 0 && (
                      <div className="flex items-center justify-center gap-1 text-red-400">
                        <span className="font-semibold">
                          -{summary.expenseCount}
                        </span>
                      </div>
                    )}
                    {summary.transferCount > 0 && (
                      <div className="flex items-center justify-center gap-1 text-blue-400">
                        <span className="font-semibold">
                          ↔{summary.transferCount}
                        </span>
                      </div>
                    )}
                    {summary.billDueCount > 0 && (
                      <div className="flex items-center justify-center gap-1 text-amber-400">
                        <span className="font-semibold">
                          📋{summary.billDueCount}
                        </span>
                      </div>
                    )}
                    {summary.billOverdueCount > 0 && (
                      <div className="flex items-center justify-center gap-1 text-red-500">
                        <span className="font-semibold">
                          ⚠{summary.billOverdueCount}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
