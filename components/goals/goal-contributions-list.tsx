'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { Target, TrendingUp, Clock, Wallet, ChevronDown, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface Contribution {
  id: string;
  transactionId: string;
  amount: number;
  createdAt: string;
  transactionDescription?: string | null;
  transactionDate?: string | null;
  accountName?: string | null;
}

interface GoalInfo {
  id: string;
  name: string;
  color: string;
  targetAmount: number;
  currentAmount: number;
}

interface ContributionsResponse {
  contributions: Contribution[];
  total: number;
  runningTotal: number;
  goal: GoalInfo;
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface GoalContributionsListProps {
  goalId: string;
  showHeader?: boolean;
  maxHeight?: string;
}

/**
 * Goal Contributions List Component
 * Shows the contribution history for a savings goal with timeline display
 * Phase 18: Savings-Goals Integration
 */
export function GoalContributionsList({
  goalId,
  showHeader = true,
  maxHeight = '400px',
}: GoalContributionsListProps) {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [goal, setGoal] = useState<GoalInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const loadContributions = useCallback(async (reset: boolean = false) => {
    if (!selectedHouseholdId || !goalId) return;

    try {
      if (reset) {
        setLoading(true);
        setOffset(0);
      } else {
        setLoadingMore(true);
      }

      const currentOffset = reset ? 0 : offset;
      const response = await fetchWithHousehold(
        `/api/savings-goals/${goalId}/contributions?limit=${limit}&offset=${currentOffset}`
      );

      if (!response.ok) {
        throw new Error('Failed to load contributions');
      }

      const data: ContributionsResponse = await response.json();

      if (reset) {
        setContributions(data.contributions);
      } else {
        setContributions(prev => [...prev, ...data.contributions]);
      }

      setGoal(data.goal);
      setHasMore(data.pagination.hasMore);
      setOffset(currentOffset + data.contributions.length);
    } catch (error) {
      console.error('Error loading contributions:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [selectedHouseholdId, goalId, fetchWithHousehold, offset]);

  useEffect(() => {
    loadContributions(true);
  }, [goalId, selectedHouseholdId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadContributions(false);
    }
  };

  // Calculate running total for display
  const calculateRunningTotal = (index: number): number => {
    return contributions
      .slice(0, index + 1)
      .reduce((sum, c) => sum + c.amount, 0);
  };

  if (loading) {
    return (
      <div
        className="p-6"
        style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}
      >
        <div className="text-center py-8">
          <p style={{ color: 'var(--color-muted-foreground)' }}>Loading contributions...</p>
        </div>
      </div>
    );
  }

  if (!goal) {
    return (
      <div
        className="p-6"
        style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}
      >
        <div className="text-center py-8">
          <p style={{ color: 'var(--color-muted-foreground)' }}>Goal not found</p>
        </div>
      </div>
    );
  }

  const progressPercent = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);

  return (
    <div style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
      {/* Header */}
      {showHeader && (
        <div className="p-6" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${goal.color}20` }}
              >
                <Target className="w-5 h-5" style={{ color: goal.color }} />
              </div>
              <div>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--color-foreground)' }}>{goal.name}</h3>
                <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                  {contributions.length} contribution{contributions.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <Link href="/dashboard/goals">
              <Button variant="ghost" size="sm" className="hover:text-[var(--color-foreground)]" style={{ color: 'var(--color-muted-foreground)' }}>
                View Goal <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--color-muted-foreground)' }}>
                ${goal.currentAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </span>
              <span className="font-medium" style={{ color: 'var(--color-foreground)' }}>
                {Math.round(progressPercent)}%
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" style={{ backgroundColor: 'var(--color-elevated)' }} />
            <p className="text-xs text-right" style={{ color: 'var(--color-muted-foreground)' }}>
              of ${goal.targetAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })} target
            </p>
          </div>
        </div>
      )}

      {/* Contributions Timeline */}
      <div 
        className="overflow-y-auto"
        style={{ maxHeight }}
      >
        {contributions.length === 0 ? (
          <div className="p-6 text-center">
            <TrendingUp className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--color-muted-foreground)' }} />
            <p style={{ color: 'var(--color-muted-foreground)' }}>No contributions yet</p>
            <p className="text-sm mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
              Transfers to this goal will appear here
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div
              className="absolute left-9 top-0 bottom-0 w-0.5"
              style={{ backgroundColor: 'var(--color-border)' }}
              aria-hidden="true"
            />

            {/* Contribution items */}
            <div className="divide-y divide-[var(--color-border)]">
              {contributions.map((contribution, index) => (
                <div
                  key={contribution.id}
                  className="relative p-4 pl-16 transition-colors hover:bg-[color-mix(in_oklch,var(--color-elevated)_50%,transparent)]"
                >
                  {/* Timeline dot */}
                  <div
                    className="absolute left-[30px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 z-10"
                    style={{ backgroundColor: goal.color, borderColor: 'var(--color-background)' }}
                  />

                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Amount and description */}
                      <div className="flex items-baseline gap-2 mb-1">
                        <span 
                          className="text-lg font-semibold"
                          style={{ color: goal.color }}
                        >
                          +${contribution.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        {contribution.transactionDescription && (
                          <span className="text-sm truncate" style={{ color: 'var(--color-muted-foreground)' }}>
                            {contribution.transactionDescription}
                          </span>
                        )}
                      </div>

                      {/* Metadata */}
                      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(parseISO(contribution.createdAt), { addSuffix: true })}
                        </span>
                        {contribution.accountName && (
                          <span className="flex items-center gap-1">
                            <Wallet className="w-3 h-3" />
                            {contribution.accountName}
                          </span>
                        )}
                        {contribution.transactionDate && (
                          <span
                            className="text-xs py-0 px-2 rounded-md border"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
                          >
                            {format(parseISO(contribution.transactionDate), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Running total */}
                    <div className="text-right shrink-0">
                      <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Running total</p>
                      <p className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
                        ${calculateRunningTotal(index).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Load More */}
        {hasMore && (
          <div className="p-4" style={{ borderTop: '1px solid var(--color-border)' }}>
            <Button
              onClick={handleLoadMore}
              disabled={loadingMore}
              variant="ghost"
              className="w-full hover:text-[var(--color-foreground)]"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              {loadingMore ? (
                'Loading...'
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-2" />
                  Load More
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

