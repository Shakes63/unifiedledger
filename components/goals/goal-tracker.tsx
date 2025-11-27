'use client';

import { useState, useMemo } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, Edit2, Trash2, Check, Lightbulb } from 'lucide-react';
import { EntityIdBadge } from '@/components/dev/entity-id-badge';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import {
  calculateRecommendedMonthlySavings,
  formatCurrency,
} from '@/lib/goals/calculate-recommended-savings';

interface Milestone {
  id: string;
  percentage: number;
  milestoneAmount: number;
  achievedAt?: string;
}

interface GoalTrackerProps {
  goal: {
    id: string;
    name: string;
    description?: string;
    targetAmount: number;
    currentAmount: number;
    targetDate?: string;
    category: string;
    color: string;
    status: string;
    monthlyContribution?: number | null;
  };
  milestones?: Milestone[];
  onEdit?: (goal: any) => void;
  onDelete?: (goalId: string) => void;
  onContribute?: (goalId: string, amount: number) => void;
}

export function GoalTracker({
  goal,
  milestones = [],
  onEdit,
  onDelete,
  onContribute,
}: GoalTrackerProps) {
  const { selectedHouseholdId } = useHousehold();
  const { putWithHousehold } = useHouseholdFetch();
  const [showMilestones, setShowMilestones] = useState(false);
  const [showContribute, setShowContribute] = useState(false);
  const [contributeAmount, setContributeAmount] = useState('');

  const progressPercent = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
  const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0);
  const daysLeft = goal.targetDate
    ? Math.ceil(
        (new Date(goal.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      )
    : null;

  // Calculate recommended monthly savings
  const recommendation = useMemo(() => {
    if (goal.status !== 'active') return null;
    return calculateRecommendedMonthlySavings(
      goal.targetAmount,
      goal.currentAmount,
      goal.targetDate
    );
  }, [goal.targetAmount, goal.currentAmount, goal.targetDate, goal.status]);

  const handleContribute = async () => {
    if (!selectedHouseholdId) {
      toast.error('Please select a household');
      return;
    }

    const amount = parseFloat(contributeAmount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      const response = await putWithHousehold(`/api/savings-goals/${goal.id}/progress`, {
        increment: amount,
      });

      if (!response.ok) throw new Error('Failed to contribute');

      const updated = await response.json();
      onContribute?.(goal.id, amount);

      // Check for newly achieved milestones
      if (updated.milestones) {
        const newlyAchieved = updated.milestones.filter(
          (m: Milestone) =>
            m.achievedAt &&
            !milestones.find((existing) => existing.id === m.id && existing.achievedAt)
        );
        newlyAchieved.forEach((m: Milestone) => {
          toast.success(`Milestone reached! ${m.percentage}% of goal achieved!`);
        });
      }

      setContributeAmount('');
      setShowContribute(false);
      toast.success(`Added $${amount.toFixed(2)} to ${goal.name}`);
    } catch (_error) {
      toast.error('Failed to add contribution');
    }
  };

  return (
    <Card className="bg-card border-border p-4 hover:border-border transition-colors">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: goal.color }}
              />
              <h3 className="font-semibold text-foreground">{goal.name}</h3>
              <EntityIdBadge id={goal.id} label="Goal" />
              {goal.status === 'completed' && (
                <span className="text-xs bg-[var(--color-income)]/30 text-[var(--color-income)] px-2 py-1 rounded">
                  Completed
                </span>
              )}
              {goal.status === 'paused' && (
                <span className="text-xs bg-[var(--color-warning)]/30 text-[var(--color-warning)] px-2 py-1 rounded">
                  Paused
                </span>
              )}
            </div>
            {goal.description && (
              <p className="text-xs text-muted-foreground mt-1">{goal.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            {onEdit && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onEdit(goal)}
                className="text-muted-foreground hover:text-foreground hover:bg-elevated"
              >
                <Edit2 className="w-4 h-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(goal.id)}
                className="text-muted-foreground hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/20"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">
              ${goal.currentAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })} of $
              {goal.targetAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </span>
            <span className="text-foreground font-semibold">{Math.round(progressPercent)}%</span>
          </div>
          <Progress value={progressPercent} className="h-2 bg-elevated" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 text-center text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Remaining</p>
            <p className="text-foreground font-semibold">
              ${remaining.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </p>
          </div>
          {daysLeft !== null && (
            <div>
              <p className="text-muted-foreground text-xs">Days Left</p>
              <p className={`font-semibold ${daysLeft < 0 ? 'text-[var(--color-error)]' : 'text-foreground'}`}>
                {daysLeft < 0 ? `${Math.abs(daysLeft)} ago` : daysLeft}
              </p>
            </div>
          )}
          <div>
            <p className="text-muted-foreground text-xs">Category</p>
            <p className="text-foreground font-semibold capitalize">{goal.category.replace(/_/g, ' ')}</p>
          </div>
        </div>

        {/* Recommended Monthly Savings */}
        {recommendation?.recommendedMonthly !== null && recommendation?.recommendedMonthly !== undefined && goal.status === 'active' && (
          <div className="bg-elevated/50 border border-border/50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-[var(--color-primary)] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs text-muted-foreground">Recommended Monthly</p>
                  <p className="text-sm font-semibold text-[var(--color-primary)] font-mono">
                    {formatCurrency(recommendation.recommendedMonthly)}/mo
                  </p>
                </div>
                {goal.monthlyContribution && goal.monthlyContribution > 0 && (
                  <div className="flex items-baseline justify-between gap-2 mt-1">
                    <p className="text-xs text-muted-foreground">Your Planned</p>
                    <p className="text-sm font-medium text-foreground font-mono">
                      {formatCurrency(goal.monthlyContribution)}/mo
                    </p>
                  </div>
                )}
              </div>
            </div>
            {recommendation.isTightTimeline && (
              <p className="text-xs text-[var(--color-warning)] mt-2 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-warning)]" />
                Tight timeline
              </p>
            )}
          </div>
        )}

        {/* Milestones */}
        {milestones.length > 0 && (
          <div className="border-t border-border pt-3">
            <button
              onClick={() => setShowMilestones(!showMilestones)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {showMilestones ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              Milestones
            </button>
            {showMilestones && (
              <div className="mt-3 space-y-2">
                {milestones.map((milestone) => (
                  <div key={milestone.id} className="flex items-center gap-3 text-sm">
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-muted-foreground">{milestone.percentage}%</span>
                        <span className="text-muted-foreground">
                          ${milestone.milestoneAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <Progress
                        value={milestone.achievedAt ? 100 : 0}
                        className="h-1.5 bg-elevated"
                      />
                    </div>
                    {milestone.achievedAt && (
                      <Check className="w-4 h-4 text-[var(--color-income)] flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Contribute Button */}
        {goal.status !== 'completed' && (
          <div className="border-t border-border pt-3">
            {!showContribute ? (
              <Button
                onClick={() => setShowContribute(true)}
                className="w-full bg-[var(--color-primary)] hover:opacity-90 text-white"
              >
                Add Contribution
              </Button>
            ) : (
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Amount"
                  value={contributeAmount}
                  onChange={(e) => setContributeAmount(e.target.value)}
                  className="flex-1 bg-elevated border border-border rounded px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-[var(--color-income)]"
                  step="0.01"
                  min="0"
                />
                <Button
                  onClick={handleContribute}
                  className="bg-[var(--color-primary)] hover:opacity-90 text-white"
                >
                  Add
                </Button>
                <Button
                  onClick={() => setShowContribute(false)}
                  variant="outline"
                  className="border-border text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
