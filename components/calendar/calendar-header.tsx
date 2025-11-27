'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  addDays,
  subMonths,
  addMonths,
  addWeeks,
  subWeeks,
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
  const _tomorrow = addDays(today, 1);

  const _handleQuickDate = (_targetDate: Date) => {
    onDateChange(_targetDate);
  };

  return (
    <div className="space-y-4">
      {/* Month/Week Navigation Bar - At the very top */}
      <div className="flex items-center justify-between bg-card border border-border rounded-lg p-3">
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            onDateChange(viewMode === 'month' ? subMonths(currentDate, 1) : subWeeks(currentDate, 1))
          }
          className="text-muted-foreground hover:text-foreground hover:bg-elevated"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <h2 className="text-xl font-bold text-foreground">
          {format(currentDate, 'MMMM yyyy')}
        </h2>

        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            onDateChange(viewMode === 'month' ? addMonths(currentDate, 1) : addWeeks(currentDate, 1))
          }
          className="text-muted-foreground hover:text-foreground hover:bg-elevated"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Month/Week View Buttons - Below the navigation bar */}
      <div className="flex gap-2 justify-center">
        <Button
          size="sm"
          variant={viewMode === 'month' ? 'default' : 'outline'}
          onClick={() => onViewModeChange('month')}
          className={
            viewMode === 'month'
              ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90'
              : 'border-border text-muted-foreground hover:bg-elevated'
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
              ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90'
              : 'border-border text-muted-foreground hover:bg-elevated'
          }
        >
          Week
        </Button>
      </div>
    </div>
  );
}
