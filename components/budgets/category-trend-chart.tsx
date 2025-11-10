'use client';

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface CategoryTrendChartProps {
  categoryName: string;
  data: Array<{
    month: string;
    budgeted: number;
    actual: number;
  }>;
  trend: {
    direction: 'increasing' | 'decreasing' | 'stable';
    percentChange: number;
  };
  height?: number;
}

/**
 * Custom tooltip for category trend
 */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  // Format month
  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const budgetedData = payload.find((p: any) => p.dataKey === 'budgeted');
  const actualData = payload.find((p: any) => p.dataKey === 'actual');

  const variance =
    actualData && budgetedData
      ? (actualData.value as number) - (budgetedData.value as number)
      : 0;

  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
      <p className="text-sm font-semibold text-foreground mb-2">{formatMonth(label)}</p>
      <div className="space-y-1">
        {budgetedData && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground">Budgeted:</span>
            <span className="text-xs font-semibold text-foreground">
              {formatCurrency(budgetedData.value as number)}
            </span>
          </div>
        )}
        {actualData && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground">Actual:</span>
            <span className="text-xs font-semibold text-foreground">
              {formatCurrency(actualData.value as number)}
            </span>
          </div>
        )}
        {variance !== 0 && (
          <div className="flex items-center justify-between gap-4 pt-1 border-t border-border">
            <span className="text-xs text-muted-foreground">Variance:</span>
            <span
              className={`text-xs font-semibold ${
                variance < 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'
              }`}
            >
              {variance < 0 ? '-' : '+'}
              {formatCurrency(Math.abs(variance))}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Category trend chart showing budgeted vs actual over time
 */
export function CategoryTrendChart({
  categoryName,
  data,
  trend,
  height = 220,
}: CategoryTrendChartProps) {
  // Format month for X-axis
  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'short' });
  };

  // Format currency for Y-axis
  const formatCurrency = (value: number) => {
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}k`;
    }
    return `$${value}`;
  };

  // Get CSS variable values for colors
  const getColor = (variable: string) => {
    if (typeof window !== 'undefined') {
      const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
      return value || '#666';
    }
    return '#666';
  };

  const primaryColor = getColor('--color-primary');
  const mutedColor = getColor('--color-muted-foreground');
  const gridColor = getColor('--color-border');
  const textColor = getColor('--color-muted-foreground');

  // Get trend color and icon
  const getTrendColor = () => {
    if (trend.direction === 'increasing') return 'text-[var(--color-error)]';
    if (trend.direction === 'decreasing') return 'text-[var(--color-success)]';
    return 'text-muted-foreground';
  };

  const getTrendIcon = () => {
    if (trend.direction === 'increasing') return '↗️';
    if (trend.direction === 'decreasing') return '↘️';
    return '→';
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 bg-card border border-border rounded-xl">
        <p className="text-muted-foreground text-sm">No data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header with trend indicator */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">{categoryName}</h4>
        <div className={`flex items-center gap-1 text-xs font-medium ${getTrendColor()}`}>
          <span>{getTrendIcon()}</span>
          <span>
            {Math.abs(trend.percentChange).toFixed(1)}%{' '}
            {trend.direction === 'stable' ? '' : trend.direction}
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="w-full" style={{ height: `${height}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id={`gradient-budgeted-${categoryName}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={mutedColor} stopOpacity={0.1} />
                <stop offset="95%" stopColor={mutedColor} stopOpacity={0} />
              </linearGradient>
              <linearGradient id={`gradient-actual-${categoryName}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={primaryColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="month"
              stroke={textColor}
              style={{ fontSize: '11px' }}
              tickFormatter={formatMonth}
            />
            <YAxis
              stroke={textColor}
              style={{ fontSize: '11px' }}
              tickFormatter={formatCurrency}
              width={50}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="budgeted"
              stroke={mutedColor}
              strokeWidth={1}
              strokeDasharray="5 5"
              fill={`url(#gradient-budgeted-${categoryName})`}
              name="Budgeted"
            />
            <Area
              type="monotone"
              dataKey="actual"
              stroke={primaryColor}
              strokeWidth={2}
              fill={`url(#gradient-actual-${categoryName})`}
              name="Actual"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
