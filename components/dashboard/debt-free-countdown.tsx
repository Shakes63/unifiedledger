'use client';

import { useEffect, useState } from 'react';
import { ProgressRing } from '@/components/ui/progress-ring';

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
  const [data, setData] = useState<CountdownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchCountdownData();
  }, []);

  const fetchCountdownData = async () => {
    try {
      setLoading(true);
      setError(false);
      const response = await fetch('/api/debts/countdown');

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
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const getMotivationalMessage = (percentage: number) => {
    if (percentage >= 100) {
      return "You did it! You're debt-free! 🎉";
    } else if (percentage >= 75) {
      return "So close! The finish line is in sight! 🏁";
    } else if (percentage >= 50) {
      return "More than halfway! You're crushing it! 🔥";
    } else if (percentage >= 25) {
      return "You're a quarter of the way there! 🎯";
    } else {
      return "You're just getting started - stay strong! 💪";
    }
  };

  const getMilestoneIcon = (percentage: number) => {
    switch (percentage) {
      case 25:
        return '🏅'; // Bronze
      case 50:
        return '🥈'; // Silver
      case 75:
        return '🥇'; // Gold
      case 100:
        return '🎉'; // Party
      default:
        return '🎯';
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-8 animate-pulse">
        <div className="flex items-center justify-center">
          <div className="w-32 h-32 bg-[#242424] rounded-full"></div>
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
      <div className="bg-gradient-to-br from-emerald-950/50 to-emerald-900/30 border border-emerald-500/30 rounded-xl p-8">
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-3xl font-bold text-emerald-200 mb-2">
            You're Debt-Free!
          </h2>
          <p className="text-emerald-100/80 text-lg">
            Congratulations! You have no active debts. Keep up the great work!
          </p>
        </div>
      </div>
    );
  }

  // Has debts - show countdown
  return (
    <div className="bg-gradient-to-br from-[#1a1a1a] to-[#242424] border border-[#2a2a2a] rounded-xl p-6 md:p-8">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
          🎯 Debt-Free Countdown
        </h2>
        <p className="text-[#808080] text-sm md:text-base">
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
            <div className="text-4xl md:text-5xl font-bold text-white mb-2">
              {data.totalMonthsRemaining}
            </div>
            <div className="text-[#808080] text-lg">
              months to freedom
            </div>
          </div>
        </div>

        {/* Right: Details */}
        <div className="flex flex-col justify-center space-y-4">
          {/* Debt-free date */}
          <div className="bg-[#242424] rounded-lg p-4">
            <div className="text-sm text-[#808080] mb-1">Debt-Free Date</div>
            <div className="text-2xl font-bold text-emerald-400">
              {formatDate(data.debtFreeDate)}
            </div>
          </div>

          {/* Remaining balance */}
          <div className="bg-[#242424] rounded-lg p-4">
            <div className="text-sm text-[#808080] mb-1">Total Remaining</div>
            <div className="text-2xl font-bold font-mono text-white">
              ${data.totalRemainingBalance.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="text-xs text-[#808080] mt-1">
              of ${data.totalOriginalDebt.toLocaleString('en-US', {
                maximumFractionDigits: 0,
              })} original debt
            </div>
          </div>

          {/* Next milestone */}
          {data.nextMilestone && (
            <div className="bg-gradient-to-r from-blue-950/40 to-blue-900/30 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-blue-300 mb-1">Next Milestone</div>
                  <div className="text-xl font-bold text-blue-200">
                    {getMilestoneIcon(data.nextMilestone.percentage)}{' '}
                    {data.nextMilestone.percentage}% Complete
                  </div>
                  <div className="text-xs text-blue-300/70 mt-1">
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
                  className={`text-2xl transition-all ${
                    milestone.achieved
                      ? 'opacity-100 scale-110'
                      : 'opacity-30 scale-90 grayscale'
                  }`}
                >
                  {getMilestoneIcon(milestone.percentage)}
                </div>
                <div
                  className={`text-xs mt-1 ${
                    milestone.achieved ? 'text-emerald-400' : 'text-[#808080]'
                  }`}
                >
                  {milestone.percentage}%
                  {milestone.achieved && ' ✓'}
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
