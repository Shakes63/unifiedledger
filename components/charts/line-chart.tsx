'use client';

import React from 'react';
import {
  LineChart as RechartsLineChart,
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

interface LineChartDataPoint {
  name: string;
  [key: string]: string | number;
}

interface LineChartProps {
  title: string;
  description?: string;
  data: LineChartDataPoint[];
  lines: {
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
 * Reusable line chart component
 * Perfect for net worth trends, cash flow over time
 */
export function LineChart({
  title,
  description,
  data,
  lines,
  isLoading,
  error,
  xAxisLabel,
  yAxisLabel,
  className = '',
}: LineChartProps) {
  return (
    <ChartContainer
      title={title}
      description={description}
      isLoading={isLoading}
      error={error}
      className={className}
    >
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
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
        </RechartsLineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
