'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
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
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {/* Month/Week navigation */}
      <div className="flex items-center gap-0.5">
        <Button
          size="icon"
          variant="ghost"
          onClick={() =>
            onDateChange(viewMode === 'month' ? subMonths(currentDate, 1) : subWeeks(currentDate, 1))
          }
          className="h-7 w-7 rounded-full"
          style={{ color: 'var(--color-muted-foreground)' }}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
        <span className="text-sm font-semibold min-w-[110px] sm:min-w-[130px] text-center tabular-nums" style={{ color: 'var(--color-foreground)' }}>
          {format(currentDate, 'MMM yyyy')}
        </span>
        <Button
          size="icon"
          variant="ghost"
          onClick={() =>
            onDateChange(viewMode === 'month' ? addMonths(currentDate, 1) : addWeeks(currentDate, 1))
          }
          className="h-7 w-7 rounded-full"
          style={{ color: 'var(--color-muted-foreground)' }}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* View toggle */}
      <div
        className="flex rounded-lg overflow-hidden"
        style={{ border: '1px solid var(--color-border)' }}
      >
        <button
          onClick={() => onViewModeChange('month')}
          className="px-2.5 py-1 text-[11px] font-medium transition-colors"
          style={{
            backgroundColor: viewMode === 'month' ? 'var(--color-primary)' : 'transparent',
            color: viewMode === 'month' ? 'var(--color-primary-foreground)' : 'var(--color-muted-foreground)',
          }}
        >
          Month
        </button>
        <button
          onClick={() => onViewModeChange('week')}
          className="px-2.5 py-1 text-[11px] font-medium transition-colors"
          style={{
            backgroundColor: viewMode === 'week' ? 'var(--color-primary)' : 'transparent',
            color: viewMode === 'week' ? 'var(--color-primary-foreground)' : 'var(--color-muted-foreground)',
            borderLeft: '1px solid var(--color-border)',
          }}
        >
          Week
        </button>
      </div>
    </div>
  );
}
