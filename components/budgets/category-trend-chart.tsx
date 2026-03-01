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

interface TooltipPayloadItem {
  value: number;
  dataKey: string;
  color?: string;
  name?: string;
}

interface TooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

/**
 * Custom tooltip for category trend
 */
function CustomTooltip({ active, payload, label }: TooltipProps) {
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

  const budgetedData = payload.find((p: TooltipPayloadItem) => p.dataKey === 'budgeted');
  const actualData = payload.find((p: TooltipPayloadItem) => p.dataKey === 'actual');

  const variance =
    actualData && budgetedData
      ? (actualData.value as number) - (budgetedData.value as number)
      : 0;

  return (
    <div className="rounded-lg p-3 shadow-lg" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
      <p className="text-sm font-semibold mb-2" style={{ color: 'var(--color-foreground)' }}>{label ? formatMonth(label) : ''}</p>
      <div className="space-y-1">
        {budgetedData && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Budgeted:</span>
            <span className="text-xs font-semibold" style={{ color: 'var(--color-foreground)' }}>
              {formatCurrency(budgetedData.value as number)}
            </span>
          </div>
        )}
        {actualData && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Actual:</span>
            <span className="text-xs font-semibold" style={{ color: 'var(--color-foreground)' }}>
              {formatCurrency(actualData.value as number)}
            </span>
          </div>
        )}
        {variance !== 0 && (
          <div className="flex items-center justify-between gap-4 pt-1" style={{ borderTop: '1px solid var(--color-border)' }}>
            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Variance:</span>
            <span
              className="text-xs font-semibold"
              style={{ color: variance < 0 ? 'var(--color-success)' : 'var(--color-destructive)' }}
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
  const getTrendColor = (): React.CSSProperties => {
    if (trend.direction === 'increasing') return { color: 'var(--color-destructive)' };
    if (trend.direction === 'decreasing') return { color: 'var(--color-success)' };
    return { color: 'var(--color-muted-foreground)' };
  };

  const getTrendIcon = () => {
    if (trend.direction === 'increasing') return '↗️';
    if (trend.direction === 'decreasing') return '↘️';
    return '→';
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 rounded-xl" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
        <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>No data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header with trend indicator */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>{categoryName}</h4>
        <div className="flex items-center gap-1 text-xs font-medium" style={getTrendColor()}>
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
