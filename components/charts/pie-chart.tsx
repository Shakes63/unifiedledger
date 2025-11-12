'use client';

import React from 'react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ChartContainer } from './chart-container';
import { ChartTooltip } from './chart-tooltip';

interface PieChartDataPoint {
  name: string;
  value: number;
}

interface PieChartProps {
  title: string;
  description?: string;
  data: PieChartDataPoint[];
  colors: string[];
  isLoading?: boolean;
  error?: string | null;
  dataKey?: string;
  nameKey?: string;
  className?: string;
}

/**
 * Reusable pie chart component
 * Perfect for category distribution, expense breakdown
 */
export function PieChart({
  title,
  description,
  data,
  colors,
  isLoading,
  error,
  dataKey = 'value',
  nameKey = 'name',
  className = '',
}: PieChartProps) {
  return (
    <ChartContainer
      title={title}
      description={description}
      isLoading={isLoading}
      error={error}
      className={className}
    >
      <ResponsiveContainer width="100%" height={320}>
        <RechartsPieChart>
          <Pie
            data={data as any}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value }) => `${name}: ${(value as number).toFixed(0)}`}
            outerRadius={80}
            fill="#8884d8"
            dataKey={dataKey}
            isAnimationActive={true}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip
            content={<ChartTooltip />}
            formatter={(value) => {
              if (typeof value === 'number') {
                return `$${value.toFixed(2)}`;
              }
              return value;
            }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
        </RechartsPieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
