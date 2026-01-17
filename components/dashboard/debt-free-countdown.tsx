'use client';

import { useEffect, useState, useCallback } from 'react';
import { ProgressRing } from '@/components/ui/progress-ring';
import { PartyPopper, Target, Medal, Award, Zap, Calendar, DollarSign, TrendingDown } from 'lucide-react';
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
      <div className="bg-card border border-border rounded-xl p-4 animate-pulse">
        <div className="flex items-center justify-center">
          <div className="w-24 h-24 bg-elevated rounded-full"></div>
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
      <div className="bg-gradient-to-br from-income/20 to-income/10 border border-income/30 rounded-xl p-4">
        <div className="flex items-center gap-4">
          <PartyPopper className="w-10 h-10 text-income shrink-0" />
          <div>
            <h2 className="text-xl font-bold text-income">
              You&apos;re Debt-Free!
            </h2>
            <p className="text-income/80 text-sm">
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

  const getStrategyLabel = (method: string) => {
    if (method === 'snowball') {
      return 'Smallest balance first';
    }
    return 'Highest rate first';
  };

  // Has debts but strategy disabled - show simplified view
  if (!strategyEnabled) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        {/* Header - Compact Inline */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-bold text-foreground">Debt Overview</h2>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
              Manual
            </span>
          </div>
        </div>

        {/* Compact Stats Row */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-elevated rounded-lg p-3">
            <div className="text-xs text-muted-foreground">Total Debt</div>
            <div className="text-xl font-bold font-mono text-error">
              ${data.totalRemainingBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="bg-elevated rounded-lg p-3">
            <div className="text-xs text-muted-foreground">Total Paid</div>
            <div className="text-xl font-bold font-mono text-income">
              ${data.totalPaid.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>

        {/* Enable Strategy Prompt - Compact */}
        <div className="p-2.5 bg-muted/30 border border-border rounded-lg text-center">
          <p className="text-xs text-muted-foreground">
            Enable strategy to see debt-free date and payment recommendations.
          </p>
        </div>
      </div>
    );
  }

  // Has debts with strategy enabled - show full countdown
  return (
    <div className="bg-gradient-to-br from-card to-elevated border border-border rounded-xl p-4">
      {/* Header - Compact Inline */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-foreground" />
          <h2 className="text-lg font-bold text-foreground">Debt-Free Countdown</h2>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize bg-income/20 text-income">
            {payoffMethod}
          </span>
        </div>
        <p className="text-muted-foreground text-xs hidden sm:block">
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
            <div className="text-3xl font-bold text-foreground">{data.totalMonthsRemaining}</div>
            <div className="text-muted-foreground text-sm">months left</div>
            <div className="text-lg font-bold text-income mt-1">{formatDate(data.debtFreeDate)}</div>
          </div>
        </div>

        {/* Center: Quick Stats */}
        <div className="flex-1 grid grid-cols-2 gap-2">
          <div className="bg-elevated rounded-lg p-2.5">
            <div className="text-xs text-muted-foreground">Remaining</div>
            <div className="text-lg font-bold font-mono text-error">
              ${data.totalRemainingBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="bg-elevated rounded-lg p-2.5">
            <div className="text-xs text-muted-foreground">Paid</div>
            <div className="text-lg font-bold font-mono text-income">
              ${data.totalPaid.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>

        {/* Right: Milestone Progress */}
        <div className="flex items-center gap-1">
          {data.milestones.map((milestone) => (
            <div key={milestone.percentage} className="text-center px-1">
              <div className={`transition-all ${milestone.achieved ? 'text-income' : 'opacity-30 text-muted-foreground'}`}>
                {getMilestoneIcon(milestone.percentage)}
              </div>
              <div className={`text-[10px] ${milestone.achieved ? 'text-income' : 'text-muted-foreground'}`}>
                {milestone.percentage}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Focus Debt - Compact Banner */}
      {data.focusDebt && (
        <div className="mt-3 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/30 rounded-lg p-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">{data.focusDebt.name}</span>
              <span className="text-xs text-muted-foreground bg-elevated px-1.5 py-0.5 rounded">
                {data.focusDebt.interestRate.toFixed(1)}% APR
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="text-muted-foreground">Balance: </span>
                <span className="font-mono font-medium">${data.focusDebt.remainingBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Payoff: </span>
                <span className="font-medium text-primary">{formatPayoffDate(data.focusDebt.payoffDate)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Payment: </span>
                <span className="font-mono font-medium">${data.focusDebt.activePayment.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/mo</span>
              </div>
            </div>
          </div>
          {/* Compact Progress Bar */}
          <div className="mt-2 h-1.5 bg-elevated rounded-full overflow-hidden">
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
