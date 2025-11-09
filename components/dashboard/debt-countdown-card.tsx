'use client';

import { useEffect, useState } from 'react';
import { ProgressRing } from '@/components/ui/progress-ring';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface CountdownData {
  hasDebts: boolean;
  totalMonthsRemaining: number;
  percentageComplete: number;
  debtFreeDate: string;
  totalRemainingBalance: number;
}

export function DebtCountdownCard() {
  const [data, setData] = useState<CountdownData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCountdownData();
  }, []);

  const fetchCountdownData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/debts/countdown');

      if (!response.ok) {
        throw new Error('Failed to fetch countdown data');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching debt countdown:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  // Loading state
  if (loading) {
    return (
      <div className="animate-pulse h-full flex flex-col items-center justify-center p-4">
        <div className="w-20 h-20 rounded-full mb-3" style={{ backgroundColor: 'var(--color-elevated)' }}></div>
        <div className="h-4 rounded w-24 mb-2" style={{ backgroundColor: 'var(--color-elevated)' }}></div>
        <div className="h-3 rounded w-32" style={{ backgroundColor: 'var(--color-elevated)' }}></div>
      </div>
    );
  }

  // No data or error - hide
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <p className="text-sm text-muted-foreground">No debt data</p>
      </div>
    );
  }

  // No debts - show celebration
  if (!data.hasDebts) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <div className="text-4xl mb-2">🎉</div>
        <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-income)' }}>Debt-Free!</p>
        <p className="text-xs text-muted-foreground">You have no active debts</p>
      </div>
    );
  }

  // Has debts - show compact countdown
  return (
    <div className="flex flex-col h-full">
      {/* Main Content - Horizontal Layout */}
      <div className="flex-1 flex items-center gap-4 p-4">
        {/* Left: Progress Ring */}
        <div className="flex-shrink-0">
          <ProgressRing
            percentage={data.percentageComplete}
            size="small"
          />
        </div>

        {/* Right: Details */}
        <div className="flex-1 min-w-0">
          {/* Countdown */}
          <div className="mb-2">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-foreground">
                {data.totalMonthsRemaining}
              </span>
              <span className="text-xs text-muted-foreground">months</span>
            </div>
            <div className="text-xs text-muted-foreground">to freedom</div>
          </div>

          {/* Date and Balance - Side by side */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-muted-foreground">Debt-free by</div>
              <div className="text-xs font-semibold" style={{ color: 'var(--color-income)' }}>
                {formatDate(data.debtFreeDate)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Remaining</div>
              <div className="text-xs font-mono font-semibold text-foreground truncate">
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
        className="flex items-center justify-center gap-1 text-xs transition-colors py-2 border-t"
        style={{ color: 'var(--color-income)', borderColor: 'var(--color-border)' }}
      >
        View Details
        <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
