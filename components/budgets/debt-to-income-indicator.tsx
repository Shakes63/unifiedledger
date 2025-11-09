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

  // Color based on level
  const getColor = () => {
    switch (level) {
      case 'healthy':
        return {
          bg: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
          text: 'text-emerald-400',
          border: 'border-emerald-500/30',
        };
      case 'manageable':
        return {
          bg: 'bg-gradient-to-r from-amber-500 to-amber-400',
          text: 'text-amber-400',
          border: 'border-amber-500/30',
        };
      case 'high':
        return {
          bg: 'bg-gradient-to-r from-red-500 to-red-400',
          text: 'text-red-400',
          border: 'border-red-500/30',
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
            <span className="text-xs text-muted-foreground">Debt-to-Income Ratio</span>
            <div className="relative">
              <button
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onClick={() => setShowTooltip(!showTooltip)}
                className="text-muted-foreground hover:text-muted-foreground transition-colors"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
              {showTooltip && (
                <div className="absolute left-0 top-full mt-1 w-64 z-10 bg-elevated border border-border rounded-lg p-3 shadow-lg">
                  <p className="text-xs text-foreground">{getTooltipMessage()}</p>
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                      <span className="text-muted-foreground">0-20%: Healthy</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                      <span className="text-muted-foreground">20-35%: Manageable</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-400"></div>
                      <span className="text-muted-foreground">35%+: High Risk</span>
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
      <div className="relative w-full bg-elevated rounded-full overflow-hidden">
        <div className={`relative ${getHeight()}`}>
          {/* Background track with threshold markers */}
          <div className="absolute inset-0 flex">
            {/* 0-20% zone (healthy) */}
            <div className="w-[20%] border-r border-border"></div>
            {/* 20-35% zone (manageable) */}
            <div className="w-[15%] border-r border-border"></div>
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
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground">
                20
              </div>
            </div>
            <div
              className="absolute top-0 bottom-0 w-px bg-[#2a2a2a]"
              style={{ left: '35%' }}
            >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground">
                35
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
