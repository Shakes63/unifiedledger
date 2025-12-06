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
      <div className="bg-card border border-border rounded-xl p-8 animate-pulse">
        <div className="flex items-center justify-center">
          <div className="w-32 h-32 bg-elevated rounded-full"></div>
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
      <div className="bg-gradient-to-br from-[var(--color-income)]/20 to-[var(--color-income)]/10 border border-[var(--color-income)]/30 rounded-xl p-8">
        <div className="text-center">
          <PartyPopper className="w-16 h-16 text-[var(--color-income)] mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-[var(--color-income)] mb-2">
            You&apos;re Debt-Free!
          </h2>
          <p className="text-[var(--color-income)]/80 text-lg">
            Congratulations! You have no active debts. Keep up the great work!
          </p>
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
      <div className="bg-card border border-border rounded-xl p-6 md:p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2 flex-wrap">
            <Target className="w-6 h-6 md:w-8 md:h-8 text-muted-foreground" />
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              Debt Overview
            </h2>
            <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-muted text-muted-foreground">
              Manual Mode
            </span>
          </div>
          <p className="text-muted-foreground text-sm md:text-base">
            Track your debts individually
          </p>
        </div>

        {/* Simple Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Total Debt */}
          <div className="bg-elevated rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-1">Total Debt</div>
            <div className="text-2xl font-bold font-mono text-[var(--color-error)]">
              ${data.totalRemainingBalance.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>

          {/* Amount Paid */}
          <div className="bg-elevated rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-1">Total Paid</div>
            <div className="text-2xl font-bold font-mono text-[var(--color-income)]">
              ${data.totalPaid.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
        </div>

        {/* Enable Strategy Prompt */}
        <div className="mt-6 p-4 bg-muted/30 border border-border rounded-lg text-center">
          <p className="text-sm text-muted-foreground">
            Enable the debt payoff strategy to see your projected debt-free date, 
            progress milestones, and optimized payment recommendations.
          </p>
        </div>
      </div>
    );
  }

  // Has debts with strategy enabled - show full countdown
  return (
    <div className="bg-gradient-to-br from-card to-elevated border border-border rounded-xl p-6 md:p-8">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-2 flex-wrap">
          <Target className="w-6 h-6 md:w-8 md:h-8 text-foreground" />
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            Debt-Free Countdown
          </h2>
          <span className="text-xs px-2.5 py-1 rounded-full font-medium capitalize bg-[var(--color-income)]/20 text-[var(--color-income)]">
            {payoffMethod} Strategy
          </span>
        </div>
        <p className="text-muted-foreground text-sm md:text-base">
          {getMotivationalMessage(data.percentageComplete)}
        </p>
      </div>

      {/* Focus Debt Card */}
      {data.focusDebt && (
        <div className="mb-6 bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 border border-[var(--color-primary)]/30 rounded-xl p-4 md:p-5">
          {/* Focus Header */}
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5 text-[var(--color-primary)]" />
            <span className="text-sm font-semibold text-[var(--color-primary)] uppercase tracking-wide">
              Current Focus
            </span>
          </div>

          {/* Debt Name & Rate */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg md:text-xl font-bold text-foreground">
              {data.focusDebt.name}
            </h3>
            <span className="text-sm font-medium text-muted-foreground bg-elevated px-2 py-1 rounded">
              {data.focusDebt.interestRate.toFixed(2)}% APR
            </span>
          </div>

          {/* Progress Bar */}
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-muted-foreground">Progress</span>
              <span className="text-xs font-medium text-[var(--color-income)]">
                {data.focusDebt.percentagePaid.toFixed(1)}% paid
              </span>
            </div>
            <div className="h-2 bg-elevated rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, data.focusDebt.percentagePaid)}%`,
                  backgroundColor: data.focusDebt.color || 'var(--color-primary)',
                }}
              />
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-muted-foreground">
                ${data.focusDebt.remainingBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} remaining
              </span>
              <span className="text-xs text-muted-foreground">
                of ${data.focusDebt.originalAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {/* Payoff Date */}
            <div className="bg-elevated/50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Payoff Date</span>
              </div>
              <div className="text-sm font-semibold text-foreground">
                {formatPayoffDate(data.focusDebt.payoffDate)}
              </div>
              <div className="text-xs text-[var(--color-primary)] mt-0.5">
                {data.focusDebt.monthsRemaining} mo{data.focusDebt.daysRemaining > 0 ? `, ${data.focusDebt.daysRemaining} days` : ''}
              </div>
            </div>

            {/* Active Payment */}
            <div className="bg-elevated/50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Monthly Payment</span>
              </div>
              <div className="text-sm font-semibold font-mono text-foreground">
                ${data.focusDebt.activePayment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              {data.focusDebt.activePayment > data.focusDebt.currentPayment && (
                <div className="text-xs text-[var(--color-income)] mt-0.5">
                  +${(data.focusDebt.activePayment - data.focusDebt.currentPayment).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} extra
                </div>
              )}
            </div>

            {/* Strategy */}
            <div className="bg-elevated/50 rounded-lg p-3 col-span-2 md:col-span-1">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingDown className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Strategy</span>
              </div>
              <div className="text-sm font-semibold text-foreground capitalize">
                {payoffMethod}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {getStrategyLabel(payoffMethod)}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        {/* Left: Progress Ring */}
        <div className="flex flex-col items-center justify-center">
          <ProgressRing
            percentage={data.percentageComplete}
            size="large"
            className="mb-4"
          />

          <div className="text-center">
            <div className="text-4xl md:text-5xl font-bold text-foreground mb-2">
              {data.totalMonthsRemaining}
            </div>
            <div className="text-muted-foreground text-lg">
              months to freedom
            </div>
          </div>
        </div>

        {/* Right: Details */}
        <div className="flex flex-col justify-center space-y-4">
          {/* Debt-free date */}
          <div className="bg-elevated rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-1">Debt-Free Date</div>
            <div className="text-2xl font-bold text-[var(--color-income)]">
              {formatDate(data.debtFreeDate)}
            </div>
          </div>

          {/* Remaining balance */}
          <div className="bg-elevated rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-1">Total Remaining</div>
            <div className="text-2xl font-bold font-mono text-foreground">
              ${data.totalRemainingBalance.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              of ${data.totalOriginalDebt.toLocaleString('en-US', {
                maximumFractionDigits: 0,
              })} original debt
            </div>
          </div>

          {/* Next milestone */}
          {data.nextMilestone && (
            <div className="bg-gradient-to-r from-[var(--color-primary)]/20 to-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-[var(--color-primary)] mb-1">Next Milestone</div>
                  <div className="text-xl font-bold text-[var(--color-primary)] flex items-center gap-2">
                    {getMilestoneIcon(data.nextMilestone.percentage)}
                    {data.nextMilestone.percentage}% Complete
                  </div>
                  <div className="text-xs text-[var(--color-primary)]/70 mt-1">
                    ~{data.nextMilestone.monthsAway} months away
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Milestone progress */}
          <div className="flex items-center justify-between gap-2">
            {data.milestones.map((milestone) => (
              <div
                key={milestone.percentage}
                className="flex-1 text-center"
              >
                <div
                  className={`transition-all flex justify-center ${
                    milestone.achieved
                      ? 'opacity-100 scale-110 text-[var(--color-income)]'
                      : 'opacity-30 scale-90 grayscale text-muted-foreground'
                  }`}
                >
                  {getMilestoneIcon(milestone.percentage)}
                </div>
                <div
                  className={`text-xs mt-1 ${
                    milestone.achieved ? 'text-[var(--color-income)]' : 'text-muted-foreground'
                  }`}
                >
                  {milestone.percentage}%
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
