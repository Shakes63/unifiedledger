'use client';

import { useMemo, useEffect } from 'react';
import type { DebtPayoffSchedule } from '@/lib/debts/payoff-calculator';
import { PieChart } from '@/components/charts/pie-chart';
import { ProgressRing } from '@/components/ui/progress-ring';

interface MonthDetailModalProps {
  schedule: DebtPayoffSchedule;
  monthIndex: number;
  startMonth?: number;
  onClose: () => void;
  onNavigate?: (direction: 'prev' | 'next') => void;
}

export function MonthDetailModal({
  schedule,
  monthIndex,
  startMonth = 0,
  onClose,
  onNavigate,
}: MonthDetailModalProps) {
  const payment = schedule.monthlyBreakdown[monthIndex];
  const absoluteMonth = startMonth + monthIndex + 1;

  // Calculate derived data
  const monthDetails = useMemo(() => {
    // Calculate cumulative totals up to this month
    let cumulativePrincipal = 0;
    let cumulativeInterest = 0;

    for (let i = 0; i <= monthIndex; i++) {
      cumulativePrincipal += schedule.monthlyBreakdown[i].principalAmount;
      cumulativeInterest += schedule.monthlyBreakdown[i].interestAmount;
    }

    const percentPaidOff = (cumulativePrincipal / schedule.originalBalance) * 100;
    const monthsRemaining = schedule.monthsToPayoff - (monthIndex + 1);

    // Calculate date for this month
    const date = new Date();
    date.setMonth(date.getMonth() + absoluteMonth);

    // Payment breakdown for pie chart
    const principalPercent = (payment.principalAmount / payment.paymentAmount) * 100;
    const interestPercent = (payment.interestAmount / payment.paymentAmount) * 100;

    return {
      date,
      cumulativePrincipal,
      cumulativeInterest,
      percentPaidOff,
      monthsRemaining,
      principalPercent,
      interestPercent,
    };
  }, [schedule, monthIndex, absoluteMonth, payment]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && monthIndex > 0) {
        onNavigate?.('prev');
      } else if (e.key === 'ArrowRight' && monthIndex < schedule.monthlyBreakdown.length - 1) {
        onNavigate?.('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [monthIndex, schedule.monthlyBreakdown.length, onClose, onNavigate]);

  // Pie chart data
  const pieChartData = [
    {
      name: 'Principal',
      value: parseFloat(payment.principalAmount.toFixed(2)),
    },
    {
      name: 'Interest',
      value: parseFloat(payment.interestAmount.toFixed(2)),
    },
  ];

  const pieChartColors = ['var(--color-chart-principal)', 'var(--color-chart-interest)'];

  const canGoBack = monthIndex > 0;
  const canGoForward = monthIndex < schedule.monthlyBreakdown.length - 1;
  const isPayoffMonth = monthIndex === schedule.monthlyBreakdown.length - 1;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 z-40 animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div
          className="bg-card rounded-xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto pointer-events-auto animate-in slide-in-from-bottom-4 duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div>
              <h2 id="modal-title" className="text-xl font-semibold text-foreground">
                Month {absoluteMonth} of {startMonth + schedule.monthsToPayoff}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {schedule.debtName} • {monthDetails.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-elevated"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Payment Breakdown Section */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Pie Chart */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-3">Payment Breakdown</h3>
                <PieChart
                  title=""
                  data={pieChartData}
                  colors={pieChartColors}
                  className="h-48"
                />
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--color-chart-principal)]">Principal</span>
                    <span className="text-foreground font-mono">{monthDetails.principalPercent.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--color-chart-interest)]">Interest</span>
                    <span className="text-foreground font-mono">{monthDetails.interestPercent.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* Progress Ring */}
              <div className="flex flex-col items-center justify-center">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-3">Progress</h3>
                <ProgressRing
                  percentage={monthDetails.percentPaidOff}
                  size="medium"
                />
                <div className="mt-4 text-center">
                  <div className="text-2xl font-bold text-foreground">
                    {monthDetails.percentPaidOff.toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Paid Off</div>
                </div>
                {isPayoffMonth && (
                  <div className="mt-3 text-2xl">🎉</div>
                )}
              </div>
            </div>

            {/* Payment Details */}
            <div className="bg-elevated rounded-lg p-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-3">This Month's Payment</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Total Payment</div>
                  <div className="text-xl font-semibold text-foreground font-mono">
                    ${payment.paymentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Remaining Balance</div>
                  <div className="text-xl font-semibold text-foreground font-mono">
                    ${payment.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Principal</div>
                  <div className="text-xl font-semibold text-[var(--color-chart-principal)] font-mono">
                    ${payment.principalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Interest</div>
                  <div className="text-xl font-semibold text-[var(--color-chart-interest)] font-mono">
                    ${payment.interestAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>

            {/* Cumulative Totals */}
            <div className="bg-elevated rounded-lg p-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-3">Through This Month</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Total Paid</div>
                  <div className="text-lg font-semibold text-foreground font-mono">
                    ${(monthDetails.cumulativePrincipal + monthDetails.cumulativeInterest).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Principal Paid</div>
                  <div className="text-lg font-semibold text-[var(--color-chart-principal)] font-mono">
                    ${monthDetails.cumulativePrincipal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Interest Paid</div>
                  <div className="text-lg font-semibold text-[var(--color-chart-interest)] font-mono">
                    ${monthDetails.cumulativeInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>

            {/* Projection */}
            <div className="bg-accent/10 border border-accent/30 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-accent uppercase mb-2">
                {isPayoffMonth ? 'Congratulations!' : 'Remaining'}
              </h3>
              {isPayoffMonth ? (
                <p className="text-foreground">
                  This is your final payment! You've successfully paid off <span className="font-semibold">{schedule.debtName}</span>.
                  Total interest paid: <span className="font-mono font-semibold">${schedule.totalInterestPaid.toFixed(2)}</span>
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-accent/80 mb-1">Months Remaining</div>
                    <div className="text-2xl font-bold text-foreground">
                      {monthDetails.monthsRemaining}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {Math.floor(monthDetails.monthsRemaining / 12)} years, {monthDetails.monthsRemaining % 12} months
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-accent/80 mb-1">Payoff Date</div>
                    <div className="text-lg font-semibold text-foreground">
                      {schedule.payoffDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer - Navigation */}
          <div className="flex items-center justify-between p-6 border-t border-border bg-elevated">
            <button
              onClick={() => onNavigate?.('prev')}
              disabled={!canGoBack}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                canGoBack
                  ? 'bg-card text-foreground hover:bg-elevated'
                  : 'bg-card text-muted-foreground cursor-not-allowed'
              }`}
              aria-label="Previous month"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </button>

            <div className="text-sm text-muted-foreground">
              Use arrow keys to navigate
            </div>

            <button
              onClick={() => onNavigate?.('next')}
              disabled={!canGoForward}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                canGoForward
                  ? 'bg-card text-foreground hover:bg-elevated'
                  : 'bg-card text-muted-foreground cursor-not-allowed'
              }`}
              aria-label="Next month"
            >
              Next
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
