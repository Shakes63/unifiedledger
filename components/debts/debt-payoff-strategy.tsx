'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ComparisonResult, PayoffMethod, PaymentFrequency } from '@/lib/debts/payoff-calculator';

interface DebtPayoffStrategyProps {
  className?: string;
}

export function DebtPayoffStrategy({ className }: DebtPayoffStrategyProps) {
  const [method, setMethod] = useState<PayoffMethod>('avalanche');
  const [paymentFrequency, setPaymentFrequency] = useState<PaymentFrequency>('monthly');
  const [extraPayment, setExtraPayment] = useState<string>('0');
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load saved settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/debts/settings');
        if (response.ok) {
          const settings = await response.json();
          setExtraPayment(settings.extraMonthlyPayment?.toString() || '0');
          setMethod(settings.preferredMethod || 'avalanche');
          setPaymentFrequency(settings.paymentFrequency || 'monthly');
          setSettingsLoaded(true);
        }
      } catch (error) {
        console.error('Error loading debt settings:', error);
        setSettingsLoaded(true);
      }
    };

    loadSettings();
  }, []);

  // Fetch strategy whenever settings change (debounced for extra payment)
  useEffect(() => {
    if (!settingsLoaded) return; // Don't fetch until settings are loaded

    // Debounce the fetch to avoid refreshing on every keystroke
    const timer = setTimeout(() => {
      fetchStrategy();
      saveSettings();
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timer);
  }, [extraPayment, settingsLoaded]);

  // Fetch strategy and save settings when method or frequency changes (no debounce needed)
  useEffect(() => {
    if (!settingsLoaded) return;
    fetchStrategy();
    saveSettings();
  }, [method, paymentFrequency]);

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

  const saveSettings = async () => {
    try {
      await fetch('/api/debts/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extraMonthlyPayment: parseFloat(extraPayment) || 0,
          preferredMethod: method,
          paymentFrequency,
        }),
      });
    } catch (error) {
      console.error('Error saving debt settings:', error);
    }
  };

  if (loading) {
    return (
      <div className={className}>
        <div className="text-center py-8 text-muted-foreground">Loading payoff strategy...</div>
      </div>
    );
  }

  if (!comparison || comparison.snowball.payoffOrder.length === 0) {
    return (
      <div className={className}>
        <div className="text-center py-8 text-muted-foreground">
          No active debts found. Create a debt to see payoff strategies.
        </div>
      </div>
    );
  }

  const currentStrategy = method === 'snowball' ? comparison.snowball : comparison.avalanche;
  const alternateStrategy = method === 'snowball' ? comparison.avalanche : comparison.snowball;

  return (
    <div className={className}>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">Debt Payoff Strategy</h2>

        {/* Payment Frequency Toggle */}
        <div className="mb-3">
          <Label className="text-foreground text-sm mb-2 block">Payment Frequency</Label>
          <div className="flex items-center gap-2 bg-card rounded-lg p-1">
            <button
              onClick={() => setPaymentFrequency('monthly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                paymentFrequency === 'monthly'
                  ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setPaymentFrequency('biweekly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                paymentFrequency === 'biweekly'
                  ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Bi-Weekly
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {paymentFrequency === 'biweekly'
              ? '26 payments/year (1 extra payment annually)'
              : '12 payments per year'}
          </p>
        </div>

        {/* Method Toggle */}
        <div>
          <Label className="text-foreground text-sm mb-2 block">Payoff Method</Label>
          <div className="flex items-center gap-2 bg-card rounded-lg p-1">
            <button
              onClick={() => setMethod('snowball')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                method === 'snowball'
                  ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Snowball
            </button>
            <button
              onClick={() => setMethod('avalanche')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                method === 'avalanche'
                  ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Avalanche
            </button>
          </div>
        </div>
      </div>

      {/* Extra Payment Input */}
      <div className="mb-6">
        <Label htmlFor="extraPayment" className="text-foreground mb-2 block">
          Extra {paymentFrequency === 'biweekly' ? 'Per Payment' : 'Monthly Payment'}
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <Input
            id="extraPayment"
            type="number"
            min="0"
            step="10"
            value={extraPayment}
            onChange={(e) => setExtraPayment(e.target.value)}
            className="pl-7 bg-card border-border text-foreground"
            placeholder="0.00"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {paymentFrequency === 'biweekly'
            ? `Amount above minimums per payment (${parseFloat(extraPayment) * 26 || 0}/year)`
            : 'Amount above minimum payments to apply toward debts'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Next Recommended Payment */}
        <div className="bg-card rounded-xl p-6 border border-border">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">📍</span>
            <h3 className="text-lg font-semibold text-foreground">Pay This Next</h3>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-2xl font-bold text-foreground mb-1">
                {currentStrategy.nextRecommendedPayment.debtName}
              </div>
              <div className="text-muted-foreground text-sm">
                Current Balance: ${currentStrategy.nextRecommendedPayment.currentBalance.toFixed(2)}
              </div>
            </div>

            <div className="pt-3 border-t border-border space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recommended Payment:</span>
                <span className="text-foreground font-mono font-semibold">
                  ${currentStrategy.nextRecommendedPayment.recommendedPayment.toFixed(2)}/{paymentFrequency === 'biweekly' ? 'payment' : 'month'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Months Until Payoff:</span>
                <span className="text-foreground font-semibold">
                  {currentStrategy.nextRecommendedPayment.monthsUntilPayoff}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Interest:</span>
                <span className="text-foreground font-mono font-semibold">
                  ${currentStrategy.nextRecommendedPayment.totalInterest.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Payoff Order */}
        <div className="bg-card rounded-xl p-6 border border-border">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">📊</span>
            <h3 className="text-lg font-semibold text-foreground">Your Payoff Order</h3>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {currentStrategy.payoffOrder.map((debt) => (
              <div
                key={debt.debtId}
                className="flex items-center justify-between p-3 bg-elevated rounded-lg hover:bg-elevated transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-card flex items-center justify-center text-foreground font-semibold">
                    {debt.order}
                  </div>
                  <div>
                    <div className="text-foreground font-medium">{debt.debtName}</div>
                    <div className="text-xs text-muted-foreground">
                      ${debt.remainingBalance.toFixed(2)} @ {debt.interestRate}% APR
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  ${debt.minimumPayment.toFixed(2)}/mo min
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Comparison Metrics */}
      <div className="mt-6 bg-card rounded-xl p-6 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">💰</span>
          <h3 className="text-lg font-semibold text-foreground">Method Comparison</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Current Method */}
          <div className="bg-elevated rounded-lg p-4">
            <div className="text-xs text-muted-foreground uppercase mb-1">
              {method === 'snowball' ? 'Snowball' : 'Avalanche'} Method
            </div>
            <div className="space-y-2">
              <div>
                <div className="text-sm text-muted-foreground">Time to debt-free:</div>
                <div className="text-lg font-semibold text-foreground">
                  {currentStrategy.totalMonths} months
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Total interest:</div>
                <div className="text-lg font-mono font-semibold text-foreground">
                  ${currentStrategy.totalInterestPaid.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Alternate Method */}
          <div className="bg-elevated rounded-lg p-4">
            <div className="text-xs text-muted-foreground uppercase mb-1">
              {method === 'snowball' ? 'Avalanche' : 'Snowball'} Method
            </div>
            <div className="space-y-2">
              <div>
                <div className="text-sm text-muted-foreground">Time to debt-free:</div>
                <div className="text-lg font-semibold text-foreground">
                  {alternateStrategy.totalMonths} months
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Total interest:</div>
                <div className="text-lg font-mono font-semibold text-foreground">
                  ${alternateStrategy.totalInterestPaid.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Savings */}
          <div className="bg-elevated rounded-lg p-4">
            <div className="text-xs text-muted-foreground uppercase mb-1">
              {comparison.recommendedMethod === method ? 'You Save:' : 'You Could Save:'}
            </div>
            <div className="space-y-2">
              <div>
                <div className="text-sm text-muted-foreground">Time savings:</div>
                <div className={`text-lg font-semibold ${
                  comparison.timeSavings > 0 ? 'text-[var(--color-income)]' : 'text-muted-foreground'
                }`}>
                  {Math.abs(comparison.timeSavings)} months
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Interest savings:</div>
                <div className={`text-lg font-mono font-semibold ${
                  comparison.interestSavings > 0 ? 'text-[var(--color-income)]' : 'text-muted-foreground'
                }`}>
                  ${Math.abs(comparison.interestSavings).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recommendation */}
        {comparison.recommendedMethod !== method && (
          <div className="mt-4 p-3 bg-[var(--color-transfer)]/10 border border-[var(--color-transfer)]/30 rounded-lg">
            <p className="text-sm text-[var(--color-transfer)]">
              💡 The <strong>{comparison.recommendedMethod}</strong> method could save you{' '}
              {comparison.timeSavings} months and ${comparison.interestSavings.toFixed(2)} in interest!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
