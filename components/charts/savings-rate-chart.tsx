'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { ChartContainer } from './chart-container';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

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

interface SavingsRateChartProps {
  period?: 'monthly' | 'quarterly' | 'yearly';
  startDate?: string;
  endDate?: string;
  targetRate?: number; // Optional target savings rate (default: 20%)
  className?: string;
}

/**
 * Savings Rate Chart Component
 * Shows the savings rate (savings/income ratio) over time
 * Phase 18: Savings-Goals Integration
 */
export function SavingsRateChart({
  period = 'monthly',
  startDate,
  endDate,
  targetRate = 20,
  className = '',
}: SavingsRateChartProps) {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [data, setData] = useState<SavingsRateData[]>([]);
  const [summary, setSummary] = useState<SavingsRateResponse['summary'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!selectedHouseholdId) return;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append('period', period);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetchWithHousehold(`/api/reports/savings-rate?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to load savings rate data');
      }

      const result: SavingsRateResponse = await response.json();
      
      // Transform data for chart
      const chartData = result.data.map(d => ({
        ...d,
        name: formatPeriodLabel(d.period, period),
      }));

      setData(chartData);
      setSummary(result.summary);
    } catch (err) {
      console.error('Error loading savings rate:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [selectedHouseholdId, fetchWithHousehold, period, startDate, endDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Format period label for display
  const formatPeriodLabel = (periodStr: string, periodType: string): string => {
    if (periodType === 'yearly') {
      return periodStr;
    }
    if (periodType === 'quarterly') {
      return periodStr; // Already formatted as "2024-Q1"
    }
    // Monthly: "2024-01" -> "Jan 24"
    const [year, month] = periodStr.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[parseInt(month) - 1]} '${year.slice(2)}`;
  };

  // Get trend icon
  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-(--color-income)" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-(--color-expense)" />;
      default:
        return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) => {
    if (!active || !payload || !payload.length) return null;

    const dataPoint = data.find(d => (d as unknown as { name: string }).name === label);
    
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium text-foreground mb-2">{label}</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground">Savings Rate</span>
            <span className="font-semibold text-(--color-primary)">
              {payload[0].value.toFixed(1)}%
            </span>
          </div>
          {dataPoint && (
            <>
              <div className="flex items-center justify-between gap-4 text-xs">
                <span className="text-muted-foreground">Saved</span>
                <span className="text-(--color-income)">
                  ${dataPoint.totalSavingsContributions.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 text-xs">
                <span className="text-muted-foreground">Income</span>
                <span className="text-foreground">
                  ${dataPoint.totalIncome.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <ChartContainer
      title="Savings Rate"
      description="Percentage of income saved over time"
      isLoading={loading}
      error={error}
      className={className}
    >
      {/* Summary Stats */}
      {summary && (
        <div className="flex items-center gap-6 mb-4 pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Average</span>
            <span className="text-lg font-semibold text-(--color-primary)">
              {summary.averageRate.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Total Saved</span>
            <span className="text-lg font-semibold text-(--color-income)">
              ${summary.totalSaved.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Trend</span>
            {getTrendIcon(summary.trend)}
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={280}>
        <RechartsLineChart
          data={data}
          margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="name"
            stroke="var(--color-muted-foreground)"
            style={{ fontSize: '11px' }}
            tickMargin={8}
          />
          <YAxis
            stroke="var(--color-muted-foreground)"
            style={{ fontSize: '11px' }}
            tickFormatter={(value) => `${value}%`}
            domain={[0, 'auto']}
          />
          <Tooltip content={<CustomTooltip />} />
          
          {/* Target rate reference line */}
          <ReferenceLine
            y={targetRate}
            stroke="var(--color-income)"
            strokeDasharray="5 5"
            strokeOpacity={0.6}
            label={{
              value: `${targetRate}% Target`,
              position: 'insideTopRight',
              fill: 'var(--color-income)',
              fontSize: 10,
            }}
          />
          
          <Line
            type="monotone"
            dataKey="savingsRate"
            stroke="var(--color-primary)"
            strokeWidth={2}
            dot={{ r: 4, fill: 'var(--color-primary)' }}
            activeDot={{ r: 6, fill: 'var(--color-primary)' }}
            isAnimationActive={true}
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

