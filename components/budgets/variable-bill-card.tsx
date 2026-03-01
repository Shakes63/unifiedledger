'use client';

import React, { useState } from 'react';
import Decimal from 'decimal.js';
import { CheckCircle, AlertTriangle, XCircle, TrendingDown, TrendingUp, ArrowRight, BarChart3 } from 'lucide-react';

interface VariableBillCardProps {
  bill: {
    id: string;
    name: string;
    frequency: string | null;
    expectedAmount: number;
    currentMonth: {
      month: string;
      instanceId: string | null;
      expectedAmount: number;
      actualAmount: number | null;
      variance: number | null;
      variancePercent: number | null;
      status: 'pending' | 'paid' | 'overdue' | 'skipped';
      dueDate: string;
      paidDate: string | null;
    };
    historicalAverages: {
      threeMonth: number | null;
      sixMonth: number | null;
      twelveMonth: number | null;
      allTime: number | null;
    };
    trend: {
      direction: 'improving' | 'worsening' | 'stable';
      percentChange: number;
      recommendedBudget: number;
    };
  };
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onUpdateExpectedAmount?: (billId: string, newAmount: number) => void;
  onViewHistory?: (billId: string) => void;
}

export function VariableBillCard({
  bill,
  isExpanded = false,
  onToggleExpand,
  onUpdateExpectedAmount,
  onViewHistory,
}: VariableBillCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(bill.expectedAmount.toString());

  const handleSave = () => {
    const newAmount = parseFloat(editValue);
    if (!isNaN(newAmount) && newAmount > 0 && onUpdateExpectedAmount) {
      onUpdateExpectedAmount(bill.id, newAmount);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditValue(bill.expectedAmount.toString());
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  // Calculate variance colors and indicators
  const getVarianceColor = (): React.CSSProperties => {
    if (!bill.currentMonth.variance) return { color: 'var(--color-muted-foreground)' };

    const variancePercent = Math.abs(bill.currentMonth.variancePercent || 0);

    if (bill.currentMonth.variance < 0) {
      // Under budget (savings)
      return { color: 'var(--color-success)' };
    } else if (variancePercent <= 15) {
      // Minor overage
      return { color: 'var(--color-warning)' };
    } else {
      // Significant overage
      return { color: 'var(--color-destructive)' };
    }
  };

  const getVarianceIcon = () => {
    if (!bill.currentMonth.variance) return null;

    const variancePercent = Math.abs(bill.currentMonth.variancePercent || 0);

    if (bill.currentMonth.variance < 0) {
      return <CheckCircle className="w-4 h-4" />;
    } else if (variancePercent <= 15) {
      return <AlertTriangle className="w-4 h-4" />;
    } else {
      return <XCircle className="w-4 h-4" />;
    }
  };

  const getVarianceLabel = () => {
    if (!bill.currentMonth.variance) return '';

    const amount = Math.abs(bill.currentMonth.variance);
    const percent = Math.abs(bill.currentMonth.variancePercent || 0);

    if (bill.currentMonth.variance < 0) {
      return `Saved $${amount.toFixed(2)} (${percent.toFixed(1)}% under)`;
    } else {
      return `Over $${amount.toFixed(2)} (${percent.toFixed(1)}% over)`;
    }
  };

  // Progress bar calculation
  const getProgressPercent = () => {
    if (!bill.currentMonth.actualAmount) return 0;
    return new Decimal(bill.currentMonth.actualAmount)
      .div(bill.currentMonth.expectedAmount)
      .times(100)
      .toNumber();
  };

  const getProgressColor = (): React.CSSProperties => {
    const percent = getProgressPercent();
    if (percent > 115) return { backgroundColor: 'var(--color-destructive)' };
    if (percent > 100) return { backgroundColor: 'var(--color-warning)' };
    return { backgroundColor: 'var(--color-success)' };
  };

  // Trend indicator
  const getTrendIcon = () => {
    if (bill.trend.direction === 'improving') return <TrendingDown className="w-5 h-5" style={{ color: 'var(--color-success)' }} />;
    if (bill.trend.direction === 'worsening') return <TrendingUp className="w-5 h-5" style={{ color: 'var(--color-destructive)' }} />;
    return <ArrowRight className="w-5 h-5" style={{ color: 'var(--color-muted-foreground)' }} />;
  };

  const getTrendLabel = () => {
    if (bill.trend.direction === 'improving') {
      return `Trending down by ${Math.abs(bill.trend.percentChange).toFixed(1)}%`;
    } else if (bill.trend.direction === 'worsening') {
      return `Trending up by ${Math.abs(bill.trend.percentChange).toFixed(1)}%`;
    }
    return 'Stable spending';
  };

  // Insight message
  const getInsightMessage = () => {
    const { direction, percentChange: _percentChange, recommendedBudget } = bill.trend;
    const { variance } = bill.currentMonth;

    if (direction === 'improving' && variance && variance < 0) {
      return `Costs are decreasing! Consider reducing your budget to $${recommendedBudget.toFixed(2)} to better reflect actual usage.`;
    } else if (direction === 'worsening') {
      return `Costs are rising. Consider increasing your budget to $${recommendedBudget.toFixed(2)} to avoid overspending alerts.`;
    } else if (variance && variance < 0) {
      const _consecutiveUnder = 3; // TODO: Calculate from history
      return `You've been under budget consistently. Reduce to $${recommendedBudget.toFixed(2)} to free up funds.`;
    } else if (variance && variance > 0) {
      return `Over budget this month. Review usage or adjust budget to $${recommendedBudget.toFixed(2)}.`;
    }
    return `Your current budget of $${bill.expectedAmount.toFixed(2)} appears accurate.`;
  };

  return (
    <div className="rounded-xl overflow-hidden transition-colors" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
      {/* Header - Clickable to expand/collapse */}
      <button
        onClick={onToggleExpand}
        className="w-full px-6 py-4 flex items-center justify-between transition-colors text-left"
        style={{ backgroundColor: 'transparent' }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-elevated)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold" style={{ color: 'var(--color-foreground)' }}>{bill.name}</h3>
            {bill.frequency && (
              <span className="text-xs px-2 py-1 rounded-md capitalize" style={{ backgroundColor: 'var(--color-muted)', color: 'var(--color-muted-foreground)' }}>
                {bill.frequency}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Status indicator */}
          {bill.currentMonth.status === 'paid' ? (
            <span className="text-xs" style={{ color: 'var(--color-success)' }}>Paid</span>
          ) : bill.currentMonth.status === 'overdue' ? (
            <span className="text-xs" style={{ color: 'var(--color-destructive)' }}>Overdue</span>
          ) : (
            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Pending</span>
          )}

          {/* Expand/collapse icon */}
          <svg
            className={`w-5 h-5 transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
            style={{ color: 'var(--color-muted-foreground)' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-6 pb-6 space-y-4">
          {/* Current Month Status */}
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Expected: $</span>
                      <input
                        type="number"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-24 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2"
                        style={{ backgroundColor: 'var(--color-input)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
                        autoFocus
                        min="0"
                        step="0.01"
                      />
                      <button
                        onClick={handleSave}
                        className="px-3 py-1.5 text-xs rounded-lg hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancel}
                        className="px-3 py-1.5 text-xs rounded-lg transition-colors"
                        style={{ backgroundColor: 'var(--color-muted)', color: 'var(--color-foreground)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-elevated)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-muted)'; }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Expected:</span>
                      <span className="text-lg font-semibold" style={{ color: 'var(--color-foreground)' }}>
                        ${bill.currentMonth.expectedAmount.toFixed(2)}
                      </span>
                      {onUpdateExpectedAmount && (
                        <button
                          onClick={() => setIsEditing(true)}
                          className="text-xs hover:opacity-80 transition-opacity ml-2"
                          style={{ color: 'var(--color-primary)' }}
                        >
                          Edit
                        </button>
                      )}
                    </>
                  )}
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Actual:</span>
                  {bill.currentMonth.actualAmount !== null ? (
                    <span className="text-lg font-semibold" style={{ color: 'var(--color-foreground)' }}>
                      ${bill.currentMonth.actualAmount.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-sm italic" style={{ color: 'var(--color-muted-foreground)' }}>Not paid yet</span>
                  )}
                </div>

                {bill.currentMonth.variance !== null && (
                  <div className="flex items-center gap-2 text-sm font-medium" style={getVarianceColor()}>
                    {getVarianceIcon()}
                    <span>{getVarianceLabel()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            {bill.currentMonth.actualAmount !== null && (
              <div className="w-full rounded-lg h-2.5 overflow-hidden" style={{ backgroundColor: 'var(--color-muted)' }}>
                <div
                  className="h-full transition-all duration-500"
                  style={{ width: `${Math.min(100, getProgressPercent())}%`, ...getProgressColor() }}
                />
              </div>
            )}
          </div>

          {/* Historical Averages */}
          <div className="pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2" style={{ color: 'var(--color-foreground)' }}>
              <BarChart3 className="w-4 h-4" />
              Historical Averages
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-muted)' }}>
                <div className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>3-Month</div>
                <div className="text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>
                  {bill.historicalAverages.threeMonth !== null
                    ? `$${bill.historicalAverages.threeMonth.toFixed(2)}`
                    : 'N/A'}
                </div>
              </div>
              <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-muted)' }}>
                <div className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>6-Month</div>
                <div className="text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>
                  {bill.historicalAverages.sixMonth !== null
                    ? `$${bill.historicalAverages.sixMonth.toFixed(2)}`
                    : 'N/A'}
                </div>
              </div>
              <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-muted)' }}>
                <div className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>12-Month</div>
                <div className="text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>
                  {bill.historicalAverages.twelveMonth !== null
                    ? `$${bill.historicalAverages.twelveMonth.toFixed(2)}`
                    : 'N/A'}
                </div>
              </div>
              <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-muted)' }}>
                <div className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>All-Time</div>
                <div className="text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>
                  {bill.historicalAverages.allTime !== null
                    ? `$${bill.historicalAverages.allTime.toFixed(2)}`
                    : 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {/* Trend & Insights */}
          <div className="pt-4 space-y-3" style={{ borderTop: '1px solid var(--color-border)' }}>
            <div className="flex items-start gap-2">
              {getTrendIcon()}
              <div className="flex-1">
                <h4 className="text-sm font-medium mb-1" style={{ color: 'var(--color-foreground)' }}>{getTrendLabel()}</h4>
                <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>{getInsightMessage()}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {onViewHistory && (
                <button
                  onClick={() => onViewHistory(bill.id)}
                  className="flex-1 px-4 py-2 text-sm rounded-lg transition-colors"
                  style={{ backgroundColor: 'var(--color-muted)', color: 'var(--color-foreground)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-elevated)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-muted)'; }}
                >
                  View History
                </button>
              )}
              {bill.trend.recommendedBudget !== bill.expectedAmount && onUpdateExpectedAmount && (
                <button
                  onClick={() => {
                    onUpdateExpectedAmount(bill.id, bill.trend.recommendedBudget);
                  }}
                  className="flex-1 px-4 py-2 text-sm rounded-lg hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
                >
                  Apply Recommended (${bill.trend.recommendedBudget.toFixed(2)})
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
