'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Flame, Trophy, Loader2, Star, Gem, Zap } from 'lucide-react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';

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
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [data, setData] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStreakData = useCallback(async () => {
    if (!selectedHouseholdId) return;
    try {
      setLoading(true);
      const response = await fetchWithHousehold('/api/debts/streak');

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
  }, [selectedHouseholdId, fetchWithHousehold]);

  useEffect(() => {
    if (!selectedHouseholdId) return;
    fetchStreakData();
  }, [selectedHouseholdId, fetchStreakData]);

  const getStreakGradient = (streak: number) => {
    if (streak >= 24) return 'linear-gradient(to right, var(--color-transfer), var(--color-primary))'; // 2+ years
    if (streak >= 12) return 'linear-gradient(to right, var(--color-warning), var(--color-expense))'; // 1+ year
    if (streak >= 6) return 'linear-gradient(to right, var(--color-success), var(--color-primary))'; // 6+ months
    if (streak >= 3) return 'linear-gradient(to right, var(--color-primary), var(--color-accent))'; // 3+ months
    return 'linear-gradient(to right, var(--color-muted), var(--color-muted-foreground))'; // < 3 months
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
      <Card className="p-6 rounded-xl" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-muted-foreground)' }} />
        </div>
      </Card>
    );
  }

  // No debts or no payments
  if (!data?.hasDebts || !data.hasPayments) {
    return (
      <Card className="p-6 rounded-xl" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg" style={{ backgroundColor: 'color-mix(in oklch, var(--color-warning) 20%, transparent)' }}>
            <Flame className="w-6 h-6" style={{ color: 'var(--color-warning)' }} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--color-foreground)' }}>Payment Streak</h3>
            <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
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
    <Card
      className="p-6 rounded-xl relative overflow-hidden"
      style={{
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-background)',
        backgroundImage: data.isActive
          ? 'linear-gradient(135deg, color-mix(in oklch, var(--color-transfer) 10%, transparent), color-mix(in oklch, var(--color-primary) 10%, transparent))'
          : undefined,
      }}
    >
      {/* Decorative background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl" style={{ backgroundColor: 'var(--color-foreground)' }}></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full blur-2xl" style={{ backgroundColor: 'var(--color-foreground)' }}></div>
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--color-foreground)' }}>Payment Streak</h3>
            <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{motivationalMessage}</p>
          </div>
          <div className="p-3 rounded-lg shadow-lg" style={{ background: data.isActive ? streakGradient : 'var(--color-muted)' }}>
            <Flame className={`w-6 h-6 ${data.isActive ? 'animate-pulse' : 'opacity-50'}`} style={{ color: 'var(--color-primary-foreground)' }} />
          </div>
        </div>

        {/* Main Streak Display */}
        <div className="flex items-center gap-6 mb-6">
          <div>
            <div className="flex items-baseline gap-2">
              <span
                className="text-5xl font-bold bg-clip-text text-transparent"
                style={{ background: 'linear-gradient(to right, var(--color-foreground), var(--color-muted-foreground))', WebkitBackgroundClip: 'text' }}
              >
                {data.currentStreak}
              </span>
              <span className="text-lg" style={{ color: 'var(--color-muted-foreground)' }}>
                month{data.currentStreak !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
              Longest: {data.longestStreak} month{data.longestStreak !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Next Milestone Progress */}
          {data.nextMilestone && (
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                  {data.nextMilestone.label}
                </span>
                <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                  {data.nextMilestone.remaining} to go
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-elevated)' }}>
                <div
                  className="h-full transition-all duration-500"
                  style={{ width: `${Math.min(progressPercentage, 100)}%`, background: streakGradient }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Achievements */}
        {data.achievements.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs mb-2" style={{ color: 'var(--color-muted-foreground)' }}>Milestones</p>
            <div className="flex gap-2 flex-wrap">
              {data.achievements.map((achievement) => {
                const IconComponent = getIconComponent(achievement.icon);
                return (
                  <div
                    key={achievement.milestone}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-lg"
                    style={
                      achievement.currentlyActive
                        ? { background: streakGradient, color: 'var(--color-primary-foreground)' }
                        : achievement.achieved
                        ? { backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-muted-foreground)' }
                        : { backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', color: 'var(--color-muted-foreground)' }
                    }
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
          <div
            className="mt-4 p-3 rounded-lg"
            style={{
              backgroundColor: 'color-mix(in oklch, var(--color-warning) 10%, transparent)',
              border: '1px solid color-mix(in oklch, var(--color-warning) 30%, transparent)',
            }}
          >
            <p className="text-xs" style={{ color: 'var(--color-warning)' }}>
              Streak paused. Make a payment this month to continue!
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
