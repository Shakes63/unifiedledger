'use client';

import { Info } from 'lucide-react';
import { useState } from 'react';

interface DebtToIncomeIndicatorProps {
  ratio: number; // Percentage (0-100+)
  level: 'healthy' | 'manageable' | 'high';
  showLabel?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export function DebtToIncomeIndicator({
  ratio,
  level,
  showLabel = true,
  size = 'medium',
}: DebtToIncomeIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Color based on level - using CSS variables for design system
  const getColor = () => {
    switch (level) {
      case 'healthy':
        return {
          bg: 'var(--color-success)',
          text: 'var(--color-success)',
          border: 'color-mix(in oklch, var(--color-success) 30%, transparent)',
        };
      case 'manageable':
        return {
          bg: 'var(--color-warning)',
          text: 'var(--color-warning)',
          border: 'color-mix(in oklch, var(--color-warning) 30%, transparent)',
        };
      case 'high':
        return {
          bg: 'var(--color-destructive)',
          text: 'var(--color-destructive)',
          border: 'color-mix(in oklch, var(--color-destructive) 30%, transparent)',
        };
    }
  };

  const colors = getColor();

  // Height based on size
  const getHeight = () => {
    switch (size) {
      case 'small':
        return 'h-1.5';
      case 'medium':
        return 'h-2';
      case 'large':
        return 'h-3';
    }
  };

  // Calculate width (capped at 100%)
  const widthPercentage = Math.min(ratio, 100);

  // Tooltip messages
  const getTooltipMessage = () => {
    switch (level) {
      case 'healthy':
        return 'Healthy debt level - Under 20% is excellent. You have good financial flexibility.';
      case 'manageable':
        return 'Manageable debt level - 20-35% is okay, but monitor closely. Consider paying down debt when possible.';
      case 'high':
        return 'High debt risk - Over 35% indicates high debt burden. Focus on paying down debt to improve financial health.';
    }
  };

  const getLevelText = () => {
    switch (level) {
      case 'healthy':
        return 'Healthy';
      case 'manageable':
        return 'Manageable';
      case 'high':
        return 'High Risk';
    }
  };

  return (
    <div className="space-y-2">
      {showLabel && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Debt-to-Income Ratio</span>
            <div className="relative">
              <button
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onClick={() => setShowTooltip(!showTooltip)}
                className="transition-colors"
                style={{ color: 'var(--color-muted-foreground)' }}
              >
                <Info className="w-3.5 h-3.5" />
              </button>
              {showTooltip && (
                <div className="absolute left-0 top-full mt-1 w-64 z-10 rounded-lg p-3 shadow-lg" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
                  <p className="text-xs" style={{ color: 'var(--color-foreground)' }}>{getTooltipMessage()}</p>
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                      <span style={{ color: 'var(--color-muted-foreground)' }}>0-20%: Healthy</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                      <span style={{ color: 'var(--color-muted-foreground)' }}>20-35%: Manageable</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-400"></div>
                      <span style={{ color: 'var(--color-muted-foreground)' }}>35%+: High Risk</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${colors.text}`}>
              {ratio.toFixed(1)}%
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${colors.text} bg-opacity-10 border ${colors.border}`}>
              {getLevelText()}
            </span>
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="relative w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-elevated)' }}>
        <div className={`relative ${getHeight()}`}>
          {/* Background track with threshold markers */}
          <div className="absolute inset-0 flex">
            {/* 0-20% zone (healthy) */}
            <div className="w-[20%] border-r" style={{ borderColor: 'var(--color-border)' }}></div>
            {/* 20-35% zone (manageable) */}
            <div className="w-[15%] border-r" style={{ borderColor: 'var(--color-border)' }}></div>
            {/* 35%+ zone (high) */}
            <div className="flex-1"></div>
          </div>

          {/* Actual progress */}
          <div
            className={`absolute left-0 top-0 bottom-0 ${colors.bg} transition-all duration-500 ease-out rounded-full`}
            style={{ width: `${widthPercentage}%` }}
          ></div>
        </div>

        {/* Threshold markers (only show on medium/large) */}
        {size !== 'small' && (
          <>
            <div
              className="absolute top-0 bottom-0 w-px bg-[#2a2a2a]"
              style={{ left: '20%' }}
            >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>
                20
              </div>
            </div>
            <div
              className="absolute top-0 bottom-0 w-px bg-[#2a2a2a]"
              style={{ left: '35%' }}
            >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>
                35
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
