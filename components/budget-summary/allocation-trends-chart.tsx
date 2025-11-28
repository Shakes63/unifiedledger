'use client';

import React, { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface TrendsData {
  months: string[];
  income: number[];
  expenses: number[];
  savings: number[];
  surplus: number[];
}

interface AllocationTrendsChartProps {
  data: TrendsData;
}

interface ChartDataPoint {
  month: string;
  monthLabel: string;
  income: number;
  expenses: number;
  savings: number;
  surplus: number;
}

// Tooltip payload item type for this chart
interface TrendsTooltipPayloadItem {
  value: number;
  name?: string;
  dataKey?: string;
  color: string;
  payload?: ChartDataPoint;
}

// Custom tooltip component - defined outside to avoid recreation
function TrendsTooltip({ 
  active, 
  payload, 
  label,
  chartData 
}: { 
  active?: boolean; 
  payload?: TrendsTooltipPayloadItem[]; 
  label?: string | number;
  chartData: ChartDataPoint[];
}) {
  if (active && payload && payload.length) {
    const labelStr = typeof label === 'string' ? label : String(label);
    const monthData = chartData.find(d => d.monthLabel === labelStr);
    const [year, month] = monthData?.month?.split('-') || [];
    const fullMonth = year && month 
      ? new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', { 
          month: 'long', 
          year: 'numeric' 
        })
      : labelStr;

    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="font-semibold text-foreground mb-2">{fullMonth}</p>
        {payload.map((entry: TrendsTooltipPayloadItem, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{entry.name}</span>
            </div>
            <span className="font-mono" style={{ color: entry.color }}>
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export function AllocationTrendsChart({ data }: AllocationTrendsChartProps) {
  const [visibleSeries, setVisibleSeries] = useState({
    income: true,
    expenses: true,
    savings: true,
    surplus: true,
  });

  // Format currency
  const formatCurrency = (amount: number): string => {
    if (Math.abs(amount) >= 1000) {
      return `$${(amount / 1000).toFixed(1)}k`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format month label for display
  const formatMonthLabel = (monthStr: string): string => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short' });
  };

  // Transform data for recharts
  const chartData = useMemo(() => data.months.map((month, index) => ({
    month,
    monthLabel: formatMonthLabel(month),
    income: data.income[index] || 0,
    expenses: data.expenses[index] || 0,
    savings: data.savings[index] || 0,
    surplus: data.surplus[index] || 0,
  })), [data.months, data.income, data.expenses, data.savings, data.surplus]);

  // Toggle series visibility
  const toggleSeries = (series: keyof typeof visibleSeries) => {
    setVisibleSeries(prev => ({
      ...prev,
      [series]: !prev[series],
    }));
  };

  // Memoize tooltip with chartData
  const tooltipContent = useMemo(() => 
    function TrendsTooltipWrapper(props: { active?: boolean; payload?: TrendsTooltipPayloadItem[]; label?: string | number }) {
      return <TrendsTooltip {...props} chartData={chartData} />;
    }, [chartData]);

  // Series configuration
  const seriesConfig = [
    { 
      key: 'income', 
      name: 'Income', 
      color: '#22c55e', // Success green
      cssVar: 'var(--color-income)',
    },
    { 
      key: 'expenses', 
      name: 'Expenses', 
      color: '#ef4444', // Error red
      cssVar: 'var(--color-expense)',
    },
    { 
      key: 'savings', 
      name: 'Savings', 
      color: '#3b82f6', // Blue
      cssVar: 'var(--color-transfer)',
    },
    { 
      key: 'surplus', 
      name: 'Surplus', 
      color: '#10b981', // Teal
      cssVar: 'var(--color-success)',
    },
  ];

  // Check if we have any data
  const hasData = chartData.length > 0 && 
    chartData.some(d => d.income > 0 || d.expenses > 0 || d.savings > 0);

  if (!hasData) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="font-semibold text-foreground mb-4">6-Month Trends</h3>
        <div className="flex items-center justify-center h-48">
          <p className="text-muted-foreground">
            Not enough historical data to show trends
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">6-Month Trends</h3>
        
        {/* Series Toggles */}
        <div className="flex flex-wrap gap-2">
          {seriesConfig.map((series) => (
            <button
              key={series.key}
              onClick={() => toggleSeries(series.key as keyof typeof visibleSeries)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors ${
                visibleSeries[series.key as keyof typeof visibleSeries]
                  ? 'bg-elevated'
                  : 'bg-transparent opacity-50'
              }`}
            >
              <div 
                className={`w-2 h-2 rounded-full ${
                  visibleSeries[series.key as keyof typeof visibleSeries] 
                    ? '' 
                    : 'opacity-50'
                }`}
                style={{ backgroundColor: series.color }}
              />
              <span className="text-muted-foreground">{series.name}</span>
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            {seriesConfig.map((series) => (
              <linearGradient
                key={series.key}
                id={`gradient-${series.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor={series.color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={series.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="var(--color-border)"
            opacity={0.5}
          />
          
          <XAxis 
            dataKey="monthLabel" 
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
          />
          
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
            tickFormatter={formatCurrency}
            width={60}
          />
          
          <Tooltip content={tooltipContent} />

          {seriesConfig.map((series) => (
            visibleSeries[series.key as keyof typeof visibleSeries] && (
              <Area
                key={series.key}
                type="monotone"
                dataKey={series.key}
                name={series.name}
                stroke={series.color}
                fill={`url(#gradient-${series.key})`}
                strokeWidth={2}
              />
            )
          ))}
        </AreaChart>
      </ResponsiveContainer>

      {/* Quick Summary */}
      <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-border">
        {seriesConfig.map((series) => {
          const values = chartData.map(d => d[series.key as keyof typeof d] as number);
          const avg = values.reduce((a, b) => a + b, 0) / values.length;
          const latest = values[values.length - 1] || 0;
          const previous = values[values.length - 2] || 0;
          const change = previous > 0 
            ? ((latest - previous) / previous) * 100 
            : 0;

          return (
            <div key={series.key} className="text-center">
              <p className="text-xs text-muted-foreground mb-1">{series.name}</p>
              <p 
                className="text-sm font-mono font-semibold"
                style={{ color: series.color }}
              >
                {formatCurrency(avg)}
              </p>
              <p className={`text-xs ${change >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
                {change >= 0 ? '+' : ''}{change.toFixed(1)}%
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

