'use client';

import React from 'react';
import { ChartContainer } from './chart-container';

interface ProgressItem {
  name: string;
  current: number;
  target: number;
  color: string;
}

interface ProgressChartProps {
  title: string;
  description?: string;
  items: ProgressItem[];
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

/**
 * Reusable progress chart component
 * Perfect for budget tracking, goal progress, debt payoff
 */
export function ProgressChart({
  title,
  description,
  items,
  isLoading,
  error,
  className = '',
}: ProgressChartProps) {
  return (
    <ChartContainer
      title={title}
      description={description}
      isLoading={isLoading}
      error={error}
      className={className}
    >
      <div className="space-y-6">
        {items.map((item) => {
          const percentage = item.target > 0 ? (item.current / item.target) * 100 : 0;
          const displayPercentage = Math.min(percentage, 100);

          return (
            <div key={item.name} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-white">{item.name}</span>
                <span className="text-sm text-gray-400">
                  ${item.current.toFixed(2)} / ${item.target.toFixed(2)}
                </span>
              </div>
              <div className="relative h-3 bg-[#2a2a2a] rounded-full overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full transition-all duration-500 rounded-full"
                  style={{
                    backgroundColor: item.color,
                    width: `${displayPercentage}%`,
                  }}
                />
              </div>
              <div className="text-xs text-gray-500 text-right">
                {displayPercentage.toFixed(0)}%
              </div>
            </div>
          );
        })}
      </div>
    </ChartContainer>
  );
}
