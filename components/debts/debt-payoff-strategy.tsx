'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, DollarSign, Lightbulb, ArrowDown, Target, Clock, Sparkles } from 'lucide-react';
import type { ComparisonResult, PayoffMethod, PaymentFrequency, RolldownPayment } from '@/lib/debts/payoff-calculator';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';

interface DebtPayoffStrategyProps {
  className?: string;
}

export function DebtPayoffStrategy({ className }: DebtPayoffStrategyProps) {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold, putWithHousehold } = useHouseholdFetch();
  const [method, setMethod] = useState<PayoffMethod>('avalanche');
  const [paymentFrequency, setPaymentFrequency] = useState<PaymentFrequency>('monthly');
  const [extraPayment, setExtraPayment] = useState<string>('0');
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load saved settings on mount
  const loadSettings = useCallback(async () => {
    if (!selectedHouseholdId) return;
    try {
      const response = await fetchWithHousehold('/api/debts/settings');
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
  }, [selectedHouseholdId, fetchWithHousehold]);

  useEffect(() => {
    if (!selectedHouseholdId) return;
    loadSettings();
  }, [selectedHouseholdId, loadSettings]);

  const fetchStrategy = useCallback(async () => {
    if (!selectedHouseholdId || !settingsLoaded) return;
    try {
      setLoading(true);
      const response = await fetchWithHousehold(`/api/debts/payoff-strategy?compare=true&extraPayment=${parseFloat(extraPayment) || 0}`);
      if (response.ok) {
        const data = await response.json();
        setComparison(data);
      }
    } catch (error) {
      console.error('Error fetching payoff strategy:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedHouseholdId, settingsLoaded, extraPayment, fetchWithHousehold]);

  const saveSettings = useCallback(async () => {
    if (!selectedHouseholdId) return;
    try {
      await putWithHousehold('/api/debts/settings', {
        extraMonthlyPayment: parseFloat(extraPayment) || 0,
        preferredMethod: method,
        paymentFrequency,
      });
    } catch (error) {
      console.error('Error saving debt settings:', error);
    }
  }, [selectedHouseholdId, extraPayment, method, paymentFrequency, putWithHousehold]);

  // Fetch strategy whenever settings change (debounced for extra payment)
  useEffect(() => {
    if (!settingsLoaded || !selectedHouseholdId) return; // Don't fetch until settings are loaded

    // Debounce the fetch to avoid refreshing on every keystroke
    const timer = setTimeout(() => {
      fetchStrategy();
      saveSettings();
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timer);
  }, [extraPayment, settingsLoaded, selectedHouseholdId, fetchStrategy, saveSettings]);

  // Fetch strategy and save settings when method or frequency changes (no debounce needed)
  useEffect(() => {
    if (!settingsLoaded || !selectedHouseholdId) return;
    fetchStrategy();
    saveSettings();
  }, [method, paymentFrequency, settingsLoaded, selectedHouseholdId, fetchStrategy, saveSettings]);

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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-card rounded-lg p-1">
            <button
              onClick={() => setPaymentFrequency('weekly')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                paymentFrequency === 'weekly'
                  ? 'bg-success text-white'
                  : 'text-muted-foreground hover:text-foreground hover:bg-elevated'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setPaymentFrequency('biweekly')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                paymentFrequency === 'biweekly'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-elevated'
              }`}
            >
              Bi-Weekly
            </button>
            <button
              onClick={() => setPaymentFrequency('monthly')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                paymentFrequency === 'monthly'
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-elevated'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setPaymentFrequency('quarterly')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                paymentFrequency === 'quarterly'
                  ? 'bg-warning text-white'
                  : 'text-muted-foreground hover:text-foreground hover:bg-elevated'
              }`}
            >
              Quarterly
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {paymentFrequency === 'weekly' && (
              <>52 payments/year - Fastest payoff, ideal for weekly paychecks</>
            )}
            {paymentFrequency === 'biweekly' && (
              <>26 payments/year - 1 extra payment annually accelerates payoff</>
            )}
            {paymentFrequency === 'monthly' && (
              <>12 payments/year - Standard payment schedule</>
            )}
            {paymentFrequency === 'quarterly' && (
              <>4 payments/year - For irregular income, slower payoff</>
            )}
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
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Snowball
            </button>
            <button
              onClick={() => setMethod('avalanche')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                method === 'avalanche'
                  ? 'bg-primary text-primary-foreground'
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
            <MapPin className="w-6 h-6 text-primary" />
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

        {/* Payoff Order with Rolldown Visualization */}
        <div className="bg-card rounded-xl p-6 border border-border">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-6 h-6 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Your Payoff Order</h3>
            <span className="text-xs text-muted-foreground ml-auto capitalize">
              {method} Method
            </span>
          </div>

          <div className="space-y-1">
            {currentStrategy.rolldownPayments?.map((debt: RolldownPayment, index: number) => (
              <div key={debt.debtId}>
                {/* Rolldown Arrow for debts after the first */}
                {index > 0 && (
                  <div className="flex items-center justify-center py-1">
                    <div className="flex items-center gap-2 text-income">
                      <ArrowDown className="w-4 h-4" />
                      <span className="text-xs font-medium">
                        +${debt.rolldownAmount.toFixed(0)} rolls down
                      </span>
                      <ArrowDown className="w-4 h-4" />
                    </div>
                  </div>
                )}

                {/* Debt Card */}
                <div
                  className={`p-4 rounded-lg border transition-all ${
                    debt.isFocusDebt
                      ? 'bg-primary/10 border-primary/30'
                      : 'bg-elevated border-border'
                  }`}
                >
                  {/* Header Row */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                          debt.isFocusDebt
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-card text-foreground border border-border'
                        }`}
                      >
                        {debt.order}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-foreground font-medium">{debt.debtName}</span>
                          {debt.isFocusDebt && (
                            <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                              Focus
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ${debt.remainingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} @ {debt.interestRate}% APR
                        </div>
                      </div>
                    </div>
                    
                    {/* Payoff Timeline */}
                    <div className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3 text-income" />
                        <span className="text-xs font-semibold text-income">Month {debt.payoffMonth}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(debt.payoffDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </div>
                      {/* Minimum-only comparison */}
                      {debt.minimumOnlyMonths > 0 && debt.minimumOnlyMonths !== debt.payoffMonth && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {debt.minimumOnlyMonths === -1 ? (
                            <span className="text-error">Min only: Never</span>
                          ) : (
                            <span>
                              Min only: {debt.minimumOnlyMonths} mo
                              {debt.minimumOnlyMonths > debt.payoffMonth && (
                                <span className="text-income ml-1">
                                  ({debt.minimumOnlyMonths - debt.payoffMonth} faster)
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Payment Breakdown */}
                  <div className="mt-3 pt-3 border-t border-border/50">
                    {debt.isFocusDebt ? (
                      /* Focus debt shows current active payment */
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Current Payment:</span>
                          <span className="text-lg font-mono font-semibold text-income">
                            ${debt.activePayment.toFixed(2)}/mo
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                          <span>${debt.minimumPayment.toFixed(0)} min</span>
                          {debt.additionalMonthlyPayment > 0 && (
                            <span>+ ${debt.additionalMonthlyPayment.toFixed(0)} committed</span>
                          )}
                          {parseFloat(extraPayment) > 0 && (
                            <span className="text-income">+ ${parseFloat(extraPayment).toFixed(0)} extra</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Non-focus debts show what payment will be after rolldown */
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Now:</span>
                          <span className="text-sm font-mono text-foreground">
                            ${debt.currentPayment.toFixed(2)}/mo
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-income" />
                            After #{debt.order - 1} paid:
                          </span>
                          <span className="text-sm font-mono font-semibold text-income">
                            ${debt.activePayment.toFixed(2)}/mo
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          (${debt.minimumPayment.toFixed(0)} min
                          {debt.additionalMonthlyPayment > 0 && ` + $${debt.additionalMonthlyPayment.toFixed(0)} committed`}
                          {debt.rolldownAmount > 0 && ` + $${debt.rolldownAmount.toFixed(0)} rolled`}
                          {parseFloat(extraPayment) > 0 && <span className="text-income"> + ${parseFloat(extraPayment).toFixed(0)} extra</span>})
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Comparison Metrics */}
      <div className="mt-6 bg-card rounded-xl p-6 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-6 h-6 text-income" />
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
                  comparison.timeSavings > 0 ? 'text-income' : 'text-muted-foreground'
                }`}>
                  {Math.abs(comparison.timeSavings)} months
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Interest savings:</div>
                <div className={`text-lg font-mono font-semibold ${
                  comparison.interestSavings > 0 ? 'text-income' : 'text-muted-foreground'
                }`}>
                  ${Math.abs(comparison.interestSavings).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recommendation */}
        {comparison.recommendedMethod !== method && (
          <div className="mt-4 p-3 bg-transfer/10 border border-transfer/30 rounded-lg">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-transfer shrink-0 mt-0.5" />
              <p className="text-sm text-transfer">
                The <strong>{comparison.recommendedMethod}</strong> method could save you{' '}
                {comparison.timeSavings} months and ${comparison.interestSavings.toFixed(2)} in interest!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
