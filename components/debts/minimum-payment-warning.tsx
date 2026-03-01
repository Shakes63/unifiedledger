'use client';

import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, Zap, Target, Clock, Banknote, PartyPopper, Turtle } from 'lucide-react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';

interface MinimumOnlyScenario {
  totalMonths: number;
  totalYears: number;
  remainingMonths: number;
  totalInterestPaid: number;
  debtFreeDate: string;
  monthlyPayment: number;
}

interface CurrentPlanScenario {
  totalMonths: number;
  totalYears: number;
  remainingMonths: number;
  totalInterestPaid: number;
  debtFreeDate: string;
  monthlyPayment: number;
  extraPayment: number;
}

interface Comparison {
  monthsSaved: number;
  yearsSaved: number;
  remainingMonthsSaved: number;
  interestSaved: number;
  percentageReduction: number;
  hasExtraPayment: boolean;
}

interface WarningData {
  minimumOnlyScenario: MinimumOnlyScenario;
  currentPlanScenario: CurrentPlanScenario;
  comparison: Comparison;
}

interface MinimumPaymentWarningProps {
  className?: string;
}

export function MinimumPaymentWarning({ className }: MinimumPaymentWarningProps) {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [data, setData] = useState<WarningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWarningData = useCallback(async () => {
    if (!selectedHouseholdId) return;
    try {
      setLoading(true);
      setError(null);
      const response = await fetchWithHousehold('/api/debts/minimum-warning');

      if (!response.ok) {
        if (response.status === 404) {
          setError('no-debts');
        } else {
          throw new Error('Failed to fetch warning data');
        }
        return;
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching minimum payment warning:', err);
      setError('error');
    } finally {
      setLoading(false);
    }
  }, [selectedHouseholdId, fetchWithHousehold]);

  useEffect(() => {
    if (!selectedHouseholdId) return;
    fetchWarningData();
  }, [selectedHouseholdId, fetchWarningData]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const formatTimespan = (years: number, months: number) => {
    if (years === 0) {
      return `${months} month${months !== 1 ? 's' : ''}`;
    }
    if (months === 0) {
      return `${years} year${years !== 1 ? 's' : ''}`;
    }
    return `${years} year${years !== 1 ? 's' : ''}, ${months} month${months !== 1 ? 's' : ''}`;
  };

  if (loading) {
    return (
      <div className={className}>
        <div className="text-center py-8" style={{ color: 'var(--color-muted-foreground)' }}>Loading comparison...</div>
      </div>
    );
  }

  if (error === 'no-debts') {
    return null; // Don't show anything if no debts
  }

  if (error || !data) {
    return null; // Silently fail - this is optional info
  }

  // If user has no extra payment, show encouragement message
  if (!data.comparison.hasExtraPayment) {
    return (
      <div className={className}>
        <div
          className="rounded-xl p-6"
          style={{
            background: 'linear-gradient(to right, color-mix(in oklch, var(--color-warning) 30%, transparent), color-mix(in oklch, var(--color-warning) 20%, transparent))',
            border: '1px solid color-mix(in oklch, var(--color-warning) 50%, transparent)',
          }}
        >
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-10 h-10" style={{ color: 'var(--color-warning)' }} />
            <div>
              <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--color-warning)' }}>
                Only Paying Minimums?
              </h3>
              <p className="mb-3" style={{ color: 'var(--color-muted-foreground)' }}>
                You&apos;re currently set to pay only the minimum payments. This will cost you significantly more in interest and keep you in debt much longer.
              </p>
              <div className="rounded-lg p-4 space-y-2" style={{ backgroundColor: 'color-mix(in oklch, var(--color-elevated) 60%, transparent)' }}>
                <div className="flex justify-between items-center">
                  <span style={{ color: 'var(--color-muted-foreground)' }}>Time to debt-free:</span>
                  <span className="text-xl font-bold" style={{ color: 'var(--color-foreground)' }}>
                    {formatTimespan(data.minimumOnlyScenario.totalYears, data.minimumOnlyScenario.remainingMonths)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span style={{ color: 'var(--color-muted-foreground)' }}>Total interest you&apos;ll pay:</span>
                  <span className="text-xl font-bold font-mono" style={{ color: 'var(--color-destructive)' }}>
                    ${data.minimumOnlyScenario.totalInterestPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              <div className="mt-4 text-sm flex items-start gap-2" style={{ color: 'var(--color-muted-foreground)' }}>
                <Zap className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--color-success)' }} />
                <p>
                  <strong>Tip:</strong> Add even a small extra payment in the Payoff Strategy section below to see how much faster you can become debt-free and how much you can save!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Calculate multipliers for impact messaging
  const timeMultiplier = data.minimumOnlyScenario.totalMonths / data.currentPlanScenario.totalMonths;
  const interestMultiplier = data.minimumOnlyScenario.totalInterestPaid / data.currentPlanScenario.totalInterestPaid;

  return (
    <div className={className}>
      <div
        className="rounded-xl p-6 space-y-6"
        style={{
          background: 'linear-gradient(to right, color-mix(in oklch, var(--color-warning) 30%, transparent), color-mix(in oklch, var(--color-warning) 20%, transparent))',
          border: '1px solid color-mix(in oklch, var(--color-warning) 50%, transparent)',
        }}
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-8 h-8" style={{ color: 'var(--color-warning)' }} />
          <div>
            <h3 className="text-xl font-bold" style={{ color: 'var(--color-warning)' }}>The True Cost of Minimum Payments</h3>
            <p className="text-sm mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
              See how much your extra ${data.currentPlanScenario.extraPayment.toLocaleString()} payment is saving you
            </p>
          </div>
        </div>

        {/* Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Minimum Only Column */}
          <div
            className="rounded-lg p-5"
            style={{
              background: 'linear-gradient(to bottom right, color-mix(in oklch, var(--color-destructive) 20%, transparent), color-mix(in oklch, var(--color-destructive) 10%, transparent))',
              border: '1px solid color-mix(in oklch, var(--color-destructive) 25%, transparent)',
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Turtle className="w-6 h-6" style={{ color: 'var(--color-destructive)' }} />
              <h4 className="text-lg font-semibold" style={{ color: 'var(--color-destructive)' }}>Minimum Payments Only</h4>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-sm mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Time to debt-free</div>
                <div className="text-3xl font-bold" style={{ color: 'var(--color-destructive)' }}>
                  {data.minimumOnlyScenario.totalYears} years
                </div>
                {data.minimumOnlyScenario.remainingMonths > 0 && (
                  <div className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                    and {data.minimumOnlyScenario.remainingMonths} months
                  </div>
                )}
              </div>

              <div>
                <div className="text-sm mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Total interest paid</div>
                <div className="text-2xl font-bold font-mono" style={{ color: 'var(--color-destructive)' }}>
                  ${data.minimumOnlyScenario.totalInterestPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div>
                <div className="text-sm mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Monthly payment</div>
                <div className="text-xl font-mono" style={{ color: 'var(--color-destructive)' }}>
                  ${data.minimumOnlyScenario.monthlyPayment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>(minimums only)</div>
              </div>

              <div>
                <div className="text-sm mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Debt-free date</div>
                <div className="text-lg" style={{ color: 'var(--color-destructive)' }}>
                  {formatDate(data.minimumOnlyScenario.debtFreeDate)}
                </div>
              </div>
            </div>
          </div>

          {/* Current Plan Column */}
          <div
            className="rounded-lg p-5"
            style={{
              background: 'linear-gradient(to bottom right, color-mix(in oklch, var(--color-income) 20%, transparent), color-mix(in oklch, var(--color-income) 10%, transparent))',
              border: '1px solid color-mix(in oklch, var(--color-income) 25%, transparent)',
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-6 h-6" style={{ color: 'var(--color-income)' }} />
              <h4 className="text-lg font-semibold" style={{ color: 'var(--color-income)' }}>Your Current Plan</h4>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-sm mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Time to debt-free</div>
                <div className="text-3xl font-bold" style={{ color: 'var(--color-income)' }}>
                  {data.currentPlanScenario.totalYears} years
                </div>
                {data.currentPlanScenario.remainingMonths > 0 && (
                  <div className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                    and {data.currentPlanScenario.remainingMonths} months
                  </div>
                )}
              </div>

              <div>
                <div className="text-sm mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Total interest paid</div>
                <div className="text-2xl font-bold font-mono" style={{ color: 'var(--color-income)' }}>
                  ${data.currentPlanScenario.totalInterestPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div>
                <div className="text-sm mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Monthly payment</div>
                <div className="text-xl font-mono" style={{ color: 'var(--color-income)' }}>
                  ${data.currentPlanScenario.monthlyPayment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                  (+${data.currentPlanScenario.extraPayment.toLocaleString()} extra)
                </div>
              </div>

              <div>
                <div className="text-sm mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Debt-free date</div>
                <div className="text-lg" style={{ color: 'var(--color-income)' }}>
                  {formatDate(data.currentPlanScenario.debtFreeDate)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Savings Highlight */}
        <div
          className="rounded-lg p-5"
          style={{
            background: 'linear-gradient(to right, color-mix(in oklch, var(--color-primary) 30%, transparent), color-mix(in oklch, var(--color-primary) 20%, transparent))',
            border: '1px solid color-mix(in oklch, var(--color-primary) 40%, transparent)',
          }}
        >
          <div className="flex items-start gap-3">
            <Target className="w-8 h-8" style={{ color: 'var(--color-primary)' }} />
            <div className="flex-1">
              <h4 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-primary)' }}>
                By paying ${data.currentPlanScenario.extraPayment.toLocaleString()} extra per month, you will:
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-lg p-4" style={{ backgroundColor: 'color-mix(in oklch, var(--color-elevated) 40%, transparent)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                    <div className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Time Saved</div>
                  </div>
                  <div className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>
                    {data.comparison.yearsSaved > 0
                      ? `${data.comparison.yearsSaved} year${data.comparison.yearsSaved !== 1 ? 's' : ''}`
                      : `${data.comparison.monthsSaved} months`
                    }
                  </div>
                  {data.comparison.yearsSaved > 0 && data.comparison.remainingMonthsSaved > 0 && (
                    <div className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                      {data.comparison.remainingMonthsSaved} months
                    </div>
                  )}
                </div>

                <div className="rounded-lg p-4" style={{ backgroundColor: 'color-mix(in oklch, var(--color-elevated) 40%, transparent)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Banknote className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                    <div className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Interest Saved</div>
                  </div>
                  <div className="text-2xl font-bold font-mono" style={{ color: 'var(--color-primary)' }}>
                    ${data.comparison.interestSaved.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                    ({Math.round(data.comparison.percentageReduction)}% less!)
                  </div>
                </div>

                <div className="rounded-lg p-4" style={{ backgroundColor: 'color-mix(in oklch, var(--color-elevated) 40%, transparent)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <PartyPopper className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                    <div className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Debt-Free Sooner</div>
                  </div>
                  <div className="text-lg font-semibold" style={{ color: 'var(--color-primary)' }}>
                    {formatDate(data.currentPlanScenario.debtFreeDate)}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                    instead of {formatDate(data.minimumOnlyScenario.debtFreeDate)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Warning Message */}
        <div
          className="rounded-lg p-4"
          style={{
            backgroundColor: 'color-mix(in oklch, var(--color-destructive) 20%, transparent)',
            border: '1px solid color-mix(in oklch, var(--color-destructive) 25%, transparent)',
          }}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--color-destructive)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--color-destructive)' }}>
              <strong>WARNING:</strong> If you only pay minimums, you&apos;ll pay{' '}
            <span className="font-bold" style={{ color: 'var(--color-destructive)' }}>
              {interestMultiplier >= 2
                ? `${Math.round(interestMultiplier)}x more`
                : `${Math.round((interestMultiplier - 1) * 100)}% more`
              }
            </span>{' '}
            in interest and stay in debt for{' '}
            <span className="font-bold" style={{ color: 'var(--color-destructive)' }}>
              {timeMultiplier >= 2
                ? `${Math.round(timeMultiplier)}x longer`
                : `${Math.round((timeMultiplier - 1) * 100)}% longer`
              }
            </span>!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
