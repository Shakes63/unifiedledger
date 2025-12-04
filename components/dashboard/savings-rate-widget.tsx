'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { TrendingUp, TrendingDown, Minus, Target, Wallet } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface SavingsRateData {
  period: string;
  totalIncome: number;
  totalSavingsContributions: number;
  savingsRate: number;
}

interface SavingsRateResponse {
  data: SavingsRateData[];
  summary: {
    averageRate: number;
    totalSaved: number;
    totalIncome: number;
    trend: 'up' | 'down' | 'stable';
  };
}

interface SavingsRateWidgetProps {
  targetRate?: number; // Target savings rate (default: 20%)
}

/**
 * Compact Savings Rate Widget for Dashboard
 * Shows current month savings rate with trend indicator
 * Phase 18: Savings-Goals Integration
 */
export function SavingsRateWidget({ targetRate = 20 }: SavingsRateWidgetProps) {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [currentMonthData, setCurrentMonthData] = useState<SavingsRateData | null>(null);
  const [summary, setSummary] = useState<SavingsRateResponse['summary'] | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!selectedHouseholdId) return;

    try {
      setLoading(true);

      // Get data for last 3 months to show trend
      const now = new Date();
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      
      const params = new URLSearchParams();
      params.append('period', 'monthly');
      params.append('startDate', threeMonthsAgo.toISOString().split('T')[0]);
      params.append('endDate', now.toISOString().split('T')[0]);

      const response = await fetchWithHousehold(`/api/reports/savings-rate?${params.toString()}`);
      
      if (!response.ok) return;

      const result: SavingsRateResponse = await response.json();
      
      // Get current month's data (last item)
      if (result.data.length > 0) {
        setCurrentMonthData(result.data[result.data.length - 1]);
      }
      setSummary(result.summary);
    } catch (err) {
      console.error('Error loading savings rate:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedHouseholdId, fetchWithHousehold]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Get trend icon
  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-[var(--color-income)]" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-[var(--color-expense)]" />;
      default:
        return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  // Get rate color based on comparison to target
  const getRateColor = (rate: number) => {
    if (rate >= targetRate) return 'text-[var(--color-income)]';
    if (rate >= targetRate * 0.5) return 'text-[var(--color-warning)]';
    return 'text-[var(--color-expense)]';
  };

  if (loading) {
    return (
      <Card className="bg-card border-border p-6">
        <div className="text-center py-4">
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </Card>
    );
  }

  const rate = currentMonthData?.savingsRate || 0;
  const progressPercent = Math.min((rate / targetRate) * 100, 100);

  return (
    <Card className="bg-card border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-[var(--color-primary)]" />
          <h3 className="text-lg font-semibold text-foreground">Savings Rate</h3>
        </div>
        <Link href="/dashboard/reports">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            Details
          </Button>
        </Link>
      </div>

      {!currentMonthData ? (
        <div className="text-center py-4">
          <p className="text-muted-foreground text-sm">No savings data yet this month</p>
          <Link href="/dashboard/goals">
            <Button size="sm" className="mt-2 bg-[var(--color-primary)] hover:opacity-90 text-[var(--color-primary-foreground)]">
              Set a Savings Goal
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Current Rate Display */}
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold ${getRateColor(rate)}`}>
                {rate.toFixed(1)}%
              </span>
              {summary && getTrendIcon(summary.trend)}
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Target className="w-3 h-3" />
                <span>Target: {targetRate}%</span>
              </div>
            </div>
          </div>

          {/* Progress to Target */}
          <div className="space-y-1">
            <Progress 
              value={progressPercent} 
              className="h-2 bg-elevated"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                ${currentMonthData.totalSavingsContributions.toLocaleString('en-US', { maximumFractionDigits: 0 })} saved
              </span>
              <span>
                ${currentMonthData.totalIncome.toLocaleString('en-US', { maximumFractionDigits: 0 })} income
              </span>
            </div>
          </div>

          {/* Quick Stats */}
          {summary && (
            <div className="pt-3 border-t border-border flex items-center justify-between text-sm">
              <span className="text-muted-foreground">3-Month Avg</span>
              <span className={`font-medium ${getRateColor(summary.averageRate)}`}>
                {summary.averageRate.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

