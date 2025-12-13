'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, ChevronUp, X } from 'lucide-react';

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
  const today = now.toISOString().split('T')[0];

  switch (preset) {
    case 'this-month':
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
      };
    case 'this-year':
      return {
        start: new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0],
        end: new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0],
      };
    case 'last-12-months':
      const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      return {
        start: twelveMonthsAgo.toISOString().split('T')[0],
        end: today,
      };
    case 'last-30-days':
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return {
        start: thirtyDaysAgo.toISOString().split('T')[0],
        end: today,
      };
    case 'last-90-days':
      const ninetyDaysAgo = new Date(now);
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      return {
        start: ninetyDaysAgo.toISOString().split('T')[0],
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
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between hover:opacity-80 transition-opacity"
          aria-expanded={isExpanded}
          aria-label="Toggle date range picker"
        >
          <CardTitle className="text-lg font-semibold text-foreground">Date Range</CardTitle>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
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
                className={
                  activePreset === preset.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-elevated text-foreground border-border hover:bg-elevated'
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
              className={
                activePreset === 'custom'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-elevated text-foreground border-border hover:bg-elevated'
              }
            >
              Custom
            </Button>
          </div>

          {/* Date Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date" className="text-sm font-medium text-foreground">
                Start Date
              </Label>
              <Input
                id="start-date"
                name="start-date"
                type="date"
                value={startDate || ''}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="bg-elevated border-border text-foreground"
                aria-label="Start date"
                aria-describedby={error ? 'date-error' : undefined}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date" className="text-sm font-medium text-foreground">
                End Date
              </Label>
              <Input
                id="end-date"
                name="end-date"
                type="date"
                value={endDate || ''}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="bg-elevated border-border text-foreground"
                aria-label="End date"
                aria-describedby={error ? 'date-error' : undefined}
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div
              id="date-error"
              className="text-sm text-error"
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
                className="text-muted-foreground border-border hover:bg-elevated"
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

