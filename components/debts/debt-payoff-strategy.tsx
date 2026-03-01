'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  const skipNextSaveRef = useRef(true);

  const normalizedExtraPayment = useMemo(() => {
    const parsed = Number.parseFloat(extraPayment);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }, [extraPayment]);

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
      }
    } catch (error) {
      console.error('Error loading debt settings:', error);
    } finally {
      skipNextSaveRef.current = true;
      setSettingsLoaded(true);
    }
  }, [selectedHouseholdId, fetchWithHousehold]);

  useEffect(() => {
    if (!selectedHouseholdId) return;
    loadSettings();
  }, [selectedHouseholdId, loadSettings]);

  const fetchStrategy = useCallback(async (
    selectedMethod: PayoffMethod,
    selectedFrequency: PaymentFrequency,
    selectedExtraPayment: number
  ) => {
    if (!selectedHouseholdId || !settingsLoaded) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({
        compare: 'true',
        extraPayment: selectedExtraPayment.toString(),
        method: selectedMethod,
        paymentFrequency: selectedFrequency,
      });
      const response = await fetchWithHousehold(`/api/debts/payoff-strategy?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setComparison(data);
      }
    } catch (error) {
      console.error('Error fetching payoff strategy:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedHouseholdId, settingsLoaded, fetchWithHousehold]);

  const saveSettings = useCallback(async (
    selectedMethod: PayoffMethod,
    selectedFrequency: PaymentFrequency,
    selectedExtraPayment: number
  ) => {
    if (!selectedHouseholdId) return;
    try {
      await putWithHousehold('/api/debts/settings', {
        extraMonthlyPayment: selectedExtraPayment,
        preferredMethod: selectedMethod,
        paymentFrequency: selectedFrequency,
      });
    } catch (error) {
      console.error('Error saving debt settings:', error);
    }
  }, [selectedHouseholdId, putWithHousehold]);

  // Fetch strategy whenever settings change.
  useEffect(() => {
    if (!settingsLoaded || !selectedHouseholdId) return;
    const timer = setTimeout(() => {
      void fetchStrategy(method, paymentFrequency, normalizedExtraPayment);
    }, 350);

    return () => clearTimeout(timer);
  }, [method, paymentFrequency, normalizedExtraPayment, settingsLoaded, selectedHouseholdId, fetchStrategy]);

  // Persist settings after user-driven changes.
  useEffect(() => {
    if (!settingsLoaded || !selectedHouseholdId) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    const timer = setTimeout(() => {
      void saveSettings(method, paymentFrequency, normalizedExtraPayment);
    }, 700);

    return () => clearTimeout(timer);
  }, [
    method,
    paymentFrequency,
    normalizedExtraPayment,
    settingsLoaded,
    selectedHouseholdId,
    saveSettings,
  ]);

  if (loading) {
    return (
      <div className={className}>
        <div className="text-center py-8" style={{ color: 'var(--color-muted-foreground)' }}>Loading payoff strategy...</div>
      </div>
    );
  }

  if (!comparison || comparison.snowball.payoffOrder.length === 0) {
    return (
      <div className={className}>
        <div className="text-center py-8" style={{ color: 'var(--color-muted-foreground)' }}>
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
        <h2 className="text-[17px] font-semibold mb-4" style={{ color: 'var(--color-foreground)' }}>Debt Payoff Strategy</h2>

        {/* Payment Frequency Toggle */}
        <div className="mb-3">
          <Label className="text-[11px] font-medium uppercase tracking-wide block mb-1.5" style={{ color: 'var(--color-muted-foreground)' }}>Payment Frequency</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-lg p-1" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
            <button
              onClick={() => setPaymentFrequency('weekly')}
              className="px-3 py-2 rounded-md text-sm font-medium transition-colors"
              style={
                paymentFrequency === 'weekly'
                  ? { backgroundColor: 'var(--color-success)', color: 'white' }
                  : { color: 'var(--color-muted-foreground)' }
              }
            >
              Weekly
            </button>
            <button
              onClick={() => setPaymentFrequency('biweekly')}
              className="px-3 py-2 rounded-md text-sm font-medium transition-colors"
              style={
                paymentFrequency === 'biweekly'
                  ? { backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }
                  : { color: 'var(--color-muted-foreground)' }
              }
            >
              Bi-Weekly
            </button>
            <button
              onClick={() => setPaymentFrequency('monthly')}
              className="px-3 py-2 rounded-md text-sm font-medium transition-colors"
              style={
                paymentFrequency === 'monthly'
                  ? { backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-foreground)' }
                  : { color: 'var(--color-muted-foreground)' }
              }
            >
              Monthly
            </button>
            <button
              onClick={() => setPaymentFrequency('quarterly')}
              className="px-3 py-2 rounded-md text-sm font-medium transition-colors"
              style={
                paymentFrequency === 'quarterly'
                  ? { backgroundColor: 'var(--color-warning)', color: 'white' }
                  : { color: 'var(--color-muted-foreground)' }
              }
            >
              Quarterly
            </button>
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
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
          <Label className="text-[11px] font-medium uppercase tracking-wide block mb-1.5" style={{ color: 'var(--color-muted-foreground)' }}>Payoff Method</Label>
          <div className="flex items-center gap-2 rounded-lg p-1" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
            <button
              onClick={() => setMethod('snowball')}
              className="px-4 py-2 rounded-md text-sm font-medium transition-colors"
              style={
                method === 'snowball'
                  ? { backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }
                  : { color: 'var(--color-muted-foreground)' }
              }
            >
              Snowball
            </button>
            <button
              onClick={() => setMethod('avalanche')}
              className="px-4 py-2 rounded-md text-sm font-medium transition-colors"
              style={
                method === 'avalanche'
                  ? { backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }
                  : { color: 'var(--color-muted-foreground)' }
              }
            >
              Avalanche
            </button>
          </div>
        </div>
      </div>

      {/* Extra Payment Input */}
      <div className="mb-6">
        <Label htmlFor="extraPayment" className="text-[11px] font-medium uppercase tracking-wide block mb-1.5" style={{ color: 'var(--color-muted-foreground)' }}>
          Extra {paymentFrequency === 'biweekly' ? 'Per Payment' : 'Monthly Payment'}
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-muted-foreground)' }}>$</span>
          <Input
            id="extraPayment"
            type="number"
            min="0"
            step="10"
            value={extraPayment}
            onChange={(e) => setExtraPayment(e.target.value)}
            className="pl-7"
            style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
            placeholder="0.00"
          />
        </div>
        <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
          {paymentFrequency === 'biweekly'
            ? `Amount above minimums per payment (${normalizedExtraPayment * 26 || 0}/year)`
            : 'Amount above minimum payments to apply toward debts'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Next Recommended Payment */}
        <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-foreground)' }}>Pay This Next</h3>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-2xl font-bold mb-1" style={{ color: 'var(--color-foreground)' }}>
                {currentStrategy.nextRecommendedPayment.debtName}
              </div>
              <div className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                Current Balance: ${currentStrategy.nextRecommendedPayment.currentBalance.toFixed(2)}
              </div>
            </div>

            <div className="pt-3 border-t space-y-2" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex justify-between">
                <span style={{ color: 'var(--color-muted-foreground)' }}>Recommended Payment:</span>
                <span className="font-mono font-semibold" style={{ color: 'var(--color-foreground)' }}>
                  ${currentStrategy.nextRecommendedPayment.recommendedPayment.toFixed(2)}/{paymentFrequency === 'biweekly' ? 'payment' : 'month'}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--color-muted-foreground)' }}>Months Until Payoff:</span>
                <span className="font-semibold" style={{ color: 'var(--color-foreground)' }}>
                  {currentStrategy.nextRecommendedPayment.monthsUntilPayoff}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--color-muted-foreground)' }}>Total Interest:</span>
                <span className="font-mono font-semibold" style={{ color: 'var(--color-foreground)' }}>
                  ${currentStrategy.nextRecommendedPayment.totalInterest.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Payoff Order with Rolldown Visualization */}
        <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-foreground)' }}>Your Payoff Order</h3>
            <span className="text-xs ml-auto capitalize" style={{ color: 'var(--color-muted-foreground)' }}>
              {method} Method
            </span>
          </div>

          <div className="space-y-1">
            {currentStrategy.rolldownPayments?.map((debt: RolldownPayment, index: number) => (
              <div key={debt.debtId}>
                {/* Rolldown Arrow for debts after the first */}
                {index > 0 && (
                  <div className="flex items-center justify-center py-1">
                    <div className="flex items-center gap-2" style={{ color: 'var(--color-income)' }}>
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
                  className="p-4 rounded-lg border transition-all"
                  style={
                    debt.isFocusDebt
                      ? { backgroundColor: 'color-mix(in oklch, var(--color-primary) 10%, transparent)', border: '1px solid color-mix(in oklch, var(--color-primary) 25%, transparent)' }
                      : { backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }
                  }
                >
                  {/* Header Row */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm"
                        style={
                          debt.isFocusDebt
                            ? { backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }
                            : { backgroundColor: 'var(--color-background)', color: 'var(--color-foreground)', border: '1px solid var(--color-border)' }
                        }
                      >
                        {debt.order}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium" style={{ color: 'var(--color-foreground)' }}>{debt.debtName}</span>
                          {debt.isFocusDebt && (
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
                              Focus
                            </span>
                          )}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                          ${debt.remainingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} @ {debt.interestRate}% APR
                        </div>
                      </div>
                    </div>
                    
                    {/* Payoff Timeline */}
                    <div className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3" style={{ color: 'var(--color-income)' }} />
                        <span className="text-xs font-semibold" style={{ color: 'var(--color-income)' }}>Month {debt.payoffMonth}</span>
                      </div>
                      <div className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                        {new Date(debt.payoffDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </div>
                      {/* Minimum-only comparison */}
                      {debt.minimumOnlyMonths > 0 && debt.minimumOnlyMonths !== debt.payoffMonth && (
                        <div className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                          {debt.minimumOnlyMonths === -1 ? (
                            <span style={{ color: 'var(--color-destructive)' }}>Min only: Never</span>
                          ) : (
                            <span>
                              Min only: {debt.minimumOnlyMonths} mo
                              {debt.minimumOnlyMonths > debt.payoffMonth && (
                                <span className="ml-1" style={{ color: 'var(--color-income)' }}>
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
                  <div className="mt-3 pt-3 border-t" style={{ borderColor: 'color-mix(in oklch, var(--color-border) 50%, transparent)' }}>
                    {debt.isFocusDebt ? (
                      /* Focus debt shows current active payment */
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Current Payment:</span>
                          <span className="text-lg font-mono font-semibold" style={{ color: 'var(--color-income)' }}>
                            ${debt.activePayment.toFixed(2)}/mo
                          </span>
                        </div>
                        <div className="text-xs flex flex-wrap gap-x-2" style={{ color: 'var(--color-muted-foreground)' }}>
                          <span>${debt.minimumPayment.toFixed(0)} min</span>
                          {debt.additionalMonthlyPayment > 0 && (
                            <span>+ ${debt.additionalMonthlyPayment.toFixed(0)} committed</span>
                          )}
                          {normalizedExtraPayment > 0 && (
                            <span style={{ color: 'var(--color-income)' }}>+ ${normalizedExtraPayment.toFixed(0)} extra</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Non-focus debts show what payment will be after rolldown */
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Now:</span>
                          <span className="text-sm font-mono" style={{ color: 'var(--color-foreground)' }}>
                            ${debt.currentPayment.toFixed(2)}/mo
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm flex items-center gap-1" style={{ color: 'var(--color-muted-foreground)' }}>
                            <Sparkles className="w-3 h-3" style={{ color: 'var(--color-income)' }} />
                            After #{debt.order - 1} paid:
                          </span>
                          <span className="text-sm font-mono font-semibold" style={{ color: 'var(--color-income)' }}>
                            ${debt.activePayment.toFixed(2)}/mo
                          </span>
                        </div>
                        <div className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                          (${debt.minimumPayment.toFixed(0)} min
                          {debt.additionalMonthlyPayment > 0 && ` + $${debt.additionalMonthlyPayment.toFixed(0)} committed`}
                          {debt.rolldownAmount > 0 && ` + $${debt.rolldownAmount.toFixed(0)} rolled`}
                          {normalizedExtraPayment > 0 && <span style={{ color: 'var(--color-income)' }}> + ${normalizedExtraPayment.toFixed(0)} extra</span>})
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
      <div className="mt-6 rounded-xl p-6" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-6 h-6" style={{ color: 'var(--color-income)' }} />
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-foreground)' }}>Method Comparison</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Current Method */}
          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-elevated)' }}>
            <div className="text-xs uppercase mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
              {method === 'snowball' ? 'Snowball' : 'Avalanche'} Method
            </div>
            <div className="space-y-2">
              <div>
                <div className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Time to debt-free:</div>
                <div className="text-lg font-semibold" style={{ color: 'var(--color-foreground)' }}>
                  {currentStrategy.totalMonths} months
                </div>
              </div>
              <div>
                <div className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Total interest:</div>
                <div className="text-lg font-mono font-semibold" style={{ color: 'var(--color-foreground)' }}>
                  ${currentStrategy.totalInterestPaid.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Alternate Method */}
          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-elevated)' }}>
            <div className="text-xs uppercase mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
              {method === 'snowball' ? 'Avalanche' : 'Snowball'} Method
            </div>
            <div className="space-y-2">
              <div>
                <div className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Time to debt-free:</div>
                <div className="text-lg font-semibold" style={{ color: 'var(--color-foreground)' }}>
                  {alternateStrategy.totalMonths} months
                </div>
              </div>
              <div>
                <div className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Total interest:</div>
                <div className="text-lg font-mono font-semibold" style={{ color: 'var(--color-foreground)' }}>
                  ${alternateStrategy.totalInterestPaid.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Savings */}
          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-elevated)' }}>
            <div className="text-xs uppercase mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
              {comparison.recommendedMethod === method ? 'You Save:' : 'You Could Save:'}
            </div>
            <div className="space-y-2">
              <div>
                <div className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Time savings:</div>
                <div className="text-lg font-semibold" style={{ color: comparison.timeSavings > 0 ? 'var(--color-income)' : 'var(--color-muted-foreground)' }}>
                  {Math.abs(comparison.timeSavings)} months
                </div>
              </div>
              <div>
                <div className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Interest savings:</div>
                <div className="text-lg font-mono font-semibold" style={{ color: comparison.interestSavings > 0 ? 'var(--color-income)' : 'var(--color-muted-foreground)' }}>
                  ${Math.abs(comparison.interestSavings).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recommendation */}
        {comparison.recommendedMethod !== method && (
          <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 10%, transparent)', border: '1px solid color-mix(in oklch, var(--color-primary) 25%, transparent)' }}>
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--color-primary)' }} />
              <p className="text-sm" style={{ color: 'var(--color-primary)' }}>
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
