'use client';

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
  const maxMonths = Math.max(...strategy.schedules.map(s => s.monthsToPayoff), 1);

  // Calculate cumulative timeline
  let cumulativeMonths = 0;
  const timelineData = strategy.schedules.map((schedule, index) => {
    const startMonth = cumulativeMonths;
    cumulativeMonths += schedule.monthsToPayoff;
    return {
      ...schedule,
      startMonth,
      endMonth: cumulativeMonths,
      color: COLORS[index % COLORS.length],
    };
  });

  // Calculate milestone positions (25%, 50%, 75%, 100%)
  const milestones = [
    { percent: 25, month: Math.round(cumulativeMonths * 0.25) },
    { percent: 50, month: Math.round(cumulativeMonths * 0.50) },
    { percent: 75, month: Math.round(cumulativeMonths * 0.75) },
    { percent: 100, month: cumulativeMonths },
  ];

  return (
    <div className={className}>
      {/* Timeline Chart */}
      <div className="bg-card rounded-xl p-6 border border-border mb-6">
        <div className="flex items-center gap-2 mb-6">
          <span className="text-2xl">📅</span>
          <h3 className="text-lg font-semibold text-foreground">Payoff Timeline</h3>
        </div>

        {/* Timeline bars */}
        <div className="space-y-3 mb-6">
          {timelineData.map((debt, index) => (
            <div key={debt.debtId} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-foreground font-medium">{debt.debtName}</span>
                <span className="text-muted-foreground">{debt.monthsToPayoff} months</span>
              </div>
              <div className="relative h-8 bg-elevated rounded-lg overflow-hidden">
                <div
                  className="absolute h-full rounded-lg flex items-center justify-center text-xs font-semibold text-[var(--color-card)] transition-all"
                  style={{
                    backgroundColor: debt.color,
                    width: `${(debt.monthsToPayoff / cumulativeMonths) * 100}%`,
                    left: `${(debt.startMonth / cumulativeMonths) * 100}%`,
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
            <div className="w-full h-px bg-border"></div>
          </div>
          {milestones.map((milestone) => (
            <div
              key={milestone.percent}
              className="absolute top-0 flex flex-col items-center"
              style={{ left: `${(milestone.month / cumulativeMonths) * 100}%` }}
            >
              <div className="w-2 h-2 bg-[var(--color-chart-principal)] rounded-full mb-1"></div>
              <div className="text-xs text-[var(--color-chart-principal)] font-semibold whitespace-nowrap">
                {milestone.percent}%
              </div>
            </div>
          ))}
        </div>

        {/* Timeline scale */}
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>Month 0</span>
          <span>Month {cumulativeMonths}</span>
        </div>
      </div>

      {/* Monthly Breakdown Table */}
      <div className="bg-card rounded-xl p-6 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">📋</span>
          <h3 className="text-lg font-semibold text-foreground">Payment Schedule</h3>
        </div>

        <div className="space-y-6 max-h-96 overflow-y-auto">
          {strategy.schedules.map((schedule, debtIndex) => (
            <div key={schedule.debtId} className="space-y-2">
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: timelineData[debtIndex].color }}
                ></div>
                <h4 className="text-foreground font-semibold">{schedule.debtName}</h4>
                <span className="text-xs text-muted-foreground">
                  ({schedule.monthsToPayoff} months)
                </span>
              </div>

              {/* Show first 3 and last payment */}
              {schedule.monthlyBreakdown.slice(0, 3).map((payment, monthIndex) => (
                <div
                  key={monthIndex}
                  className="grid grid-cols-4 gap-2 text-sm py-2 px-3 bg-elevated rounded-lg"
                >
                  <div className="text-muted-foreground">
                    Month {timelineData[debtIndex].startMonth + monthIndex + 1}
                  </div>
                  <div className="text-foreground font-mono text-right">
                    ${payment.paymentAmount.toFixed(2)}
                  </div>
                  <div className="text-[var(--color-chart-principal)] font-mono text-right">
                    -${payment.principalAmount.toFixed(2)}
                  </div>
                  <div className="text-[var(--color-chart-interest)] font-mono text-right">
                    ${payment.interestAmount.toFixed(2)}
                  </div>
                </div>
              ))}

              {schedule.monthlyBreakdown.length > 4 && (
                <div className="text-center text-xs text-muted-foreground py-1">
                  ... {schedule.monthlyBreakdown.length - 4} more months ...
                </div>
              )}

              {schedule.monthlyBreakdown.length > 3 && (
                <div
                  className="grid grid-cols-4 gap-2 text-sm py-2 px-3 bg-elevated rounded-lg"
                >
                  <div className="text-muted-foreground">
                    Month {timelineData[debtIndex].endMonth}
                  </div>
                  <div className="text-foreground font-mono text-right">
                    ${schedule.monthlyBreakdown[schedule.monthlyBreakdown.length - 1].paymentAmount.toFixed(2)}
                  </div>
                  <div className="text-[var(--color-chart-principal)] font-mono text-right">
                    -${schedule.monthlyBreakdown[schedule.monthlyBreakdown.length - 1].principalAmount.toFixed(2)}
                  </div>
                  <div className="text-[var(--color-chart-interest)] font-mono text-right">
                    ${schedule.monthlyBreakdown[schedule.monthlyBreakdown.length - 1].interestAmount.toFixed(2)}
                  </div>
                </div>
              )}

              {/* Summary for this debt */}
              <div className="grid grid-cols-4 gap-2 text-xs pt-2 border-t border-border">
                <div className="text-muted-foreground">Total</div>
                <div className="text-foreground font-mono font-semibold text-right">
                  ${(schedule.originalBalance + schedule.totalInterestPaid).toFixed(2)}
                </div>
                <div className="text-[var(--color-chart-principal)] font-mono font-semibold text-right">
                  -${schedule.originalBalance.toFixed(2)}
                </div>
                <div className="text-[var(--color-chart-interest)] font-mono font-semibold text-right">
                  ${schedule.totalInterestPaid.toFixed(2)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Column headers (sticky at top) */}
        <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground uppercase px-3 py-2 bg-card sticky top-0 -mt-4 mb-2">
          <div>Period</div>
          <div className="text-right">Payment</div>
          <div className="text-right">Principal</div>
          <div className="text-right">Interest</div>
        </div>
      </div>
    </div>
  );
}
