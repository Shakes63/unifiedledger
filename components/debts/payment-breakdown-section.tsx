'use client';

import { useState } from 'react';
import type { PayoffStrategyResult } from '@/lib/debts/payoff-calculator';
import { PaymentComparisonPieCharts } from './payment-comparison-pie-charts';
import { TotalCostPieChart } from './total-cost-pie-chart';
import { ChevronDown, PieChart as PieChartIcon, Lightbulb, BarChart3 } from 'lucide-react';

interface PaymentBreakdownSectionProps {
  strategy: PayoffStrategyResult;
  className?: string;
  defaultExpanded?: boolean;
}

export function PaymentBreakdownSection({
  strategy,
  className = '',
  defaultExpanded = false,
}: PaymentBreakdownSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [activeDebtIndex, setActiveDebtIndex] = useState(0);

  // Get currently selected debt's schedule
  const activeSchedule = strategy.schedules[activeDebtIndex];
  const hasMultipleDebts = strategy.schedules.length > 1;

  // Don't render if no data
  if (!strategy || !strategy.schedules || strategy.schedules.length === 0) {
    return null;
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 rounded-lg border transition-colors"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
      >
        <div className="flex items-center gap-3">
          <PieChartIcon className="w-6 h-6" style={{ color: 'var(--color-accent)' }} />
          <div className="text-left">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-foreground)' }}>
              Payment Breakdown Analysis
            </h2>
            <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
              See how your payments split between principal and interest
            </p>
          </div>
        </div>
        <ChevronDown
          size={20}
          className="transition-transform"
          style={{ color: 'var(--color-muted-foreground)', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-4 rounded-xl p-6" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
          {/* Debt Selector (if multiple debts) */}
          {hasMultipleDebts && (
            <div className="mb-8">
              <label className="block text-sm font-semibold uppercase mb-3" style={{ color: 'var(--color-muted-foreground)' }}>
                Select Debt to Analyze
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {strategy.schedules.map((schedule, index) => {
                  const payoffOrder = strategy.payoffOrder[index];
                  const isActive = activeDebtIndex === index;

                  return (
                    <button
                      key={schedule.debtId}
                      onClick={() => setActiveDebtIndex(index)}
                      className="p-3 rounded-lg border transition-all text-left"
                      style={
                        isActive
                          ? { backgroundColor: 'color-mix(in oklch, var(--color-accent) 20%, transparent)', borderColor: 'var(--color-accent)', boxShadow: '0 0 0 2px color-mix(in oklch, var(--color-accent) 50%, transparent)' }
                          : { backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }
                      }
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: payoffOrder.color || 'var(--color-accent)' }}
                        />
                        <span className="text-xs font-semibold" style={{ color: 'var(--color-muted-foreground)' }}>
                          #{payoffOrder.order}
                        </span>
                      </div>
                      <div className="text-sm font-semibold truncate mb-1" style={{ color: 'var(--color-foreground)' }}>
                        {schedule.debtName}
                      </div>
                      <div className="text-xs font-mono" style={{ color: 'var(--color-muted-foreground)' }}>
                        ${schedule.originalBalance.toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Payment Comparison Pie Charts */}
          <PaymentComparisonPieCharts
            schedule={activeSchedule}
            className="mb-8"
          />

          {/* Divider */}
          <div className="my-8" style={{ borderTop: '1px solid var(--color-border)' }} />

          {/* Total Cost Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Total Cost Pie Chart - Takes 2 columns */}
            <div className="lg:col-span-2">
              <TotalCostPieChart schedule={activeSchedule} />
            </div>

            {/* Insight Box - Takes 1 column */}
            <div className="rounded-xl p-6 flex flex-col justify-between" style={{ background: 'linear-gradient(to bottom right, color-mix(in oklch, var(--color-accent) 10%, transparent), color-mix(in oklch, var(--color-accent) 5%, transparent))', border: '1px solid color-mix(in oklch, var(--color-accent) 30%, transparent)' }}>
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Lightbulb className="w-8 h-8" style={{ color: 'var(--color-accent)' }} />
                  <h4 className="text-base font-semibold" style={{ color: 'var(--color-accent)' }}>
                    Smart Savings Tips
                  </h4>
                </div>

                <div className="space-y-4 text-sm" style={{ color: 'var(--color-foreground)' }}>
                  <div>
                    <p className="font-semibold mb-1">Pay Extra Early</p>
                    <p style={{ color: 'var(--color-muted-foreground)' }}>
                      Extra payments early in the loan have the biggest impact because
                      most of your payment goes to interest at first.
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold mb-1">Bi-Weekly Payments</p>
                    <p style={{ color: 'var(--color-muted-foreground)' }}>
                      Switching to bi-weekly payments results in 13 payments per year
                      instead of 12, shaving months or years off your payoff.
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold mb-1">Round Up Payments</p>
                    <p style={{ color: 'var(--color-muted-foreground)' }}>
                      Rounding your payment up to the nearest $50 or $100 can save
                      thousands in interest with minimal impact on your budget.
                    </p>
                  </div>

                  {activeSchedule.totalInterestPaid > 10000 && (
                    <div>
                      <p className="font-semibold mb-1">High Interest Cost</p>
                      <p style={{ color: 'var(--color-muted-foreground)' }}>
                        You&apos;ll pay over ${(activeSchedule.totalInterestPaid / 1000).toFixed(0)}k in interest.
                        Even small extra payments can make a huge difference!
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 space-y-2">
                <button
                  onClick={() => {
                    // Scroll to What-If Calculator
                    const calculator = document.querySelector('[data-section="what-if-calculator"]');
                    if (calculator) {
                      calculator.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  className="w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-primary-foreground)' }}
                >
                  Try What-If Scenarios
                </button>
                <button
                  onClick={() => {
                    // Scroll to Payoff Strategy
                    const strategy = document.querySelector('[data-section="payoff-strategy"]');
                    if (strategy) {
                      strategy.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  className="w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
                >
                  View Payoff Strategy
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Insight Banner */}
          <div className="mt-8 rounded-lg p-4" style={{ background: 'linear-gradient(to right, color-mix(in oklch, var(--color-primary) 10%, transparent), color-mix(in oklch, var(--color-primary) 5%, transparent))', border: '1px solid color-mix(in oklch, var(--color-primary) 30%, transparent)' }}>
            <div className="flex items-start gap-3">
              <BarChart3 className="w-5 h-5 mt-0.5" style={{ color: 'var(--color-primary)' }} />
              <div className="flex-1">
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-foreground)' }}>
                  Understanding Your Payments
                </p>
                <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                  These visualizations show why debt payoff accelerates over time. As you pay down
                  principal, less interest accrues each month, so more of your payment goes toward
                  the balance. This creates a snowball effect that speeds up as you get closer to
                  being debt-free!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
