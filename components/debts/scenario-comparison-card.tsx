'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Trophy } from 'lucide-react';
import type { ScenarioResult } from '@/lib/debts/payoff-calculator';

interface ScenarioComparisonCardProps {
  scenario: ScenarioResult;
  isBaseline?: boolean;
  isBest?: 'time' | 'money' | 'balanced' | null;
}

export function ScenarioComparisonCard({
  scenario,
  isBaseline = false,
  isBest = null,
}: ScenarioComparisonCardProps) {
  const [expanded, setExpanded] = useState(false);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  };

  const getBestBadge = () => {
    if (!isBest) return null;

    const badges = {
      time: { text: 'Fastest', style: { backgroundColor: 'color-mix(in oklch, var(--color-success) 20%, transparent)', color: 'var(--color-success)', borderColor: 'color-mix(in oklch, var(--color-success) 30%, transparent)' } },
      money: { text: 'Saves Most $', style: { backgroundColor: 'color-mix(in oklch, var(--color-primary) 20%, transparent)', color: 'var(--color-primary)', borderColor: 'color-mix(in oklch, var(--color-primary) 30%, transparent)' } },
      balanced: { text: 'Most Balanced', style: { backgroundColor: 'color-mix(in oklch, var(--color-transfer) 20%, transparent)', color: 'var(--color-transfer)', borderColor: 'color-mix(in oklch, var(--color-transfer) 30%, transparent)' } },
    };

    const badge = badges[isBest];
    return (
      <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border" style={badge.style}>
        <Trophy className="w-3 h-3" />
        {badge.text}
      </div>
    );
  };

  return (
    <div
      className="rounded-xl border transition-all"
      style={{
        backgroundColor: 'var(--color-background)',
        borderColor: isBest ? 'color-mix(in oklch, var(--color-success) 50%, transparent)' : 'var(--color-border)',
      }}
    >
      {/* Main Content */}
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--color-foreground)' }}>
              {scenario.name}
            </h3>
            {isBaseline && (
              <span className="text-xs px-2 py-1 rounded" style={{ color: 'var(--color-primary)', backgroundColor: 'color-mix(in oklch, var(--color-primary) 10%, transparent)' }}>
                Baseline
              </span>
            )}
          </div>
          {getBestBadge()}
        </div>

        {/* Key Metrics */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Time to Debt-Free:</span>
            <span className="font-semibold" style={{ color: 'var(--color-foreground)' }}>{scenario.totalMonths} months</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Debt-Free Date:</span>
            <span className="font-semibold" style={{ color: 'var(--color-foreground)' }}>{formatDate(scenario.debtFreeDate)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Total Interest:</span>
            <span className="font-mono font-semibold" style={{ color: 'var(--color-foreground)' }}>
              ${scenario.totalInterestPaid.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Savings vs Baseline */}
          {!isBaseline && scenario.savingsVsBaseline && (
            <div className="pt-3 mt-3 space-y-2" style={{ borderTop: '1px solid var(--color-border)' }}>
              {scenario.savingsVsBaseline.monthsSaved !== 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Time Savings:</span>
                  <span
                    className="font-semibold"
                    style={{ color: scenario.savingsVsBaseline.monthsSaved > 0 ? 'var(--color-success)' : 'var(--color-destructive)' }}
                  >
                    {scenario.savingsVsBaseline.monthsSaved > 0 ? '+' : ''}
                    {Math.abs(scenario.savingsVsBaseline.monthsSaved)} months
                  </span>
                </div>
              )}

              {scenario.savingsVsBaseline.interestSaved !== 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Interest Savings:</span>
                  <span
                    className="font-mono font-semibold"
                    style={{ color: scenario.savingsVsBaseline.interestSaved > 0 ? 'var(--color-success)' : 'var(--color-destructive)' }}
                  >
                    {scenario.savingsVsBaseline.interestSaved > 0 ? '+' : ''}
                    ${Math.abs(scenario.savingsVsBaseline.interestSaved).toLocaleString('en-US', {
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Expand/Collapse Button */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-4 py-2 flex items-center justify-center gap-2 transition-colors text-sm [&:hover]:text-[var(--color-foreground)]"
          style={{ color: 'var(--color-muted-foreground)' }}
        >
          {expanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Hide Details
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Show Payoff Order
            </>
          )}
        </button>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-6 pb-6 pt-0">
          <div className="pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
            <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-foreground)' }}>Payoff Order</h4>
            <div className="space-y-2">
              {scenario.payoffOrder.map((debt) => (
                <div
                  key={debt.debtId}
                  className="flex items-center gap-3 p-3 rounded-lg"
                  style={{ backgroundColor: 'var(--color-elevated)' }}
                >
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold" style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-foreground)' }}>
                    {debt.order}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate" style={{ color: 'var(--color-foreground)' }}>{debt.debtName}</div>
                    <div className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                      ${debt.remainingBalance.toLocaleString()} @ {debt.interestRate}% APR
                    </div>
                  </div>
                  <div className="text-xs whitespace-nowrap" style={{ color: 'var(--color-muted-foreground)' }}>
                    ${debt.minimumPayment.toFixed(2)}/mo
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
