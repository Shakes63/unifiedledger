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

interface DayTransactionSummary {
  incomeCount: number;
  expenseCount: number;
  transferCount: number;
  totalSpent: number;
  billDueCount: number;
  billOverdueCount: number;
}

interface CalendarMonthProps {
  currentMonth: Date;
  daySummaries?: Record<string, DayTransactionSummary>;
  onDayClick?: (date: Date) => void;
}

export function CalendarMonth({
  currentMonth,
  daySummaries = {},
  onDayClick,
}: CalendarMonthProps) {
  // Get the start of the first week and end of the last week
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const weekStart = startOfWeek(monthStart);
  const weekEnd = endOfWeek(monthEnd);

  // Get all days to display
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Organize days into weeks
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div className="space-y-4">
      {/* Day names header */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
          (day) => (
            <div
              key={day}
              className="text-center text-[#9ca3af] font-semibold text-sm py-2"
            >
              {day}
            </div>
          )
        )}
      </div>

      {/* Weeks */}
      <div className="space-y-2">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 gap-2">
            {week.map((day) => {
              const dayKey = format(day, 'yyyy-MM-dd');
              const summary = daySummaries[dayKey];

              return (
                <CalendarDay
                  key={dayKey}
                  date={day}
                  currentMonth={currentMonth}
                  summary={summary}
                  onClick={onDayClick}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
