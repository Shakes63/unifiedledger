'use client';

import React from 'react';
import {
  Treemap as RechartsTreemap,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { ChartContainer } from './chart-container';
import { ChartTooltip } from './chart-tooltip';
import { ExperimentalBadge } from '@/components/experimental/experimental-badge';

interface TreemapDataPoint {
  name: string;
  value: number;
  color?: string;
}

interface TreemapChartProps {
  title: string;
  description?: string;
  data: TreemapDataPoint[];
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

/**
 * Experimental Treemap Chart Component
 *
 * Hierarchical visualization showing categories by size (amount spent).
 * Great for understanding spending distribution across categories.
 */
export function TreemapChart({
  title,
  description,
  data,
  isLoading,
  error,
  className = '',
}: TreemapChartProps) {
  // Transform data for treemap (needs nested structure)
  const treemapData = {
    name: 'Categories',
    children: data.map(item => ({
      name: item.name,
      size: item.value,
      color: item.color || 'var(--color-primary)',
    })),
  };

  const CustomContent = ({ x, y, width, height, name, color }: any) => {
    // Only show label if rectangle is large enough
    const showLabel = width > 60 && height > 40;

    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: color,
            stroke: 'var(--color-border)',
            strokeWidth: 2,
            opacity: 0.9,
          }}
        />
        {showLabel && (
          <text
            x={x + width / 2}
            y={y + height / 2}
            textAnchor="middle"
            fill="var(--color-background)"
            fontSize={12}
            fontWeight="500"
          >
            {name}
          </text>
        )}
      </g>
    );
  };

  return (
    <ChartContainer
      title={
        <div className="flex items-center justify-between">
          <span>{title}</span>
          <ExperimentalBadge />
        </div>
      }
      description={description}
      isLoading={isLoading}
      error={error}
      className={className}
    >
      {data && data.length > 0 ? (
        <ResponsiveContainer width="100%" height={320}>
          <RechartsTreemap
            data={[treemapData]}
            dataKey="size"
            aspectRatio={4 / 3}
            stroke="var(--color-border)"
            fill="var(--color-primary)"
            content={<CustomContent />}
          >
            <Tooltip
              content={<ChartTooltip />}
              formatter={(value) => {
                if (typeof value === 'number') {
                  return `$${value.toFixed(2)}`;
                }
                return value;
              }}
            />
          </RechartsTreemap>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-[320px] text-muted-foreground">
          No data available for treemap
        </div>
      )}
    </ChartContainer>
  );
}
