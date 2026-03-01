'use client';

import { useEffect, useState, useCallback } from 'react';
import { ProgressRing } from '@/components/ui/progress-ring';
import { PartyPopper, Target, Medal, Award, Zap } from 'lucide-react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';

interface Milestone {
  percentage: number;
  monthsAway: number;
  achieved: boolean;
  achievedDate?: string;
}

interface FocusDebt {
  id: string;
  name: string;
  originalAmount: number;
  remainingBalance: number;
  percentagePaid: number;
  interestRate: number;
  payoffDate: string;
  monthsRemaining: number;
  daysRemaining: number;
  currentPayment: number;
  activePayment: number;
  strategyMethod: string;
  color: string | null;
  icon: string | null;
}

interface CountdownData {
  hasDebts: boolean;
  totalMonthsRemaining: number;
  totalMonthsOriginal: number;
  monthsElapsed: number;
  percentageComplete: number;
  debtFreeDate: string;
  totalRemainingBalance: number;
  totalOriginalDebt: number;
  totalPaid: number;
  milestones: Milestone[];
  nextMilestone: {
    percentage: number;
    monthsAway: number;
  } | null;
  focusDebt: FocusDebt | null;
  strategyEnabled?: boolean;
  payoffMethod?: string;
}

interface DebtFreeCountdownProps {
  strategyEnabled?: boolean;
  payoffMethod?: string;
}

