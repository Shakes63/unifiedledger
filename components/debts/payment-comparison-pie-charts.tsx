'use client';

import { useMemo } from 'react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { Lightbulb, AlertTriangle, PartyPopper, Scale } from 'lucide-react';
import type { DebtPayoffSchedule } from '@/lib/debts/payoff-calculator';

interface PaymentComparisonPieChartsProps {
  schedule: DebtPayoffSchedule;
  className?: string;
}

interface PaymentStageData {
  stage: 'first' | 'midpoint' | 'last';
  label: string;
  monthNumber: number;
  principal: number;
  interest: number;
  principalPercent: number;
  interestPercent: number;
  payment: number;
}

const COLORS = {
  principal: 'var(--color-chart-principal)',
  interest: 'var(--color-chart-interest)',
};

// Custom label renderer for pie chart
const renderCustomLabel = (props: any) => {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      className="text-sm font-bold"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

// Custom tooltip
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-semibold text-foreground mb-1">
          {payload[0].name}
        </p>
        <p className="text-sm text-muted-foreground font-mono">
          ${payload[0].value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {((payload[0].value / payload[0].payload.total) * 100).toFixed(1)}% of payment
        </p>
      </div>
    );
  }
  return null;
};

export function PaymentComparisonPieCharts({
  schedule,
  className = '',
}: PaymentComparisonPieChartsProps) {
  // Calculate payment data for first, midpoint, and last payments
  const paymentStages = useMemo((): PaymentStageData[] => {
    if (!schedule || !schedule.monthlyBreakdown?.length) {
      return [];
    }

    const breakdown = schedule.monthlyBreakdown;
    const midpointIndex = Math.floor(breakdown.length / 2);
    const lastIndex = breakdown.length - 1;

    const stages: Array<{ stage: 'first' | 'midpoint' | 'last'; index: number; label: string }> = [
      { stage: 'first', index: 0, label: 'First Payment' },
      { stage: 'midpoint', index: midpointIndex, label: 'Midpoint Payment' },
      { stage: 'last', index: lastIndex, label: 'Final Payment' },
    ];

    return stages.map(({ stage, index, label }) => {
      const payment = breakdown[index];
      const total = payment.paymentAmount;
      const principalPercent = (payment.principalAmount / total) * 100;
      const interestPercent = (payment.interestAmount / total) * 100;

      return {
        stage,
        label,
        monthNumber: index + 1,
        principal: payment.principalAmount,
        interest: payment.interestAmount,
        principalPercent,
        interestPercent,
        payment: total,
      };
    });
  }, [schedule]);

  if (!schedule || !schedule.monthlyBreakdown?.length) {
    return (
      <div className={`text-center p-8 ${className}`}>
        <p className="text-muted-foreground">No payment data available</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Payment Composition Over Time
        </h3>
        <p className="text-sm text-muted-foreground">
          See how the split between principal and interest changes from your first payment to your last
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paymentStages.map((stage) => {
          const chartData = [
            {
              name: 'Principal',
              value: parseFloat(stage.principal.toFixed(2)),
              total: stage.payment,
            },
            {
              name: 'Interest',
              value: parseFloat(stage.interest.toFixed(2)),
              total: stage.payment,
            },
          ];

          return (
            <div
              key={stage.stage}
              className="bg-card border border-border rounded-xl p-6 hover:bg-elevated transition-colors"
            >
              {/* Header */}
              <div className="text-center mb-4">
                <h4 className="text-base font-semibold text-foreground mb-1">
                  {stage.label}
                </h4>
                <p className="text-xs text-muted-foreground">
                  Month {stage.monthNumber} of {schedule.monthsToPayoff}
                </p>
              </div>

              {/* Pie Chart */}
              <ResponsiveContainer width="100%" height={200}>
                <RechartsPieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomLabel}
                    outerRadius={70}
                    fill="#8884d8"
                    dataKey="value"
                    isAnimationActive={true}
                  >
                    <Cell fill={COLORS.principal} />
                    <Cell fill={COLORS.interest} />
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </RechartsPieChart>
              </ResponsiveContainer>

              {/* Stats */}
              <div className="mt-4 space-y-3">
                {/* Payment Amount */}
                <div className="text-center pb-3 border-b border-border">
                  <div className="text-xs text-muted-foreground uppercase mb-1">
                    Payment Amount
                  </div>
                  <div className="text-lg font-bold text-foreground font-mono">
                    ${stage.payment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                {/* Principal */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS.principal }}
                    />
                    <span className="text-sm text-muted-foreground">Principal</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-foreground font-mono">
                      ${stage.principal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {stage.principalPercent.toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Interest */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS.interest }}
                    />
                    <span className="text-sm text-muted-foreground">Interest</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-foreground font-mono">
                      ${stage.interest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {stage.interestPercent.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Insight Badge */}
              <div className="mt-4 text-center">
                {stage.stage === 'first' && stage.interestPercent > 50 && (
                  <div className="inline-flex items-center gap-1 px-3 py-1 bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 rounded-full">
                    <AlertTriangle className="w-3 h-3 text-[var(--color-warning)]" />
                    <span className="text-xs text-[var(--color-warning)]">
                      Most interest paid early
                    </span>
                  </div>
                )}
                {stage.stage === 'last' && stage.principalPercent > 90 && (
                  <div className="inline-flex items-center gap-1 px-3 py-1 bg-[var(--color-success)]/10 border border-[var(--color-success)]/30 rounded-full">
                    <PartyPopper className="w-3 h-3 text-[var(--color-success)]" />
                    <span className="text-xs text-[var(--color-success)]">
                      Almost all principal
                    </span>
                  </div>
                )}
                {stage.stage === 'midpoint' && (
                  <div className="inline-flex items-center gap-1 px-3 py-1 bg-accent/10 border border-accent/30 rounded-full">
                    <Scale className="w-3 h-3 text-accent" />
                    <span className="text-xs text-accent">
                      Balanced split
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Key Insight */}
      <div className="mt-6 p-4 bg-accent/10 border border-accent/30 rounded-lg">
        <div className="flex items-start gap-3">
          <Lightbulb className="w-6 h-6 text-accent flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-accent mb-1">Key Insight</p>
            <p className="text-sm text-foreground">
              Notice how the composition changes dramatically over time.
              {paymentStages[0] && paymentStages[0].interestPercent > 50 && (
                <> Your first payment is <span className="font-semibold">{paymentStages[0].interestPercent.toFixed(0)}% interest</span>, </>
              )}
              {paymentStages[2] && paymentStages[2].principalPercent > 80 && (
                <>but your final payment is <span className="font-semibold">{paymentStages[2].principalPercent.toFixed(0)}% principal</span>. </>
              )}
              This is why making extra payments early in the loan term saves you the most money!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
