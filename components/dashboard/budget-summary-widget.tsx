'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ChevronRight, HelpCircle } from 'lucide-react';
import Decimal from 'decimal.js';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface BudgetSummary {
  adherenceScore: number;
  totalBudget: number;
  totalSpent: number;
  percentage: number;
  onTrack: number;
  warning: number;
  exceeded: number;
  unbudgeted: number;
  hasBudgets: boolean;
}

export function BudgetSummaryWidget() {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<BudgetSummary | null>(null);

  const fetchBudgetSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetchWithHousehold('/api/budgets/overview');

      if (!response.ok) {
        throw new Error('Failed to fetch budget summary');
      }

      const data = await response.json();

      // Calculate summary stats
      const totalBudget = data.summary.totalExpenseBudget || 0;
      const totalSpent = data.summary.totalExpenseActual || 0;
      const percentage =
        totalBudget > 0
          ? new Decimal(totalSpent).div(totalBudget).times(100).toNumber()
          : 0;

      interface BudgetCategory {
        monthlyBudget: number;
        status: string;
      }

      const categoriesWithBudgets = data.categories.filter(
        (c: BudgetCategory) => c.monthlyBudget > 0
      );

      const hasBudgets = categoriesWithBudgets.length > 0;

      const summaryData: BudgetSummary = {
        adherenceScore: data.summary.adherenceScore || 0,
        totalBudget,
        totalSpent,
        percentage,
        onTrack: data.categories.filter((c: BudgetCategory) => c.status === 'on_track').length,
        warning: data.categories.filter((c: BudgetCategory) => c.status === 'warning').length,
        exceeded: data.categories.filter((c: BudgetCategory) => c.status === 'exceeded').length,
        unbudgeted: data.categories.filter((c: BudgetCategory) => c.status === 'unbudgeted')
          .length,
        hasBudgets,
      };

      setSummary(summaryData);
    } catch (err) {
      console.error('Error fetching budget summary:', err);
      if (err instanceof Error && err.message === 'No household selected') {
        setLoading(false);
        return;
      }
      setError('Failed to load budget summary');
    } finally {
      setLoading(false);
    }
  }, [fetchWithHousehold]);

  useEffect(() => {
    if (!selectedHouseholdId) {
      setLoading(false);
      return;
    }
    fetchBudgetSummary();
  }, [selectedHouseholdId, fetchBudgetSummary]);

  // Don't render if there's no data or no budgets
  if (!loading && (!summary || !summary.hasBudgets)) {
    return null;
  }

  // Loading skeleton
  if (loading) {
    return (
      <div
        className="p-5 rounded-xl animate-pulse relative overflow-hidden"
        style={{
          border: '1px solid var(--color-border)',
          background: 'radial-gradient(ellipse 120% 120% at 100% 0%, color-mix(in oklch, var(--color-foreground) 4%, transparent) 0%, transparent 70%), var(--color-background)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 w-32 rounded" style={{ backgroundColor: 'var(--color-muted)' }}></div>
          <div className="h-4 w-20 rounded" style={{ backgroundColor: 'var(--color-muted)' }}></div>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="w-28 h-28 rounded-full" style={{ backgroundColor: 'var(--color-muted)' }}></div>
        </div>
        <div className="space-y-2 mt-4">
          <div className="h-3 rounded w-full" style={{ backgroundColor: 'var(--color-muted)' }}></div>
          <div className="h-3 rounded w-3/4" style={{ backgroundColor: 'var(--color-muted)' }}></div>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return null;
  }

  // Determine adherence label and color
  const getAdherenceInfo = (score: number) => {
    if (score >= 90) {
      return {
        label: 'Excellent',
        color: 'var(--color-success)',
        textColor: 'var(--color-success)',
      };
    } else if (score >= 70) {
      return {
        label: 'Good',
        color: 'var(--color-income)',
        textColor: 'var(--color-income)',
      };
    } else if (score >= 50) {
      return {
        label: 'Fair',
        color: 'var(--color-warning)',
        textColor: 'var(--color-warning)',
      };
    } else {
      return {
        label: 'Needs Work',
        color: 'var(--color-destructive)',
        textColor: 'var(--color-destructive)',
      };
    }
  };

  const adherenceInfo = getAdherenceInfo(summary.adherenceScore);

  // Determine overall status color
  const getStatusColor = () => {
    if (summary.percentage >= 100) {
      return 'var(--color-destructive)';
    } else if (summary.percentage >= 80) {
      return 'var(--color-warning)';
    } else {
      return 'var(--color-success)';
    }
  };

  // Calculate circle stroke (r=44 for w-28 h-28)
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (summary.adherenceScore / 100) * circumference;

  return (
    <Link href="/dashboard/budgets">
      <div
        className="p-5 rounded-xl cursor-pointer transition-opacity hover:opacity-90 relative overflow-hidden"
        style={{
          border: '1px solid var(--color-border)',
          borderLeftWidth: '4px',
          borderLeftColor: adherenceInfo.color,
          background: 'radial-gradient(ellipse 120% 120% at 100% 0%, color-mix(in oklch, var(--color-foreground) 4%, transparent) 0%, transparent 70%), var(--color-background)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>Budget Status</h3>
          <div className="flex items-center gap-0.5 text-[13px] hover:opacity-80" style={{ color: 'var(--color-primary)' }}>
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Adherence Score Circle */}
        <div className="flex flex-col items-center mb-5">
          <div className="relative w-28 h-28">
            <svg className="w-28 h-28 transform -rotate-90">
              <circle
                cx="56"
                cy="56"
                r={radius}
                stroke="var(--color-muted)"
                strokeWidth="8"
                fill="none"
              />
              <circle
                cx="56"
                cy="56"
                r={radius}
                stroke={adherenceInfo.color}
                strokeWidth="8"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold" style={{ color: 'var(--color-foreground)', fontVariantNumeric: 'tabular-nums' }}>
                {summary.adherenceScore}%
              </span>
            </div>
          </div>
          <div className="mt-2 text-center">
            <span className="text-sm font-semibold" style={{ color: adherenceInfo.textColor, fontVariantNumeric: 'tabular-nums' }}>
              {adherenceInfo.label}
            </span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-center gap-1 mt-0.5 cursor-help">
                    <p className="text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-muted-foreground)' }}>Budget Adherence</p>
                    <HelpCircle className="w-3 h-3" style={{ color: 'var(--color-muted-foreground)' }} />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-sm whitespace-pre-line">
                    Budget Adherence measures how well you stay within your set budget limits.{'\n\n'}
                    90%+ Excellent - On track{'\n'}
                    70-89% Good - Minor adjustments needed{'\n'}
                    50-69% Fair - Review spending{'\n'}
                    Below 50% Needs work
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Monthly Progress */}
        <div className="mb-4">
          <span className="text-[10px] uppercase tracking-[0.08em] block mb-2" style={{ color: 'var(--color-muted-foreground)' }}>Monthly Progress</span>
          <div className="mb-2">
            <div className="text-base font-bold" style={{ color: 'var(--color-foreground)', fontVariantNumeric: 'tabular-nums' }}>
              ${summary.totalSpent.toFixed(0)}
            </div>
            <div className="text-xs" style={{ color: 'var(--color-muted-foreground)', fontVariantNumeric: 'tabular-nums' }}>
              / ${summary.totalBudget.toFixed(0)}
            </div>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-muted)' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, summary.percentage)}%`, backgroundColor: getStatusColor() }}
            />
          </div>
        </div>

        {/* Category Status */}
        <div className="flex items-center justify-around text-[12px] pt-4 gap-2" style={{ borderTop: '1px solid var(--color-border)' }}>
          {summary.onTrack > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--color-success)' }}></div>
              <span style={{ color: 'var(--color-muted-foreground)' }}>{summary.onTrack} On Track</span>
            </div>
          )}
          {summary.warning > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--color-warning)' }}></div>
              <span style={{ color: 'var(--color-muted-foreground)' }}>{summary.warning} Warning</span>
            </div>
          )}
          {summary.exceeded > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--color-destructive)' }}></div>
              <span style={{ color: 'var(--color-muted-foreground)' }}>{summary.exceeded} Over</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
