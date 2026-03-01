'use client';

import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Edit2, Trash2, Lightbulb, History, Plus, CheckCircle2, PauseCircle, Flame,
} from 'lucide-react';
import { EntityIdBadge } from '@/components/dev/entity-id-badge';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import {
  calculateRecommendedMonthlySavings,
  formatCurrency,
} from '@/lib/goals/calculate-recommended-savings';
import { GoalContributionsList } from './goal-contributions-list';

interface Milestone {
  id: string;
  percentage: number;
  milestoneAmount: number;
  achievedAt?: string;
}

export interface GoalData {
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
}

interface GoalTrackerProps {
  goal: GoalData;
  milestones?: Milestone[];
  onEdit?: (goal: GoalData) => void;
  onDelete?: (goalId: string) => void;
  onContribute?: (goalId: string, amount: number) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  emergency_fund: 'Emergency Fund',
  vacation: 'Vacation',
  purchase: 'Purchase',
  education: 'Education',
  home: 'Home',
  vehicle: 'Vehicle',
  retirement: 'Retirement',
  debt_payoff: 'Debt Payoff',
  other: 'Other',
};

function fmt(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
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
  const [contributeAmount, setContributeAmount] = useState('');
  const [contributing, setContributing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const progressPercent = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
  const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0);
  const daysLeft = goal.targetDate
    ? Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / 86_400_000)
    : null;

  const recommendation = useMemo(() => {
    if (goal.status !== 'active') return null;
    return calculateRecommendedMonthlySavings(goal.targetAmount, goal.currentAmount, goal.targetDate);
  }, [goal.targetAmount, goal.currentAmount, goal.targetDate, goal.status]);

  const handleContribute = async () => {
    if (!selectedHouseholdId) { toast.error('Please select a household'); return; }
    const amount = parseFloat(contributeAmount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }

    try {
      setContributing(true);
      const res = await putWithHousehold(`/api/savings-goals/${goal.id}/progress`, { increment: amount });
      if (!res.ok) throw new Error();

      const updated = await res.json();
      if (updated.milestones) {
        const newlyAchieved = updated.milestones.filter(
          (m: Milestone) => m.achievedAt && !milestones.find(e => e.id === m.id && e.achievedAt),
        );
        newlyAchieved.forEach((m: Milestone) => {
          toast.success(`Milestone! ${m.percentage}% achieved!`);
        });
      }

      setContributeAmount('');
      onContribute?.(goal.id, amount);
      toast.success(`+${fmt(amount)} added to ${goal.name}`);
    } catch {
      toast.error('Failed to add contribution');
    } finally {
      setContributing(false);
    }
  };

  // Derived colors
  const daysColor =
    daysLeft === null ? 'var(--color-muted-foreground)'
    : daysLeft < 0  ? 'var(--color-error)'
    : daysLeft < 30 ? 'var(--color-warning)'
    : 'var(--color-muted-foreground)';

  const isCompleted = goal.status === 'completed';
  const isPaused    = goal.status === 'paused';

  return (
    <div
      className="rounded-xl overflow-hidden transition-shadow duration-200"
      style={{
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-background)',
        borderLeft: `3px solid ${goal.color}`,
        boxShadow: '0 1px 3px color-mix(in oklch, var(--color-foreground) 4%, transparent)',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 16px color-mix(in oklch, ${goal.color} 18%, transparent)`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px color-mix(in oklch, var(--color-foreground) 4%, transparent)';
      }}
    >
      <div className="p-4 space-y-3.5">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Color dot */}
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: goal.color }} />
              <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--color-foreground)' }}>
                {goal.name}
              </span>
              {/* Status badges */}
              {isCompleted && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-px rounded-full shrink-0"
                  style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 14%, transparent)', color: 'var(--color-success)' }}
                >
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  Done
                </span>
              )}
              {isPaused && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-px rounded-full shrink-0"
                  style={{ backgroundColor: 'color-mix(in oklch, var(--color-warning) 14%, transparent)', color: 'var(--color-warning)' }}
                >
                  <PauseCircle className="w-2.5 h-2.5" />
                  Paused
                </span>
              )}
              <EntityIdBadge id={goal.id} label="Goal" />
            </div>
            {/* Category + date row */}
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-medium px-1.5 py-px rounded" style={{ backgroundColor: 'var(--color-elevated)', color: 'var(--color-muted-foreground)' }}>
                {CATEGORY_LABELS[goal.category] ?? goal.category}
              </span>
              {goal.targetDate && (
                <span className="text-[10px] font-mono" style={{ color: daysColor }}>
                  {daysLeft === null ? '' : daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft}d left`}
                </span>
              )}
            </div>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => setShowHistory(h => !h)}
              className="w-7 h-7 rounded flex items-center justify-center transition-colors"
              style={{ color: showHistory ? 'var(--color-foreground)' : 'var(--color-muted-foreground)' }}
              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-elevated)')}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
              title="Contribution history"
            >
              <History className="w-3.5 h-3.5" />
            </button>
            {onEdit && (
              <button
                onClick={() => onEdit(goal)}
                className="w-7 h-7 rounded flex items-center justify-center transition-colors"
                style={{ color: 'var(--color-muted-foreground)' }}
                onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-elevated)')}
                onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(goal.id)}
                className="w-7 h-7 rounded flex items-center justify-center transition-colors"
                style={{ color: 'var(--color-muted-foreground)' }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'color-mix(in oklch, var(--color-error) 12%, transparent)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-error)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted-foreground)';
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ── Progress gauge ───────────────────────────────────────────── */}
        <div className="space-y-1.5">
          {/* Labels row */}
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-mono tabular-nums" style={{ color: 'var(--color-muted-foreground)' }}>
              <span className="text-[13px] font-semibold" style={{ color: goal.color }}>
                {fmt(goal.currentAmount)}
              </span>
              {' '}of {fmt(goal.targetAmount)}
            </span>
            <span
              className="text-[15px] font-bold font-mono tabular-nums"
              style={{ color: Math.round(progressPercent) >= 100 ? 'var(--color-success)' : goal.color }}
            >
              {Math.round(progressPercent)}%
            </span>
          </div>

          {/* Track */}
          <div
            className="relative h-3 rounded-full overflow-hidden"
            style={{ backgroundColor: 'color-mix(in oklch, var(--color-elevated) 80%, transparent)' }}
          >
            {/* Fill */}
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
              style={{
                width: `${progressPercent}%`,
                background: progressPercent >= 100
                  ? `linear-gradient(to right, ${goal.color}, color-mix(in oklch, ${goal.color} 70%, var(--color-success)))`
                  : `linear-gradient(to right, color-mix(in oklch, ${goal.color} 75%, transparent), ${goal.color})`,
              }}
            />
            {/* Milestone markers */}
            {milestones.map(m => (
              <div
                key={m.id}
                className="absolute top-0 bottom-0 w-px"
                style={{
                  left: `${m.percentage}%`,
                  backgroundColor: m.achievedAt
                    ? 'color-mix(in oklch, var(--color-background) 60%, transparent)'
                    : 'color-mix(in oklch, var(--color-foreground) 25%, transparent)',
                }}
              />
            ))}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>
            <span className="font-mono tabular-nums">
              {fmt(remaining)} remaining
            </span>
            {goal.description && (
              <span className="truncate opacity-70">{goal.description}</span>
            )}
          </div>
        </div>

        {/* ── Recommendation hint ──────────────────────────────────────── */}
        {recommendation?.recommendedMonthly != null && !isCompleted && (
          <div
            className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
            style={{ backgroundColor: 'color-mix(in oklch, var(--color-elevated) 60%, transparent)', border: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)' }}
          >
            <Lightbulb className="w-3 h-3 shrink-0" style={{ color: goal.color }} />
            <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
              <span className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>
                Recommended monthly
              </span>
              <span className="text-[12px] font-mono font-semibold tabular-nums shrink-0" style={{ color: goal.color }}>
                {formatCurrency(recommendation.recommendedMonthly)}/mo
              </span>
            </div>
            {recommendation.isTightTimeline && (
              <Flame className="w-3 h-3 shrink-0" style={{ color: 'var(--color-warning)' }} />
            )}
          </div>
        )}

        {/* ── Contribute ───────────────────────────────────────────────── */}
        {!isCompleted && (
          <div className="flex items-center gap-2 pt-0.5">
            <div
              className="flex-1 flex items-center gap-1.5 rounded-lg px-3 h-8"
              style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-elevated)' }}
            >
              <span className="text-[12px] font-mono" style={{ color: 'var(--color-muted-foreground)' }}>$</span>
              <input
                type="number"
                placeholder="0.00"
                value={contributeAmount}
                onChange={e => setContributeAmount(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleContribute()}
                className="flex-1 bg-transparent text-[12px] font-mono outline-none tabular-nums min-w-0"
                style={{ color: 'var(--color-foreground)' }}
                step="0.01"
                min="0"
              />
            </div>
            <button
              onClick={handleContribute}
              disabled={contributing || !contributeAmount}
              className="h-8 px-3 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-opacity disabled:opacity-40"
              style={{ backgroundColor: goal.color, color: '#fff' }}
            >
              {contributing ? '…' : <><Plus className="w-3 h-3" /> Add</>}
            </button>
          </div>
        )}

        {/* ── Contribution history ─────────────────────────────────────── */}
        {showHistory && (
          <div
            className="rounded-lg overflow-hidden"
            style={{ border: '1px solid var(--color-border)' }}
          >
            <GoalContributionsList goalId={goal.id} showHeader={false} maxHeight="280px" />
          </div>
        )}
      </div>
    </div>
  );
}