export function DebtFreeCountdown({ strategyEnabled: propStrategyEnabled, payoffMethod: propPayoffMethod }: DebtFreeCountdownProps) {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [data, setData] = useState<CountdownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  // Use props if provided, otherwise fall back to data from API
  const strategyEnabled = propStrategyEnabled ?? data?.strategyEnabled ?? false;
  const payoffMethod = propPayoffMethod ?? data?.payoffMethod ?? 'avalanche';

  const fetchCountdownData = useCallback(async () => {
    if (!selectedHouseholdId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(false);
      const response = await fetchWithHousehold('/api/debts/countdown');

      if (!response.ok) {
        throw new Error('Failed to fetch countdown data');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching debt countdown:', err);
      setError(true);
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

  const getMotivationalMessage = (percentage: number) => {
    if (percentage >= 100) {
      return "You did it! You're debt-free!";
    } else if (percentage >= 75) {
      return "So close! The finish line is in sight!";
    } else if (percentage >= 50) {
      return "More than halfway! You're crushing it!";
    } else if (percentage >= 25) {
      return "You're a quarter of the way there!";
    } else {
      return "You're just getting started - stay strong!";
    }
  };

  const getMilestoneIcon = (percentage: number) => {
    switch (percentage) {
      case 25:
        return <Medal className="w-6 h-6" />; // Bronze
      case 50:
        return <Medal className="w-6 h-6" />; // Silver
      case 75:
        return <Award className="w-6 h-6" />; // Gold
      case 100:
        return <PartyPopper className="w-6 h-6" />; // Party
      default:
        return <Target className="w-6 h-6" />;
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="rounded-xl p-4 animate-pulse" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center justify-center">
          <div className="w-24 h-24 rounded-full" style={{ backgroundColor: 'var(--color-elevated)' }}></div>
        </div>
      </div>
    );
  }

  // Error or no data
  if (error || !data) {
    return null; // Silently hide on error
  }

  // No debts - debt-free celebration
  if (!data.hasDebts) {
    return (
      <div
        className="rounded-xl p-4"
        style={{
          background: 'linear-gradient(to bottom right, color-mix(in oklch, var(--color-income) 20%, transparent), color-mix(in oklch, var(--color-income) 10%, transparent))',
          border: '1px solid color-mix(in oklch, var(--color-income) 30%, transparent)',
        }}
      >
        <div className="flex items-center gap-4">
          <PartyPopper className="w-10 h-10 shrink-0" style={{ color: 'var(--color-income)' }} />
          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--color-income)' }}>
              You&apos;re Debt-Free!
            </h2>
            <p className="text-sm" style={{ color: 'color-mix(in oklch, var(--color-income) 80%, transparent)' }}>
              Congratulations! You have no active debts.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const formatPayoffDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Has debts but strategy disabled - show simplified view
  if (!strategyEnabled) {
    return (
      <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
        {/* Header - Compact Inline */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5" style={{ color: 'var(--color-muted-foreground)' }} />
            <h2 className="text-lg font-bold" style={{ color: 'var(--color-foreground)' }}>Debt Overview</h2>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'var(--color-muted)', color: 'var(--color-muted-foreground)' }}>
              Manual
            </span>
          </div>
        </div>

        {/* Compact Stats Row */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-elevated)' }}>
            <div className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Total Debt</div>
            <div className="text-xl font-bold font-mono" style={{ color: 'var(--color-destructive)' }}>
              ${data.totalRemainingBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-elevated)' }}>
            <div className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Total Paid</div>
            <div className="text-xl font-bold font-mono" style={{ color: 'var(--color-income)' }}>
              ${data.totalPaid.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>

        {/* Enable Strategy Prompt - Compact */}
        <div className="p-2.5 rounded-lg text-center" style={{ backgroundColor: 'color-mix(in oklch, var(--color-muted) 30%, transparent)', border: '1px solid var(--color-border)' }}>
          <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
            Enable strategy to see debt-free date and payment recommendations.
          </p>
        </div>
      </div>
    );
  }

  // Has debts with strategy enabled - show full countdown
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: 'linear-gradient(to bottom right, var(--color-background), var(--color-elevated))',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Header - Compact Inline */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5" style={{ color: 'var(--color-foreground)' }} />
          <h2 className="text-lg font-bold" style={{ color: 'var(--color-foreground)' }}>Debt-Free Countdown</h2>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize" style={{ backgroundColor: 'color-mix(in oklch, var(--color-income) 20%, transparent)', color: 'var(--color-income)' }}>
            {payoffMethod}
          </span>
        </div>
        <p className="text-xs hidden sm:block" style={{ color: 'var(--color-muted-foreground)' }}>
          {getMotivationalMessage(data.percentageComplete)}
        </p>
      </div>

      {/* Main Content - Horizontal Layout */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left: Progress Ring + Key Stats */}
        <div className="flex items-center gap-4 lg:gap-6">
          <ProgressRing
            percentage={data.percentageComplete}
            size="medium"
          />
          <div>
            <div className="text-3xl font-bold" style={{ color: 'var(--color-foreground)' }}>{data.totalMonthsRemaining}</div>
            <div className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>months left</div>
            <div className="text-lg font-bold mt-1" style={{ color: 'var(--color-income)' }}>{formatDate(data.debtFreeDate)}</div>
          </div>
        </div>

        {/* Center: Quick Stats */}
        <div className="flex-1 grid grid-cols-2 gap-2">
          <div className="rounded-lg p-2.5" style={{ backgroundColor: 'var(--color-elevated)' }}>
            <div className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Remaining</div>
            <div className="text-lg font-bold font-mono" style={{ color: 'var(--color-destructive)' }}>
              ${data.totalRemainingBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="rounded-lg p-2.5" style={{ backgroundColor: 'var(--color-elevated)' }}>
            <div className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Paid</div>
            <div className="text-lg font-bold font-mono" style={{ color: 'var(--color-income)' }}>
              ${data.totalPaid.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>

        {/* Right: Milestone Progress */}
        <div className="flex items-center gap-1">
          {data.milestones.map((milestone) => (
            <div key={milestone.percentage} className="text-center px-1">
              <div
                className={`transition-all ${milestone.achieved ? '' : 'opacity-30'}`}
                style={{ color: milestone.achieved ? 'var(--color-income)' : 'var(--color-muted-foreground)' }}
              >
                {getMilestoneIcon(milestone.percentage)}
              </div>
              <div
                className="text-[10px]"
                style={{ color: milestone.achieved ? 'var(--color-income)' : 'var(--color-muted-foreground)' }}
              >
                {milestone.percentage}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Focus Debt - Compact Banner */}
      {data.focusDebt && (
        <div
          className="mt-3 rounded-lg p-3"
          style={{
            background: 'linear-gradient(to right, color-mix(in oklch, var(--color-primary) 10%, transparent), color-mix(in oklch, var(--color-primary) 5%, transparent))',
            border: '1px solid color-mix(in oklch, var(--color-primary) 30%, transparent)',
          }}
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>{data.focusDebt.name}</span>
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: 'var(--color-muted-foreground)', backgroundColor: 'var(--color-elevated)' }}>
                {data.focusDebt.interestRate.toFixed(1)}% APR
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div>
                <span style={{ color: 'var(--color-muted-foreground)' }}>Balance: </span>
                <span className="font-mono font-medium">${data.focusDebt.remainingBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
              </div>
              <div>
                <span style={{ color: 'var(--color-muted-foreground)' }}>Payoff: </span>
                <span className="font-medium" style={{ color: 'var(--color-primary)' }}>{formatPayoffDate(data.focusDebt.payoffDate)}</span>
              </div>
              <div>
                <span style={{ color: 'var(--color-muted-foreground)' }}>Payment: </span>
                <span className="font-mono font-medium">${data.focusDebt.activePayment.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/mo</span>
              </div>
            </div>
          </div>
          {/* Compact Progress Bar */}
          <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-elevated)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, data.focusDebt.percentagePaid)}%`,
                backgroundColor: data.focusDebt.color || 'var(--color-primary)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
