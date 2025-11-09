'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ComparisonResult, PayoffMethod } from '@/lib/debts/payoff-calculator';

interface DebtPayoffStrategyProps {
  className?: string;
}

export function DebtPayoffStrategy({ className }: DebtPayoffStrategyProps) {
  const [method, setMethod] = useState<PayoffMethod>('avalanche');
  const [extraPayment, setExtraPayment] = useState<string>('0');
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStrategy();
  }, [extraPayment]);

  const fetchStrategy = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/debts/payoff-strategy?compare=true&extraPayment=${parseFloat(extraPayment) || 0}`
      );
      if (response.ok) {
        const data = await response.json();
        setComparison(data);
      }
    } catch (error) {
      console.error('Error fetching payoff strategy:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={className}>
        <div className="text-center py-8 text-[#808080]">Loading payoff strategy...</div>
      </div>
    );
  }

  if (!comparison || comparison.snowball.payoffOrder.length === 0) {
    return (
      <div className={className}>
        <div className="text-center py-8 text-[#808080]">
          No active debts found. Create a debt to see payoff strategies.
        </div>
      </div>
    );
  }

  const currentStrategy = method === 'snowball' ? comparison.snowball : comparison.avalanche;
  const alternateStrategy = method === 'snowball' ? comparison.avalanche : comparison.snowball;

  return (
    <div className={className}>
      {/* Header with toggle */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Debt Payoff Strategy</h2>

        {/* Method Toggle */}
        <div className="flex items-center gap-2 bg-[#1a1a1a] rounded-lg p-1">
          <button
            onClick={() => setMethod('snowball')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              method === 'snowball'
                ? 'bg-[#60a5fa] text-white'
                : 'text-[#808080] hover:text-white'
            }`}
          >
            Snowball
          </button>
          <button
            onClick={() => setMethod('avalanche')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              method === 'avalanche'
                ? 'bg-[#60a5fa] text-white'
                : 'text-[#808080] hover:text-white'
            }`}
          >
            Avalanche
          </button>
        </div>
      </div>

      {/* Extra Payment Input */}
      <div className="mb-6">
        <Label htmlFor="extraPayment" className="text-[#e5e5e5] mb-2 block">
          Extra Monthly Payment
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#808080]">$</span>
          <Input
            id="extraPayment"
            type="number"
            min="0"
            step="10"
            value={extraPayment}
            onChange={(e) => setExtraPayment(e.target.value)}
            className="pl-7 bg-[#1a1a1a] border-[#2a2a2a] text-white"
            placeholder="0.00"
          />
        </div>
        <p className="text-xs text-[#808080] mt-1">
          Amount above minimum payments to apply toward debts
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Next Recommended Payment */}
        <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#2a2a2a]">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">📍</span>
            <h3 className="text-lg font-semibold text-white">Pay This Next</h3>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-2xl font-bold text-white mb-1">
                {currentStrategy.nextRecommendedPayment.debtName}
              </div>
              <div className="text-[#808080] text-sm">
                Current Balance: ${currentStrategy.nextRecommendedPayment.currentBalance.toFixed(2)}
              </div>
            </div>

            <div className="pt-3 border-t border-[#2a2a2a] space-y-2">
              <div className="flex justify-between">
                <span className="text-[#808080]">Recommended Payment:</span>
                <span className="text-white font-mono font-semibold">
                  ${currentStrategy.nextRecommendedPayment.recommendedPayment.toFixed(2)}/month
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#808080]">Months Until Payoff:</span>
                <span className="text-white font-semibold">
                  {currentStrategy.nextRecommendedPayment.monthsUntilPayoff}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#808080]">Total Interest:</span>
                <span className="text-white font-mono font-semibold">
                  ${currentStrategy.nextRecommendedPayment.totalInterest.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Payoff Order */}
        <div className="bg-[#1a1a1a] rounded-xl p-6 border border-[#2a2a2a]">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">📊</span>
            <h3 className="text-lg font-semibold text-white">Your Payoff Order</h3>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {currentStrategy.payoffOrder.map((debt) => (
              <div
                key={debt.debtId}
                className="flex items-center justify-between p-3 bg-[#242424] rounded-lg hover:bg-[#2a2a2a] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#1a1a1a] flex items-center justify-center text-white font-semibold">
                    {debt.order}
                  </div>
                  <div>
                    <div className="text-white font-medium">{debt.debtName}</div>
                    <div className="text-xs text-[#808080]">
                      ${debt.remainingBalance.toFixed(2)} @ {debt.interestRate}% APR
                    </div>
                  </div>
                </div>
                <div className="text-xs text-[#808080]">
                  ${debt.minimumPayment.toFixed(2)}/mo min
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Comparison Metrics */}
      <div className="mt-6 bg-[#1a1a1a] rounded-xl p-6 border border-[#2a2a2a]">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">💰</span>
          <h3 className="text-lg font-semibold text-white">Method Comparison</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Current Method */}
          <div className="bg-[#242424] rounded-lg p-4">
            <div className="text-xs text-[#808080] uppercase mb-1">
              {method === 'snowball' ? 'Snowball' : 'Avalanche'} Method
            </div>
            <div className="space-y-2">
              <div>
                <div className="text-sm text-[#808080]">Time to debt-free:</div>
                <div className="text-lg font-semibold text-white">
                  {currentStrategy.totalMonths} months
                </div>
              </div>
              <div>
                <div className="text-sm text-[#808080]">Total interest:</div>
                <div className="text-lg font-mono font-semibold text-white">
                  ${currentStrategy.totalInterestPaid.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Alternate Method */}
          <div className="bg-[#242424] rounded-lg p-4">
            <div className="text-xs text-[#808080] uppercase mb-1">
              {method === 'snowball' ? 'Avalanche' : 'Snowball'} Method
            </div>
            <div className="space-y-2">
              <div>
                <div className="text-sm text-[#808080]">Time to debt-free:</div>
                <div className="text-lg font-semibold text-white">
                  {alternateStrategy.totalMonths} months
                </div>
              </div>
              <div>
                <div className="text-sm text-[#808080]">Total interest:</div>
                <div className="text-lg font-mono font-semibold text-white">
                  ${alternateStrategy.totalInterestPaid.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Savings */}
          <div className="bg-[#242424] rounded-lg p-4">
            <div className="text-xs text-[#808080] uppercase mb-1">
              {comparison.recommendedMethod === method ? 'You Save:' : 'You Could Save:'}
            </div>
            <div className="space-y-2">
              <div>
                <div className="text-sm text-[#808080]">Time savings:</div>
                <div className={`text-lg font-semibold ${
                  comparison.timeSavings > 0 ? 'text-[#10b981]' : 'text-[#808080]'
                }`}>
                  {Math.abs(comparison.timeSavings)} months
                </div>
              </div>
              <div>
                <div className="text-sm text-[#808080]">Interest savings:</div>
                <div className={`text-lg font-mono font-semibold ${
                  comparison.interestSavings > 0 ? 'text-[#10b981]' : 'text-[#808080]'
                }`}>
                  ${Math.abs(comparison.interestSavings).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recommendation */}
        {comparison.recommendedMethod !== method && (
          <div className="mt-4 p-3 bg-[#60a5fa]/10 border border-[#60a5fa]/30 rounded-lg">
            <p className="text-sm text-[#60a5fa]">
              💡 The <strong>{comparison.recommendedMethod}</strong> method could save you{' '}
              {comparison.timeSavings} months and ${comparison.interestSavings.toFixed(2)} in interest!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
