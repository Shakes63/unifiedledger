'use client';

import { useEffect, useState, useCallback } from 'react';
import { ProgressRing } from '@/components/ui/progress-ring';
import { PartyPopper, Target, Medal, Award } from 'lucide-react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';

interface Milestone {
  percentage: number;
  monthsAway: number;
  achieved: boolean;
  achievedDate?: string;
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
}

export function DebtFreeCountdown() {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [data, setData] = useState<CountdownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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

  // Has debts - show countdown
  return (
    <div className="bg-gradient-to-br from-card to-elevated border border-border rounded-xl p-6 md:p-8">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Target className="w-6 h-6 md:w-8 md:h-8 text-foreground" />
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            Debt-Free Countdown
          </h2>
        </div>
        <p className="text-muted-foreground text-sm md:text-base">
          {getMotivationalMessage(data.percentageComplete)}
        </p>
      </div>

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
