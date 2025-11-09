'use client';

import { useEffect, useState } from 'react';

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
  const [data, setData] = useState<WarningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWarningData();
  }, []);

  const fetchWarningData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/debts/minimum-warning');

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
  };

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
        <div className="text-center py-8 text-[#808080]">Loading comparison...</div>
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
        <div className="bg-gradient-to-r from-amber-900/30 to-amber-800/30 border border-amber-600/50 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <span className="text-4xl">⚠️</span>
            <div>
              <h3 className="text-xl font-bold text-amber-200 mb-2">
                Only Paying Minimums?
              </h3>
              <p className="text-amber-100/90 mb-3">
                You're currently set to pay only the minimum payments. This will cost you significantly more in interest and keep you in debt much longer.
              </p>
              <div className="bg-[#1a1a1a]/60 rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[#808080]">Time to debt-free:</span>
                  <span className="text-xl font-bold text-white">
                    {formatTimespan(data.minimumOnlyScenario.totalYears, data.minimumOnlyScenario.remainingMonths)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#808080]">Total interest you'll pay:</span>
                  <span className="text-xl font-bold font-mono text-red-400">
                    ${data.minimumOnlyScenario.totalInterestPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              <p className="text-amber-100/90 mt-4 text-sm">
                💡 <strong>Tip:</strong> Add even a small extra payment in the Payoff Strategy section below to see how much faster you can become debt-free and how much you can save!
              </p>
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
      <div className="bg-gradient-to-r from-amber-900/30 to-amber-800/30 border border-amber-600/50 rounded-xl p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <span className="text-3xl">⚠️</span>
          <div>
            <h3 className="text-xl font-bold text-amber-200">The True Cost of Minimum Payments</h3>
            <p className="text-amber-100/80 text-sm mt-1">
              See how much your extra ${data.currentPlanScenario.extraPayment.toLocaleString()} payment is saving you
            </p>
          </div>
        </div>

        {/* Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Minimum Only Column */}
          <div className="bg-gradient-to-br from-red-950/50 to-red-900/30 border border-red-500/30 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🐌</span>
              <h4 className="text-lg font-semibold text-red-200">Minimum Payments Only</h4>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-sm text-red-300/70 mb-1">Time to debt-free</div>
                <div className="text-3xl font-bold text-red-200">
                  {data.minimumOnlyScenario.totalYears} years
                </div>
                {data.minimumOnlyScenario.remainingMonths > 0 && (
                  <div className="text-sm text-red-300/70">
                    and {data.minimumOnlyScenario.remainingMonths} months
                  </div>
                )}
              </div>

              <div>
                <div className="text-sm text-red-300/70 mb-1">Total interest paid</div>
                <div className="text-2xl font-bold font-mono text-red-300">
                  ${data.minimumOnlyScenario.totalInterestPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div>
                <div className="text-sm text-red-300/70 mb-1">Monthly payment</div>
                <div className="text-xl font-mono text-red-200">
                  ${data.minimumOnlyScenario.monthlyPayment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-red-300/70">(minimums only)</div>
              </div>

              <div>
                <div className="text-sm text-red-300/70 mb-1">Debt-free date</div>
                <div className="text-lg text-red-200">
                  {formatDate(data.minimumOnlyScenario.debtFreeDate)}
                </div>
              </div>
            </div>
          </div>

          {/* Current Plan Column */}
          <div className="bg-gradient-to-br from-emerald-950/50 to-emerald-900/30 border border-emerald-500/30 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">⚡</span>
              <h4 className="text-lg font-semibold text-emerald-200">Your Current Plan</h4>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-sm text-emerald-300/70 mb-1">Time to debt-free</div>
                <div className="text-3xl font-bold text-emerald-200">
                  {data.currentPlanScenario.totalYears} years
                </div>
                {data.currentPlanScenario.remainingMonths > 0 && (
                  <div className="text-sm text-emerald-300/70">
                    and {data.currentPlanScenario.remainingMonths} months
                  </div>
                )}
              </div>

              <div>
                <div className="text-sm text-emerald-300/70 mb-1">Total interest paid</div>
                <div className="text-2xl font-bold font-mono text-emerald-300">
                  ${data.currentPlanScenario.totalInterestPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div>
                <div className="text-sm text-emerald-300/70 mb-1">Monthly payment</div>
                <div className="text-xl font-mono text-emerald-200">
                  ${data.currentPlanScenario.monthlyPayment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-emerald-300/70">
                  (+${data.currentPlanScenario.extraPayment.toLocaleString()} extra)
                </div>
              </div>

              <div>
                <div className="text-sm text-emerald-300/70 mb-1">Debt-free date</div>
                <div className="text-lg text-emerald-200">
                  {formatDate(data.currentPlanScenario.debtFreeDate)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Savings Highlight */}
        <div className="bg-gradient-to-r from-blue-950/60 to-blue-900/40 border border-blue-500/40 rounded-lg p-5">
          <div className="flex items-start gap-3">
            <span className="text-3xl">🎯</span>
            <div className="flex-1">
              <h4 className="text-lg font-semibold text-blue-200 mb-3">
                By paying ${data.currentPlanScenario.extraPayment.toLocaleString()} extra per month, you will:
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#1a1a1a]/40 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">⏱️</span>
                    <div className="text-sm text-blue-300/70">Time Saved</div>
                  </div>
                  <div className="text-2xl font-bold text-blue-200">
                    {data.comparison.yearsSaved > 0
                      ? `${data.comparison.yearsSaved} year${data.comparison.yearsSaved !== 1 ? 's' : ''}`
                      : `${data.comparison.monthsSaved} months`
                    }
                  </div>
                  {data.comparison.yearsSaved > 0 && data.comparison.remainingMonthsSaved > 0 && (
                    <div className="text-sm text-blue-300/70">
                      {data.comparison.remainingMonthsSaved} months
                    </div>
                  )}
                </div>

                <div className="bg-[#1a1a1a]/40 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">💵</span>
                    <div className="text-sm text-blue-300/70">Interest Saved</div>
                  </div>
                  <div className="text-2xl font-bold font-mono text-blue-200">
                    ${data.comparison.interestSaved.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-sm text-blue-300/70">
                    ({Math.round(data.comparison.percentageReduction)}% less!)
                  </div>
                </div>

                <div className="bg-[#1a1a1a]/40 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">🎉</span>
                    <div className="text-sm text-blue-300/70">Debt-Free Sooner</div>
                  </div>
                  <div className="text-lg font-semibold text-blue-200">
                    {formatDate(data.currentPlanScenario.debtFreeDate)}
                  </div>
                  <div className="text-sm text-blue-300/70">
                    instead of {formatDate(data.minimumOnlyScenario.debtFreeDate)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Warning Message */}
        <div className="bg-red-950/40 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-200 text-sm font-medium">
            ⚠️ <strong>WARNING:</strong> If you only pay minimums, you'll pay{' '}
            <span className="text-red-300 font-bold">
              {interestMultiplier >= 2
                ? `${Math.round(interestMultiplier)}x more`
                : `${Math.round((interestMultiplier - 1) * 100)}% more`
              }
            </span>{' '}
            in interest and stay in debt for{' '}
            <span className="text-red-300 font-bold">
              {timeMultiplier >= 2
                ? `${Math.round(timeMultiplier)}x longer`
                : `${Math.round((timeMultiplier - 1) * 100)}% longer`
              }
            </span>!
          </p>
        </div>
      </div>
    </div>
  );
}
