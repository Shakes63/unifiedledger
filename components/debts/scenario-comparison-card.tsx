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
      time: { text: 'Fastest', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
      money: { text: 'Saves Most $', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
      balanced: { text: 'Most Balanced', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    };

    const badge = badges[isBest];
    return (
      <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${badge.color}`}>
        <Trophy className="w-3 h-3" />
        {badge.text}
      </div>
    );
  };

  return (
    <div className={`bg-[#1a1a1a] rounded-xl border transition-all ${
      isBest ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/10' : 'border-[#2a2a2a]'
    }`}>
      {/* Main Content */}
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-1">
              {scenario.name}
            </h3>
            {isBaseline && (
              <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded">
                Baseline
              </span>
            )}
          </div>
          {getBestBadge()}
        </div>

        {/* Key Metrics */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[#808080] text-sm">Time to Debt-Free:</span>
            <span className="text-white font-semibold">{scenario.totalMonths} months</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[#808080] text-sm">Debt-Free Date:</span>
            <span className="text-white font-semibold">{formatDate(scenario.debtFreeDate)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[#808080] text-sm">Total Interest:</span>
            <span className="text-white font-mono font-semibold">
              ${scenario.totalInterestPaid.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Savings vs Baseline */}
          {!isBaseline && scenario.savingsVsBaseline && (
            <div className="pt-3 mt-3 border-t border-[#2a2a2a] space-y-2">
              {scenario.savingsVsBaseline.monthsSaved !== 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[#808080] text-sm">Time Savings:</span>
                  <span className={`font-semibold ${
                    scenario.savingsVsBaseline.monthsSaved > 0
                      ? 'text-emerald-400'
                      : 'text-red-400'
                  }`}>
                    {scenario.savingsVsBaseline.monthsSaved > 0 ? '+' : ''}
                    {Math.abs(scenario.savingsVsBaseline.monthsSaved)} months
                  </span>
                </div>
              )}

              {scenario.savingsVsBaseline.interestSaved !== 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[#808080] text-sm">Interest Savings:</span>
                  <span className={`font-mono font-semibold ${
                    scenario.savingsVsBaseline.interestSaved > 0
                      ? 'text-emerald-400'
                      : 'text-red-400'
                  }`}>
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
          className="w-full mt-4 py-2 flex items-center justify-center gap-2 text-[#808080] hover:text-white transition-colors text-sm"
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
          <div className="border-t border-[#2a2a2a] pt-4">
            <h4 className="text-sm font-semibold text-white mb-3">Payoff Order</h4>
            <div className="space-y-2">
              {scenario.payoffOrder.map((debt) => (
                <div
                  key={debt.debtId}
                  className="flex items-center gap-3 p-3 bg-[#242424] rounded-lg"
                >
                  <div className="w-6 h-6 rounded-full bg-[#1a1a1a] flex items-center justify-center text-white text-xs font-semibold">
                    {debt.order}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium truncate">{debt.debtName}</div>
                    <div className="text-xs text-[#808080]">
                      ${debt.remainingBalance.toLocaleString()} @ {debt.interestRate}% APR
                    </div>
                  </div>
                  <div className="text-xs text-[#808080] whitespace-nowrap">
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
