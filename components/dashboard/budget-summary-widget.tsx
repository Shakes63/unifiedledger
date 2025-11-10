'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { ChevronRight } from 'lucide-react';
import Decimal from 'decimal.js';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<BudgetSummary | null>(null);

  useEffect(() => {
    fetchBudgetSummary();
  }, []);

  const fetchBudgetSummary = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/budgets/overview');

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

      const categoriesWithBudgets = data.categories.filter(
        (c: any) => c.monthlyBudget > 0
      );

      const hasBudgets = categoriesWithBudgets.length > 0;

      const summaryData: BudgetSummary = {
        adherenceScore: data.summary.adherenceScore || 0,
        totalBudget,
        totalSpent,
        percentage,
        onTrack: data.categories.filter((c: any) => c.status === 'on_track').length,
        warning: data.categories.filter((c: any) => c.status === 'warning').length,
        exceeded: data.categories.filter((c: any) => c.status === 'exceeded').length,
        unbudgeted: data.categories.filter((c: any) => c.status === 'unbudgeted')
          .length,
        hasBudgets,
      };

      setSummary(summaryData);
    } catch (err) {
      console.error('Error fetching budget summary:', err);
      setError('Failed to load budget summary');
    } finally {
      setLoading(false);
    }
  };

  // Don't render if there's no data or no budgets
  if (!loading && (!summary || !summary.hasBudgets)) {
    return null;
  }

  // Loading skeleton
  if (loading) {
    return (
      <Card
        className="p-6 border rounded-xl animate-pulse"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 w-32 bg-muted rounded"></div>
          <div className="h-4 w-20 bg-muted rounded"></div>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="w-24 h-24 bg-muted rounded-full"></div>
        </div>
        <div className="space-y-2 mt-4">
          <div className="h-3 bg-muted rounded w-full"></div>
          <div className="h-3 bg-muted rounded w-3/4"></div>
        </div>
      </Card>
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
        textColor: 'text-[var(--color-success)]',
      };
    } else if (score >= 70) {
      return {
        label: 'Good',
        color: 'var(--color-income)',
        textColor: 'text-[var(--color-income)]',
      };
    } else if (score >= 50) {
      return {
        label: 'Fair',
        color: 'var(--color-warning)',
        textColor: 'text-[var(--color-warning)]',
      };
    } else {
      return {
        label: 'Needs Work',
        color: 'var(--color-error)',
        textColor: 'text-[var(--color-error)]',
      };
    }
  };

  const adherenceInfo = getAdherenceInfo(summary.adherenceScore);

  // Determine overall status color
  const getStatusColor = () => {
    if (summary.percentage >= 100) {
      return 'bg-[var(--color-error)]';
    } else if (summary.percentage >= 80) {
      return 'bg-[var(--color-warning)]';
    } else {
      return 'bg-[var(--color-success)]';
    }
  };

  // Calculate circle stroke
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (summary.adherenceScore / 100) * circumference;

  return (
    <Link href="/dashboard/budgets">
      <Card
        className="p-6 border rounded-xl cursor-pointer hover:bg-elevated transition-colors"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-medium text-foreground">Budget Status</h3>
          <div className="flex items-center gap-1 text-xs text-[var(--color-primary)] hover:opacity-80">
            <span>View All</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>

        {/* Adherence Score Circle */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative w-24 h-24">
            <svg className="w-24 h-24 transform -rotate-90">
              {/* Background circle */}
              <circle
                cx="48"
                cy="48"
                r={radius}
                stroke="var(--color-muted)"
                strokeWidth="8"
                fill="none"
              />
              {/* Progress circle */}
              <circle
                cx="48"
                cy="48"
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
              <span className="text-2xl font-bold text-foreground">
                {summary.adherenceScore}%
              </span>
            </div>
          </div>
          <div className="mt-2 text-center">
            <span className={`text-sm font-semibold ${adherenceInfo.textColor}`}>
              {adherenceInfo.label}
            </span>
            <p className="text-xs text-muted-foreground mt-0.5">Budget Adherence</p>
          </div>
        </div>

        {/* Monthly Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">This Month</span>
            <span className="text-xs font-semibold text-foreground">
              {summary.percentage.toFixed(0)}%
            </span>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-lg font-bold text-foreground">
              ${summary.totalSpent.toFixed(0)}
            </span>
            <span className="text-xs text-muted-foreground">
              / ${summary.totalBudget.toFixed(0)}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${getStatusColor()}`}
              style={{ width: `${Math.min(100, summary.percentage)}%` }}
            />
          </div>
        </div>

        {/* Category Status */}
        <div className="flex items-center justify-between text-xs pt-4 border-t border-border">
          {summary.onTrack > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-[var(--color-success)]"></div>
              <span className="text-muted-foreground">{summary.onTrack} On Track</span>
            </div>
          )}
          {summary.warning > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-[var(--color-warning)]"></div>
              <span className="text-muted-foreground">{summary.warning} Warning</span>
            </div>
          )}
          {summary.exceeded > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-[var(--color-error)]"></div>
              <span className="text-muted-foreground">{summary.exceeded} Over</span>
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}
