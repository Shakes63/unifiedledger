'use client';

import { useMemo } from 'react';
import { Calendar, ClipboardList } from 'lucide-react';
import type { PayoffStrategyResult } from '@/lib/debts/payoff-calculator';

interface PayoffTimelineProps {
  strategy: PayoffStrategyResult;
  className?: string;
}

const COLORS = [
  '#60a5fa', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
];

export function PayoffTimeline({ strategy, className }: PayoffTimelineProps) {
  const _maxMonths = Math.max(...strategy.schedules.map(s => s.monthsToPayoff), 1);

  // Calculate cumulative timeline using useMemo with reduce (immutable pattern)
  const { timelineData, totalMonths } = useMemo(() => {
    const result = strategy.schedules.reduce<{
      data: Array<typeof strategy.schedules[0] & { startMonth: number; endMonth: number; color: string }>;
      cumulative: number;
    }>(
      (acc, schedule, index) => {
        const startMonth = acc.cumulative;
        const endMonth = acc.cumulative + schedule.monthsToPayoff;
        return {
          data: [...acc.data, {
            ...schedule,
            startMonth,
            endMonth,
            color: COLORS[index % COLORS.length],
          }],
          cumulative: endMonth,
        };
      },
      { data: [], cumulative: 0 }
    );
    return { timelineData: result.data, totalMonths: result.cumulative };
  }, [strategy]);

  // Calculate milestone positions (25%, 50%, 75%, 100%)
  const milestones = [
    { percent: 25, month: Math.round(totalMonths * 0.25) },
    { percent: 50, month: Math.round(totalMonths * 0.50) },
    { percent: 75, month: Math.round(totalMonths * 0.75) },
    { percent: 100, month: totalMonths },
  ];

  return (
    <div className={className}>
      {/* Timeline Chart */}
      <div className="rounded-xl p-6 mb-6" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-2 mb-6">
          <Calendar className="w-6 h-6" style={{ color: 'var(--color-foreground)' }} />
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-foreground)' }}>Payoff Timeline</h3>
        </div>

        {/* Timeline bars */}
        <div className="space-y-3 mb-6">
          {timelineData.map((debt, _index) => (
            <div key={debt.debtId} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium" style={{ color: 'var(--color-foreground)' }}>{debt.debtName}</span>
                <span style={{ color: 'var(--color-muted-foreground)' }}>{debt.monthsToPayoff} months</span>
              </div>
              <div className="relative h-8 rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--color-elevated)' }}>
                <div
                  className="absolute h-full rounded-lg flex items-center justify-center text-xs font-semibold transition-all"
                  style={{
                    color: 'var(--color-card)',
                    backgroundColor: debt.color,
                    width: `${(debt.monthsToPayoff / totalMonths) * 100}%`,
                    left: `${(debt.startMonth / totalMonths) * 100}%`,
                  }}
                >
                  {debt.monthsToPayoff}mo
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Milestone markers */}
        <div className="relative h-12 mt-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full h-px" style={{ backgroundColor: 'var(--color-border)' }}></div>
          </div>
          {milestones.map((milestone) => (
            <div
              key={milestone.percent}
              className="absolute top-0 flex flex-col items-center"
              style={{ left: `${(milestone.month / totalMonths) * 100}%` }}
            >
              <div className="w-2 h-2 rounded-full mb-1" style={{ backgroundColor: 'var(--color-chart-principal)' }}></div>
              <div className="text-xs font-semibold whitespace-nowrap" style={{ color: 'var(--color-chart-principal)' }}>
                {milestone.percent}%
              </div>
            </div>
          ))}
        </div>

        {/* Timeline scale */}
        <div className="flex justify-between text-xs mt-2" style={{ color: 'var(--color-muted-foreground)' }}>
          <span>Month 0</span>
          <span>Month {totalMonths}</span>
        </div>
      </div>

      {/* Monthly Breakdown Table */}
      <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList className="w-6 h-6" style={{ color: 'var(--color-foreground)' }} />
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-foreground)' }}>Payment Schedule</h3>
        </div>

        <div className="space-y-6 max-h-96 overflow-y-auto">
          {strategy.schedules.map((schedule, debtIndex) => (
            <div key={schedule.debtId} className="space-y-2">
              <div className="flex items-center gap-2 pb-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: timelineData[debtIndex].color }}
                ></div>
                <h4 className="font-semibold" style={{ color: 'var(--color-foreground)' }}>{schedule.debtName}</h4>
                <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                  ({schedule.monthsToPayoff} months)
                </span>
              </div>

              {/* Show first 3 and last payment */}
              {schedule.monthlyBreakdown.slice(0, 3).map((payment, monthIndex) => (
                <div
                  key={monthIndex}
                  className="grid grid-cols-4 gap-2 text-sm py-2 px-3 rounded-lg"
                  style={{ backgroundColor: 'var(--color-elevated)' }}
                >
                  <div style={{ color: 'var(--color-muted-foreground)' }}>
                    Month {timelineData[debtIndex].startMonth + monthIndex + 1}
                  </div>
                  <div className="font-mono text-right" style={{ color: 'var(--color-foreground)' }}>
                    ${payment.paymentAmount.toFixed(2)}
                  </div>
                  <div className="font-mono text-right" style={{ color: 'var(--color-chart-principal)' }}>
                    -${payment.principalAmount.toFixed(2)}
                  </div>
                  <div className="font-mono text-right" style={{ color: 'var(--color-chart-interest)' }}>
                    ${payment.interestAmount.toFixed(2)}
                  </div>
                </div>
              ))}

              {schedule.monthlyBreakdown.length > 4 && (
                <div className="text-center text-xs py-1" style={{ color: 'var(--color-muted-foreground)' }}>
                  ... {schedule.monthlyBreakdown.length - 4} more months ...
                </div>
              )}

              {schedule.monthlyBreakdown.length > 3 && (
                <div
                  className="grid grid-cols-4 gap-2 text-sm py-2 px-3 rounded-lg"
                  style={{ backgroundColor: 'var(--color-elevated)' }}
                >
                  <div style={{ color: 'var(--color-muted-foreground)' }}>
                    Month {timelineData[debtIndex].endMonth}
                  </div>
                  <div className="font-mono text-right" style={{ color: 'var(--color-foreground)' }}>
                    ${schedule.monthlyBreakdown[schedule.monthlyBreakdown.length - 1].paymentAmount.toFixed(2)}
                  </div>
                  <div className="font-mono text-right" style={{ color: 'var(--color-chart-principal)' }}>
                    -${schedule.monthlyBreakdown[schedule.monthlyBreakdown.length - 1].principalAmount.toFixed(2)}
                  </div>
                  <div className="font-mono text-right" style={{ color: 'var(--color-chart-interest)' }}>
                    ${schedule.monthlyBreakdown[schedule.monthlyBreakdown.length - 1].interestAmount.toFixed(2)}
                  </div>
                </div>
              )}

              {/* Summary for this debt */}
              <div className="grid grid-cols-4 gap-2 text-xs pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
                <div style={{ color: 'var(--color-muted-foreground)' }}>Total</div>
                <div className="font-mono font-semibold text-right" style={{ color: 'var(--color-foreground)' }}>
                  ${(schedule.originalBalance + schedule.totalInterestPaid).toFixed(2)}
                </div>
                <div className="font-mono font-semibold text-right" style={{ color: 'var(--color-chart-principal)' }}>
                  -${schedule.originalBalance.toFixed(2)}
                </div>
                <div className="font-mono font-semibold text-right" style={{ color: 'var(--color-chart-interest)' }}>
                  ${schedule.totalInterestPaid.toFixed(2)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Column headers (sticky at top) */}
        <div className="grid grid-cols-4 gap-2 text-xs uppercase px-3 py-2 sticky top-0 -mt-4 mb-2" style={{ color: 'var(--color-muted-foreground)', backgroundColor: 'var(--color-background)' }}>
          <div>Period</div>
          <div className="text-right">Payment</div>
          <div className="text-right">Principal</div>
          <div className="text-right">Interest</div>
        </div>
      </div>
    </div>
  );
}
