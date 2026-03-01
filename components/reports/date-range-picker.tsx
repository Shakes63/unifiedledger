'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import {
  getMonthRangeForDate,
  getRelativeLocalDateString,
  getTodayLocalDateString,
  getYearRangeForDate,
  toLocalDateString,
} from '@/lib/utils/local-date';

interface DateRangePickerProps {
  startDate: string | null;
  endDate: string | null;
  onDateChange: (startDate: string | null, endDate: string | null) => void;
}

type PresetType = 'this-month' | 'this-year' | 'last-12-months' | 'last-30-days' | 'last-90-days' | 'custom';

interface Preset {
  id: PresetType;
  label: string;
}

const PRESETS: Preset[] = [
  { id: 'this-month', label: 'This Month' },
  { id: 'this-year', label: 'This Year' },
  { id: 'last-12-months', label: 'Last 12 Months' },
  { id: 'last-30-days', label: 'Last 30 Days' },
  { id: 'last-90-days', label: 'Last 90 Days' },
];

const MAX_DATE_RANGE_DAYS = 1825; // 5 years

/**
 * Calculate preset dates
 */
function getPresetDates(preset: PresetType): { start: string; end: string } | null {
  const now = new Date();
  const today = getTodayLocalDateString();

  switch (preset) {
    case 'this-month': {
      const monthRange = getMonthRangeForDate(now);
      return {
        start: monthRange.startDate,
        end: monthRange.endDate,
      };
    }
    case 'this-year': {
      const yearRange = getYearRangeForDate(now);
      return {
        start: yearRange.startDate,
        end: yearRange.endDate,
      };
    }
    case 'last-12-months':
      const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      return {
        start: toLocalDateString(twelveMonthsAgo),
        end: today,
      };
    case 'last-30-days':
      return {
        start: getRelativeLocalDateString(-30, now),
        end: today,
      };
    case 'last-90-days':
      return {
        start: getRelativeLocalDateString(-90, now),
        end: today,
      };
    default:
      return null;
  }
}

/**
 * Detect which preset matches the current dates
 */
function detectPreset(startDate: string | null, endDate: string | null): PresetType {
  if (!startDate || !endDate) return 'custom';

  for (const preset of PRESETS) {
    const presetDates = getPresetDates(preset.id);
    if (presetDates && presetDates.start === startDate && presetDates.end === endDate) {
      return preset.id;
    }
  }

  return 'custom';
}

/**
 * DateRangePicker Component
 * Allows users to select date ranges via presets or custom date inputs
 */
export function DateRangePicker({ startDate, endDate, onDateChange }: DateRangePickerProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Derive active preset from dates (no state needed)
  const activePreset = useMemo(() => {
    if (startDate && endDate) {
      return detectPreset(startDate, endDate);
    }
    return 'custom' as PresetType;
  }, [startDate, endDate]);

  // Validate date range
  const validateDateRange = (start: string | null, end: string | null): string | null => {
    if (!start || !end) return null;

    const startDateObj = new Date(start);
    const endDateObj = new Date(end);

    if (startDateObj > endDateObj) {
      return 'Start date must be before end date';
    }

    const daysDiff = Math.ceil(
      (endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff > MAX_DATE_RANGE_DAYS) {
      return `Date range cannot exceed ${MAX_DATE_RANGE_DAYS / 365} years`;
    }

    return null;
  };

  // Handle preset selection
  const handlePresetClick = (preset: PresetType) => {
    if (preset === 'custom') {
      // Don't do anything for custom preset
      return;
    }

    const presetDates = getPresetDates(preset);
    if (presetDates) {
      setError(null);
      onDateChange(presetDates.start, presetDates.end);
    }
  };

  // Handle manual date input
  const handleStartDateChange = (value: string) => {
    const newStart = value || null;
    const newEnd = endDate;
    
    const validationError = validateDateRange(newStart, newEnd);
    setError(validationError);
    
    // Update dates (validation is shown but doesn't block typing)
    onDateChange(newStart, newEnd);
  };

  const handleEndDateChange = (value: string) => {
    const newStart = startDate;
    const newEnd = value || null;
    
    const validationError = validateDateRange(newStart, newEnd);
    setError(validationError);
    
    // Update dates (validation is shown but doesn't block typing)
    onDateChange(newStart, newEnd);
  };

  // Handle clear dates
  const handleClear = () => {
    setError(null);
    onDateChange(null, null);
  };

  return (
    <Card style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
      <CardHeader className="pb-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between hover:opacity-80 transition-opacity"
          aria-expanded={isExpanded}
          aria-label="Toggle date range picker"
        >
          <CardTitle className="text-lg font-semibold" style={{ color: 'var(--color-foreground)' }}>Date Range</CardTitle>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5" style={{ color: 'var(--color-muted-foreground)' }} />
          ) : (
            <ChevronDown className="w-5 h-5" style={{ color: 'var(--color-muted-foreground)' }} />
          )}
        </button>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Preset Buttons */}
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Date range presets"
          >
            {PRESETS.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                variant={activePreset === preset.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePresetClick(preset.id)}
                aria-pressed={activePreset === preset.id}
                aria-label={`Select ${preset.label} date range`}
                style={
                  activePreset === preset.id
                    ? { backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)', border: '1px solid var(--color-primary)' }
                    : { backgroundColor: 'var(--color-elevated)', color: 'var(--color-foreground)', border: '1px solid var(--color-border)' }
                }
              >
                {preset.label}
              </Button>
            ))}
            <Button
              type="button"
              variant={activePreset === 'custom' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePresetClick('custom')}
              aria-pressed={activePreset === 'custom'}
              aria-label="Select custom date range"
                style={
                  activePreset === 'custom'
                    ? { backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)', border: '1px solid var(--color-primary)' }
                    : { backgroundColor: 'var(--color-elevated)', color: 'var(--color-foreground)', border: '1px solid var(--color-border)' }
                }
            >
              Custom
            </Button>
          </div>

          {/* Date Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date" className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
                Start Date
              </Label>
              <Input
                id="start-date"
                name="start-date"
                type="date"
                value={startDate || ''}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className=""
                style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
                aria-label="Start date"
                aria-describedby={error ? 'date-error' : undefined}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date" className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
                End Date
              </Label>
              <Input
                id="end-date"
                name="end-date"
                type="date"
                value={endDate || ''}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className=""
                style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
                aria-label="End date"
                aria-describedby={error ? 'date-error' : undefined}
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div
              id="date-error"
              className="text-sm"
              style={{ color: 'var(--color-destructive)' }}
              role="alert"
              aria-live="polite"
            >
              {error}
            </div>
          )}

          {/* Clear Button */}
          {(startDate || endDate) && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClear}
                style={{ color: 'var(--color-muted-foreground)', border: '1px solid var(--color-border)' }}
              >
                <X className="w-4 h-4 mr-2" />
                Clear Dates
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
