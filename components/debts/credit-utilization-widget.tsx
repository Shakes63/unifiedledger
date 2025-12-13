'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CreditCard, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { getUtilizationEmoji } from '@/lib/debts/credit-utilization-utils';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';

interface CreditUtilizationData {
  cards: Array<{
    debtId: string;
    name: string;
    balance: number;
    creditLimit: number;
    utilization: number;
    level: string;
    color: string;
    recommendation: string;
    paymentToTarget: number | null;
  }>;
  summary: {
    totalBalance: number;
    totalCreditLimit: number;
    totalAvailable: number;
    avgUtilization: number;
    overallUtilization: number;
    level: string;
    cardsOverTarget: number;
    healthScore: number;
  };
}

export function CreditUtilizationWidget() {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [data, setData] = useState<CreditUtilizationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!selectedHouseholdId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await fetchWithHousehold('/api/debts/credit-utilization');

        if (!response.ok) {
          throw new Error('Failed to fetch credit utilization data');
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error('Error fetching credit utilization:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [selectedHouseholdId, fetchWithHousehold]);

  // Don't show widget if no credit cards with limits
  if (!isLoading && (!data || data.cards.length === 0)) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 h-full">
        <div className="animate-pulse space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-elevated rounded-lg" />
            <div className="flex-1">
              <div className="h-4 bg-elevated rounded w-32 mb-2" />
              <div className="h-3 bg-elevated rounded w-24" />
            </div>
          </div>
          <div className="flex items-center justify-center py-8">
            <div className="w-32 h-32 bg-elevated rounded-full" />
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-elevated rounded w-full" />
            <div className="h-3 bg-elevated rounded w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 h-full">
        <div className="flex flex-col items-center justify-center h-full text-center">
          <AlertCircle className="w-12 h-12 text-error mb-3" />
          <p className="text-sm text-muted-foreground">Failed to load credit utilization</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 text-xs text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { summary } = data;
  const utilization = summary.overallUtilization;
  const emoji = getUtilizationEmoji(utilization);

  // Color based on health level
  const getColor = () => {
    if (summary.level === 'excellent' || summary.level === 'good') {
      return 'var(--color-success)';
    }
    if (summary.level === 'fair') {
      return 'var(--color-warning)';
    }
    return 'var(--color-error)';
  };

  const color = getColor();

  // Progress ring calculation (0-100%)
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, utilization);
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <Link href="/dashboard/debts" className="block h-full">
      <div className="bg-card border border-border rounded-xl p-6 h-full hover:bg-elevated transition-colors">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-elevated rounded-lg">
            <CreditCard className="w-6 h-6" style={{ color }} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">Credit Utilization</h3>
            <p className="text-xs text-muted-foreground">
              {data.cards.length} card{data.cards.length !== 1 ? 's' : ''} tracked
            </p>
          </div>
        </div>

        {/* Progress Ring */}
        <div className="flex items-center justify-center mb-6">
          <div className="relative">
            <svg width="140" height="140" className="transform -rotate-90">
              {/* Background circle */}
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke="var(--color-border)"
                strokeWidth="8"
              />
              {/* Progress circle */}
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl mb-1">{emoji}</span>
              <span className="text-2xl font-bold" style={{ color }}>
                {utilization.toFixed(1)}%
              </span>
              <span className="text-xs text-muted-foreground mt-1">Overall</span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-elevated rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Available</span>
            </div>
            <p className="text-sm font-semibold font-mono text-foreground">
              ${summary.totalAvailable.toLocaleString()}
            </p>
          </div>

          <div className="bg-elevated rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              {summary.cardsOverTarget > 0 ? (
                <AlertCircle className="w-3 h-3 text-warning" />
              ) : (
                <CheckCircle className="w-3 h-3 text-success" />
              )}
              <span className="text-xs text-muted-foreground">Over 30%</span>
            </div>
            <p
              className="text-sm font-semibold"
              style={{
                color: summary.cardsOverTarget > 0 ? 'var(--color-warning)' : 'var(--color-success)',
              }}
            >
              {summary.cardsOverTarget} card{summary.cardsOverTarget !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Health Score */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Health Score</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-elevated rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${summary.healthScore}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
              <span className="text-xs font-semibold" style={{ color }}>
                {summary.healthScore}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
