'use client';

import React from 'react';

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
}

/**
 * Custom tooltip component for all charts
 * Provides consistent styling with dark theme
 */
export function ChartTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 shadow-lg">
      {label && <p className="text-white text-sm font-medium mb-2">{label}</p>}
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-400">{entry.name}:</span>
          <span className="text-white font-medium">
            {typeof entry.value === 'number'
              ? entry.value.toFixed(2)
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}
