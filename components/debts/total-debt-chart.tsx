'use client';

import { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
interface ChartDataPoint {
  month: string;
  projectedTotal: number;
  actualTotal: number;
  byDebt: Record<string, number>;
}

interface TotalDebtChartProps {
  data: ChartDataPoint[];
  isLoading?: boolean;
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: any[];
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div
      className="p-3 rounded-lg border"
      style={{
        backgroundColor: 'var(--color-card)',
        borderColor: 'var(--color-border)',
      }}
    >
      <p className="font-semibold text-foreground text-sm mb-1">
        {data.month}
      </p>
      {payload.map((entry: any, index: number) => (
        <p key={index} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
      {data.actualTotal !== undefined && data.projectedTotal !== undefined && (
        <p
          className="text-xs mt-1 pt-1 border-t"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
        >
          Difference: {formatCurrency(Math.abs(data.projectedTotal - data.actualTotal))}
        </p>
      )}
    </div>
  );
}

export function TotalDebtChart({ data, isLoading }: TotalDebtChartProps) {
  // Sort data by month to ensure proper line rendering
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => a.month.localeCompare(b.month));
  }, [data]);

  if (isLoading) {
    return (
      <div
        className="w-full h-96 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: 'var(--color-card)' }}
      >
        <p className="text-muted-foreground">Loading chart...</p>
      </div>
    );
  }

  if (sortedData.length === 0) {
    return (
      <div
        className="w-full h-96 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: 'var(--color-card)' }}
      >
        <p className="text-muted-foreground">No debt data available</p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-lg p-4" style={{ backgroundColor: 'var(--color-card)' }}>
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart
          data={sortedData}
          margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
        >
          <defs>
            <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-income)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--color-income)" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            vertical={false}
          />

          <XAxis
            dataKey="month"
            stroke="var(--color-muted-foreground)"
            style={{ fontSize: '12px' }}
            tick={{ fill: 'var(--color-muted-foreground)' }}
          />

          <YAxis
            stroke="var(--color-muted-foreground)"
            style={{ fontSize: '12px' }}
            tickFormatter={formatCurrency}
            tick={{ fill: 'var(--color-muted-foreground)' }}
          />

          <Tooltip content={<CustomTooltip />} />

          <Legend
            wrapperStyle={{
              paddingTop: '16px',
            }}
            iconType="line"
            formatter={(value) => (
              <span style={{ color: 'var(--color-foreground)' }}>{value}</span>
            )}
          />

          {/* Area under actual line */}
          <Area
            type="monotone"
            dataKey="actualTotal"
            fill="url(#actualGradient)"
            stroke="none"
            isAnimationActive={true}
          />

          {/* Actual line */}
          <Line
            type="monotone"
            dataKey="actualTotal"
            stroke="var(--color-income)"
            strokeWidth={3}
            dot={false}
            name="Actual"
            isAnimationActive={true}
          />

          {/* Projected line (dashed) */}
          <Line
            type="monotone"
            dataKey="projectedTotal"
            stroke="var(--color-muted-foreground)"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            name="Projected"
            isAnimationActive={true}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Summary info below chart */}
      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground text-xs mb-1">Latest Actual</p>
          <p className="text-foreground font-semibold">
            {sortedData.length > 0 ? formatCurrency(sortedData[sortedData.length - 1]?.actualTotal || 0) : '$0'}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs mb-1">Latest Projected</p>
          <p className="text-foreground font-semibold">
            {sortedData.length > 0 ? formatCurrency(sortedData[sortedData.length - 1]?.projectedTotal || 0) : '$0'}
          </p>
        </div>
      </div>
    </div>
  );
}
