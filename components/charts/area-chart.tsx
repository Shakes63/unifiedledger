'use client';

import React from 'react';
import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartContainer } from './chart-container';
import { ChartTooltip } from './chart-tooltip';

interface AreaChartDataPoint {
  name: string;
  [key: string]: string | number;
}

interface AreaChartProps {
  title: string;
  description?: string;
  data: AreaChartDataPoint[];
  areas: {
    dataKey: string;
    fill: string;
    stroke: string;
    name: string;
  }[];
  isLoading?: boolean;
  error?: string | null;
  xAxisLabel?: string;
  yAxisLabel?: string;
  className?: string;
}

/**
 * Reusable area chart component
 * Perfect for cumulative trends, stacked expenses
 */
export function AreaChart({
  title,
  description,
  data,
  areas,
  isLoading,
  error,
  xAxisLabel,
  yAxisLabel,
  className = '',
}: AreaChartProps) {
  return (
    <ChartContainer
      title={title}
      description={description}
      isLoading={isLoading}
      error={error}
      className={className}
    >
      <ResponsiveContainer width="100%" height={320}>
        <RechartsAreaChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <defs>
            {areas.map((area) => (
              <linearGradient key={area.dataKey} id={`color-${area.dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={area.fill} stopOpacity={0.8} />
                <stop offset="95%" stopColor={area.fill} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
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
          {areas.map((area) => (
            <Area
              key={area.dataKey}
              type="monotone"
              dataKey={area.dataKey}
              stroke={area.stroke}
              fillOpacity={1}
              fill={`url(#color-${area.dataKey})`}
              name={area.name}
              isAnimationActive={true}
            />
          ))}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
