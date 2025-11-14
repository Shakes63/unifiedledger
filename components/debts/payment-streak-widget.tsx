'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Flame, Trophy, Loader2, Star, Gem, PartyPopper, Zap, Target } from 'lucide-react';

interface StreakData {
  hasDebts: boolean;
  hasPayments: boolean;
  currentStreak: number;
  longestStreak: number;
  isActive: boolean;
  nextMilestone?: {
    months: number;
    label: string;
    icon: string;
    remaining: number;
  };
  achievements: Array<{
    milestone: number;
    label: string;
    icon: string;
    achieved: boolean;
    currentlyActive: boolean;
  }>;
  message?: string;
}

export function PaymentStreakWidget() {
  const [data, setData] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStreakData();
  }, []);

  const fetchStreakData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/debts/streak', { credentials: 'include' });

      if (!response.ok) {
        throw new Error('Failed to fetch streak data');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching payment streak:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStreakColor = (streak: number) => {
    if (streak >= 24) return 'from-purple-500 to-pink-500'; // 2+ years
    if (streak >= 12) return 'from-yellow-500 to-orange-500'; // 1+ year
    if (streak >= 6) return 'from-emerald-500 to-green-500'; // 6+ months
    if (streak >= 3) return 'from-blue-500 to-cyan-500'; // 3+ months
    return 'from-gray-500 to-gray-400'; // < 3 months
  };

  const getMotivationalMessage = (streak: number, isActive: boolean) => {
    if (!isActive && streak === 0) {
      return 'Start your payment streak today!';
    }
    if (!isActive) {
      return `Streak ended at ${streak}. Start fresh!`;
    }
    if (streak >= 24) {
      return 'Incredible dedication!';
    }
    if (streak >= 12) {
      return 'One full year! Amazing!';
    }
    if (streak >= 6) {
      return 'Half a year! Keep it up!';
    }
    if (streak >= 3) {
      return 'Great start! Building momentum!';
    }
    if (streak === 1) {
      return 'First month down!';
    }
    return 'Keep the momentum going!';
  };

  const getIconComponent = (iconName: string) => {
    const icons: Record<string, React.ComponentType<{ className?: string }>> = {
      Flame,
      Zap,
      Trophy,
      Award: Trophy,
      Gem,
    };
    return icons[iconName] || Star;
  };

  // Loading state
  if (loading) {
    return (
      <Card className="p-6 border border-border bg-card rounded-xl">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
        </div>
      </Card>
    );
  }

  // No debts or no payments
  if (!data?.hasDebts || !data.hasPayments) {
    return (
      <Card className="p-6 border border-border bg-card rounded-xl">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-[var(--color-warning)]/20 rounded-lg">
            <Flame className="w-6 h-6 text-[var(--color-warning)]" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground mb-1">Payment Streak</h3>
            <p className="text-sm text-muted-foreground">
              {data?.message || 'Make consistent payments to build your streak!'}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const streakGradient = getStreakColor(data.currentStreak);
  const motivationalMessage = getMotivationalMessage(data.currentStreak, data.isActive);

  // Calculate progress to next milestone
  const progressPercentage = data.nextMilestone
    ? ((data.currentStreak % data.nextMilestone.months) / data.nextMilestone.months) * 100
    : 100;

  return (
    <Card className={`p-6 border border-border bg-gradient-to-br ${data.isActive ? streakGradient : 'from-muted to-muted'} bg-opacity-10 rounded-xl relative overflow-hidden`}>
      {/* Decorative background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 right-0 w-32 h-32 bg-foreground rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-foreground rounded-full blur-2xl"></div>
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Payment Streak</h3>
            <p className="text-xs text-muted-foreground">{motivationalMessage}</p>
          </div>
          <div className={`p-3 bg-gradient-to-br ${streakGradient} rounded-lg shadow-lg`}>
            <Flame className={`w-6 h-6 text-primary-foreground ${data.isActive ? 'animate-pulse' : 'opacity-50'}`} />
          </div>
        </div>

        {/* Main Streak Display */}
        <div className="flex items-center gap-6 mb-6">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                {data.currentStreak}
              </span>
              <span className="text-lg text-muted-foreground">
                month{data.currentStreak !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Longest: {data.longestStreak} month{data.longestStreak !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Next Milestone Progress */}
          {data.nextMilestone && (
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">
                  {data.nextMilestone.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {data.nextMilestone.remaining} to go
                </span>
              </div>
              <div className="h-2 bg-elevated rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${streakGradient} transition-all duration-500`}
                  style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Achievements */}
        {data.achievements.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground mb-2">Milestones</p>
            <div className="flex gap-2 flex-wrap">
              {data.achievements.map((achievement) => {
                const IconComponent = getIconComponent(achievement.icon);
                return (
                  <div
                    key={achievement.milestone}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      achievement.currentlyActive
                        ? `bg-gradient-to-r ${streakGradient} text-primary-foreground shadow-lg`
                        : achievement.achieved
                        ? 'bg-elevated border border-border text-muted-foreground'
                        : 'bg-card border border-border text-muted-foreground'
                    }`}
                    title={achievement.label}
                  >
                    <IconComponent className="w-4 h-4" />
                    <span>{achievement.milestone}mo</span>
                    {achievement.currentlyActive && (
                      <Star className="w-3 h-3 fill-current" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Status Message */}
        {!data.isActive && data.currentStreak > 0 && (
          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <p className="text-xs text-amber-400">
              Streak paused. Make a payment this month to continue!
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
