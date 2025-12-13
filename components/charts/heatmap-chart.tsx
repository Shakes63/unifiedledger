'use client';

import React from 'react';
import { ChartContainer } from './chart-container';
import { ExperimentalBadge } from '@/components/experimental/experimental-badge';

interface HeatmapDataPoint {
  category: string;
  month: string;
  value: number;
}

interface HeatmapChartProps {
  title: string;
  description?: string;
  data: HeatmapDataPoint[];
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

/**
 * Experimental Heatmap Chart Component
 *
 * Shows spending intensity by category over time using color gradients.
 * Darker colors indicate higher spending.
 */
export function HeatmapChart({
  title,
  description,
  data,
  isLoading,
  error,
  className = '',
}: HeatmapChartProps) {
  // Get unique categories and months
  const categories = Array.from(new Set(data.map(d => d.category)));
  const months = Array.from(new Set(data.map(d => d.month))).sort();

  // Find max value for color scaling
  const maxValue = Math.max(...data.map(d => d.value), 1);

  // Get color intensity based on value (0-1 scale)
  const getColorIntensity = (value: number) => {
    const intensity = value / maxValue;
    const alpha = 0.2 + (intensity * 0.8); // Range from 0.2 to 1.0
    return `rgba(var(--color-expense-rgb, 239, 68, 68), ${alpha})`;
  };

  // Get value for specific category and month
  const getValue = (category: string, month: string) => {
    const point = data.find(d => d.category === category && d.month === month);
    return point?.value || 0;
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
        <div className="w-full overflow-x-auto">
          <div className="min-w-[600px] py-4">
            {/* Header row with months */}
            <div className="flex items-center mb-2">
              <div className="w-32 shrink-0" /> {/* Spacer for category labels */}
              <div className="flex-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${months.length}, 1fr)` }}>
                {months.map(month => (
                  <div
                    key={month}
                    className="text-xs text-center text-muted-foreground font-medium px-1"
                  >
                    {month}
                  </div>
                ))}
              </div>
            </div>

            {/* Heatmap grid */}
            <div className="space-y-1">
              {categories.map(category => (
                <div key={category} className="flex items-center">
                  {/* Category label */}
                  <div className="w-32 shrink-0 pr-2">
                    <span className="text-xs text-foreground truncate block">
                      {category}
                    </span>
                  </div>

                  {/* Heatmap cells */}
                  <div className="flex-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${months.length}, 1fr)` }}>
                    {months.map(month => {
                      const value = getValue(category, month);
                      return (
                        <div
                          key={`${category}-${month}`}
                          className="relative group"
                        >
                          <div
                            className="aspect-square rounded border border-border cursor-pointer transition-transform hover:scale-105"
                            style={{
                              backgroundColor: value > 0 ? getColorIntensity(value) : 'var(--color-elevated)',
                            }}
                          />
                          {/* Tooltip on hover */}
                          <div className="absolute z-10 hidden group-hover:block bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-card border border-border rounded shadow-lg whitespace-nowrap">
                            <div className="text-xs">
                              <div className="font-medium text-foreground">{category}</div>
                              <div className="text-muted-foreground">{month}</div>
                              <div className="text-expense font-semibold">
                                ${value.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <span>Low</span>
              <div className="flex gap-1">
                {[0.2, 0.4, 0.6, 0.8, 1.0].map(intensity => (
                  <div
                    key={intensity}
                    className="w-6 h-4 rounded border border-border"
                    style={{
                      backgroundColor: `rgba(var(--color-expense-rgb, 239, 68, 68), ${intensity})`,
                    }}
                  />
                ))}
              </div>
              <span>High</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-[320px] text-muted-foreground">
          No data available for heatmap
        </div>
      )}
    </ChartContainer>
  );
}
