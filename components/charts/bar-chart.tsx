'use client';

import React from 'react';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartContainer } from './chart-container';
import { ChartTooltip } from './chart-tooltip';

interface BarChartDataPoint {
  name: string;
  [key: string]: string | number;
}

interface BarChartProps {
  title: string;
  description?: string;
  data: BarChartDataPoint[];
  bars: {
    dataKey: string;
    fill: string;
    name: string;
  }[];
  isLoading?: boolean;
  error?: string | null;
  xAxisLabel?: string;
  yAxisLabel?: string;
  layout?: 'vertical' | 'horizontal';
  className?: string;
}

/**
 * Reusable bar chart component
 * Perfect for income vs expenses, category breakdown
 */
export function BarChart({
  title,
  description,
  data,
  bars,
  isLoading,
  error,
  xAxisLabel,
  yAxisLabel,
  layout = 'vertical',
  className = '',
}: BarChartProps) {
  return (
    <ChartContainer
      title={title}
      description={description}
      isLoading={isLoading}
      error={error}
      className={className}
    >
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          layout={layout}
          margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
          <XAxis
            type={layout === 'vertical' ? 'number' : 'category'}
            dataKey={layout === 'vertical' ? undefined : 'name'}
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            label={xAxisLabel ? { value: xAxisLabel, position: 'insideBottom', offset: -5 } : undefined}
          />
          <YAxis
            type={layout === 'vertical' ? 'category' : 'number'}
            dataKey={layout === 'vertical' ? 'name' : undefined}
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
        </RechartsBarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
