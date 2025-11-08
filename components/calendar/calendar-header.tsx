'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  isToday,
  isTomorrow,
  addDays,
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
  format,
} from 'date-fns';

interface CalendarHeaderProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  viewMode: 'month' | 'week';
  onViewModeChange: (mode: 'month' | 'week') => void;
}

export function CalendarHeader({
  currentDate,
  onDateChange,
  viewMode,
  onViewModeChange,
}: CalendarHeaderProps) {
  const today = new Date();
  const tomorrow = addDays(today, 1);

  const handleQuickDate = (targetDate: Date) => {
    onDateChange(targetDate);
  };

  return (
    <div className="space-y-4">
      {/* Month/Year and Navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <p className="text-[#6b7280] text-sm">
            {viewMode === 'month' ? 'Month View' : 'Week View'}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant={viewMode === 'month' ? 'default' : 'outline'}
            onClick={() => onViewModeChange('month')}
            className={
              viewMode === 'month'
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'border-[#2a2a2a] text-[#9ca3af] hover:bg-[#242424]'
            }
          >
            Month
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'week' ? 'default' : 'outline'}
            onClick={() => onViewModeChange('week')}
            className={
              viewMode === 'week'
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'border-[#2a2a2a] text-[#9ca3af] hover:bg-[#242424]'
            }
          >
            Week
          </Button>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3">
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            onDateChange(subMonths(currentDate, 1))
          }
          className="text-[#9ca3af] hover:text-white hover:bg-[#242424]"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <span className="text-[#9ca3af] text-sm font-medium">
          {format(currentDate, 'MMM d, yyyy')}
        </span>

        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            onDateChange(addMonths(currentDate, 1))
          }
          className="text-[#9ca3af] hover:text-white hover:bg-[#242424]"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Quick Navigation */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => handleQuickDate(today)}
          className={
            isToday(currentDate)
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-[#242424] text-[#9ca3af] hover:bg-[#2a2a2a] border border-[#2a2a2a]'
          }
        >
          Today
        </Button>
        <Button
          size="sm"
          onClick={() => handleQuickDate(tomorrow)}
          className={
            isTomorrow(currentDate)
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-[#242424] text-[#9ca3af] hover:bg-[#2a2a2a] border border-[#2a2a2a]'
          }
        >
          Tomorrow
        </Button>
        <Button
          size="sm"
          onClick={() => handleQuickDate(addDays(today, 7))}
          className="bg-[#242424] text-[#9ca3af] hover:bg-[#2a2a2a] border border-[#2a2a2a]"
        >
          Next Week
        </Button>
        <Button
          size="sm"
          onClick={() =>
            handleQuickDate(startOfMonth(currentDate))
          }
          className="bg-[#242424] text-[#9ca3af] hover:bg-[#2a2a2a] border border-[#2a2a2a]"
        >
          Start of Month
        </Button>
      </div>
    </div>
  );
}
