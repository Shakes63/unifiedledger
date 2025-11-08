'use client';

import React from 'react';
import {
  ComposedChart as RechartsComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartContainer } from './chart-container';
import { ChartTooltip } from './chart-tooltip';

interface ComposedChartDataPoint {
  name: string;
  [key: string]: string | number;
}

interface ComposedChartProps {
  title: string;
  description?: string;
  data: ComposedChartDataPoint[];
  bars?: {
    dataKey: string;
    fill: string;
    name: string;
  }[];
  lines?: {
    dataKey: string;
    stroke: string;
    name: string;
    strokeWidth?: number;
  }[];
  isLoading?: boolean;
  error?: string | null;
  xAxisLabel?: string;
  yAxisLabel?: string;
  className?: string;
}

/**
 * Reusable composed chart component
 * Perfect for combining bars and lines (budget vs actual, etc)
 */
export function ComposedChart({
  title,
  description,
  data,
  bars = [],
  lines = [],
  isLoading,
  error,
  xAxisLabel,
  yAxisLabel,
  className = '',
}: ComposedChartProps) {
  return (
    <ChartContainer
      title={title}
      description={description}
      isLoading={isLoading}
      error={error}
      className={className}
    >
      <ResponsiveContainer width="100%" height="100%">
        <RechartsComposedChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
          <XAxis
            dataKey="name"
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            label={xAxisLabel ? { value: xAxisLabel, position: 'insideBottom', offset: -5 } : undefined}
          />
          <YAxis
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft' } : undefined}
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          {bars.map((bar) => (
            <Bar
              key={bar.dataKey}
              dataKey={bar.dataKey}
              fill={bar.fill}
              name={bar.name}
              isAnimationActive={true}
            />
          ))}
          {lines.map((line) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              stroke={line.stroke}
              name={line.name}
              strokeWidth={line.strokeWidth || 2}
              dot={false}
              isAnimationActive={true}
            />
          ))}
        </RechartsComposedChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
