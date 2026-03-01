'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowRight, TrendingDown } from 'lucide-react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';

interface CountdownData {
  hasDebts: boolean;
  totalMonthsRemaining: number;
  percentageComplete: number;
  debtFreeDate: string;
  totalRemainingBalance: number;
}

export function DebtCountdownCard() {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [data, setData] = useState<CountdownData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCountdownData = useCallback(async () => {
    if (!selectedHouseholdId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetchWithHousehold('/api/debts/countdown');

      // Handle expected error responses gracefully (don't log as errors)
      if (response.status === 400 || response.status === 401 || response.status === 403) {
        // Auth/household issues - just show no data state
        setData(null);
        return;
      }

      if (!response.ok) {
        // Only log unexpected errors (5xx)
        console.error('Error fetching debt countdown: HTTP', response.status);
        setData(null);
        return;
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      // Network errors or "No household selected" from the hook
      if (err instanceof Error && err.message === 'No household selected') {
        // Expected case - silently handle
        setData(null);
        return;
      }
      console.error('Error fetching debt countdown:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedHouseholdId, fetchWithHousehold]);

  useEffect(() => {
    fetchCountdownData();
  }, [fetchCountdownData]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  // Loading state
  if (loading) {
    return (
      <div className="h-full flex flex-col animate-pulse">
        <div className="py-2 px-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--color-elevated)' }} />
            <div className="h-3 rounded w-20" style={{ backgroundColor: 'var(--color-elevated)' }} />
          </div>
        </div>
        <div className="flex-1 flex items-center gap-4 p-4">
          <div className="shrink-0 relative flex items-center justify-center" style={{ width: 80, height: 80 }}>
            <div className="w-full h-full rounded-full" style={{ backgroundColor: 'var(--color-elevated)' }} />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-9 rounded w-14" style={{ backgroundColor: 'var(--color-elevated)' }} />
            <div className="h-3 rounded w-28" style={{ backgroundColor: 'var(--color-elevated)' }} />
            <div className="flex gap-4 mt-3">
              <div className="h-4 rounded w-20" style={{ backgroundColor: 'var(--color-elevated)' }} />
              <div className="h-4 rounded w-16" style={{ backgroundColor: 'var(--color-elevated)' }} />
            </div>
          </div>
        </div>
        <div className="h-10 border-t flex items-center justify-center" style={{ borderColor: 'var(--color-border)' }}>
          <div className="h-3 rounded w-20" style={{ backgroundColor: 'var(--color-elevated)' }} />
        </div>
      </div>
    );
  }

  // No data or error - hide
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>No debt data</p>
      </div>
    );
  }

  // No debts - show celebration
  if (!data.hasDebts) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <span className="text-5xl mb-3">🎉</span>
        <p className="text-base font-bold mb-1" style={{ color: 'var(--color-success)' }}>Debt Free!</p>
        <p className="text-sm mb-2" style={{ color: 'var(--color-muted-foreground)' }}>You have no active debts</p>
        <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)', opacity: 0.8 }}>You&apos;re amazing!</p>
      </div>
    );
  }

  // Ring color by progress: income green for good, warning for mid
  const getRingColor = () => {
    const pct = data.percentageComplete;
    if (pct >= 75) return 'var(--color-income)';
    if (pct >= 50) return 'var(--color-primary)';
    if (pct >= 25) return 'var(--color-warning)';
    return 'var(--color-destructive)';
  };

  const ringColor = getRingColor();
  const ringRadius = 36;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (Math.min(100, Math.max(0, data.percentageComplete)) / 100) * ringCircumference;

  // Has debts - show compact countdown
  return (
    <div className="h-full flex flex-col">
      {/* Mini header */}
      <div className="py-2 px-4 flex items-center gap-2">
        <TrendingDown className="w-3 h-3 shrink-0" style={{ color: 'var(--color-income)' }} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--color-muted-foreground)' }}>
          Debt Payoff
        </span>
      </div>

      {/* Main Content - Horizontal Layout */}
      <div className="flex-1 flex items-center gap-4 p-4">
        {/* Left: Custom progress ring */}
        <div className="shrink-0 relative flex items-center justify-center" style={{ width: 80, height: 80 }}>
          <svg width="80" height="80" className="transform -rotate-90">
            <circle
              cx="40"
              cy="40"
              r={ringRadius}
              fill="none"
              stroke="var(--color-border)"
              strokeWidth={7}
            />
            <circle
              cx="40"
              cy="40"
              r={ringRadius}
              fill="none"
              stroke={ringColor}
              strokeWidth={7}
              strokeLinecap="round"
              strokeDasharray={ringCircumference}
              strokeDashoffset={ringOffset}
              className="transition-all duration-500"
              style={{ filter: `drop-shadow(0 0 4px ${ringColor})` }}
            />
          </svg>
          <span
            className="absolute text-xl font-bold"
            style={{ color: ringColor, fontVariantNumeric: 'tabular-nums' }}
          >
            {Math.round(data.percentageComplete)}%
          </span>
        </div>

        {/* Right: Details */}
        <div className="flex-1 min-w-0">
          {/* Countdown - months callout */}
          <div className="mb-2">
            <span className="text-4xl font-black" style={{ color: 'var(--color-foreground)', fontVariantNumeric: 'tabular-nums' }}>
              {data.totalMonthsRemaining}
            </span>
            <span className="text-xs ml-1" style={{ color: 'var(--color-muted-foreground)' }}>months</span>
            <div className="text-[10px] uppercase tracking-[0.08em] mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>until debt-free</div>
          </div>
          {/* Glow line accent */}
          <div
            className="h-px mt-2 mb-2"
            style={{ background: `linear-gradient(90deg, transparent, color-mix(in oklch, ${ringColor} 40%, transparent), transparent)` }}
          />

          {/* Stats row - Date and Balance */}
          <div className="flex gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-muted-foreground)' }}>Debt-free by</div>
              <div className="text-sm font-semibold truncate" style={{ color: 'var(--color-income)', fontVariantNumeric: 'tabular-nums' }}>
                {formatDate(data.debtFreeDate)}
              </div>
            </div>
            <div
              className="shrink-0 px-4 border-r"
              style={{ borderColor: 'color-mix(in oklch, var(--color-border) 60%, transparent)' }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-muted-foreground)' }}>Remaining</div>
              <div className="text-sm font-semibold tabular-nums truncate" style={{ color: 'var(--color-foreground)', fontVariantNumeric: 'tabular-nums' }}>
                ${data.totalRemainingBalance.toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* View Details Link */}
      <Link
        href="/dashboard/debts"
        className="flex items-center justify-center gap-1 text-xs transition-colors py-2.5 hover:opacity-80"
        style={{
          color: 'var(--color-primary)',
          borderTop: '1px solid var(--color-border)',
        }}
      >
        View Details
        <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
