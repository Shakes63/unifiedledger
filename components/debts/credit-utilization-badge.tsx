'use client';

import {
  calculateUtilization,
  getUtilizationLevel,
  getUtilizationColor,
  getUtilizationEmoji,
  formatUtilization,
  getUtilizationRecommendation,
} from '@/lib/debts/credit-utilization-utils';

interface CreditUtilizationBadgeProps {
  balance: number;
  creditLimit: number | null;
  size?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
  showLabel?: boolean;
  showTooltip?: boolean;
}

export function CreditUtilizationBadge({
  balance,
  creditLimit,
  size = 'md',
  showPercentage = true,
  showLabel = false,
  showTooltip = true,
}: CreditUtilizationBadgeProps) {
  // If no credit limit set, don't show badge
  if (!creditLimit || creditLimit === 0) {
    return null;
  }

  const utilization = calculateUtilization(balance, creditLimit);
  const _level = getUtilizationLevel(utilization);
  const color = getUtilizationColor(utilization);
  const emoji = getUtilizationEmoji(utilization);
  const recommendation = getUtilizationRecommendation(utilization);

  // Size variants
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const badgeClass = sizeClasses[size];

  return (
    <div className="inline-flex items-center gap-1">
      {showLabel && (
        <span className="text-xs text-muted-foreground">Utilization:</span>
      )}

      <div className="relative group">
        <span
          className={`inline-flex items-center gap-1 rounded-full font-medium border transition-all ${badgeClass}`}
          style={{
            borderColor: color,
            color: color,
          }}
        >
          <span>{emoji}</span>
          {showPercentage && <span>{formatUtilization(utilization)}</span>}
        </span>

        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
            <div className="bg-card border border-border rounded-lg p-3 shadow-lg min-w-[200px]">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Utilization:</span>
                  <span className="text-sm font-semibold" style={{ color }}>
                    {formatUtilization(utilization)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Balance:</span>
                  <span className="text-sm font-mono text-foreground">
                    ${balance.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Limit:</span>
                  <span className="text-sm font-mono text-foreground">
                    ${creditLimit.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Available:</span>
                  <span className="text-sm font-mono text-success">
                    ${Math.max(0, creditLimit - balance).toFixed(2)}
                  </span>
                </div>
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground">{recommendation}</p>
                </div>
              </div>
              {/* Tooltip arrow */}
              <div
                className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 bg-card border-r border-b border-border rotate-45"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
