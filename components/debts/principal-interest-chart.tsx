'use client';

import { useMemo } from 'react';
import {
  ComposedChart as RechartsComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Lightbulb } from 'lucide-react';
import type { DebtPayoffSchedule } from '@/lib/debts/payoff-calculator';
import { ChartContainer } from '@/components/charts/chart-container';
import { ChartTooltip } from '@/components/charts/chart-tooltip';

interface PrincipalInterestChartProps {
  schedule: DebtPayoffSchedule;
  startMonth?: number;
  className?: string;
  height?: number;
  showBalance?: boolean;
  onMonthClick?: (monthIndex: number) => void;
}

export function PrincipalInterestChart({
  schedule,
  startMonth = 0,
  className = '',
  height = 400,
  showBalance = true,
  onMonthClick,
}: PrincipalInterestChartProps) {
  // Transform monthly breakdown data for chart
  const chartData = useMemo(() => {
    return schedule.monthlyBreakdown.map((payment, index) => ({
      month: `${startMonth + index + 1}`,
      monthNumber: startMonth + index + 1,
      principal: parseFloat(payment.principalAmount.toFixed(2)),
      interest: parseFloat(payment.interestAmount.toFixed(2)),
      balance: parseFloat(payment.remainingBalance.toFixed(2)),
      payment: parseFloat(payment.paymentAmount.toFixed(2)),
    }));
  }, [schedule.monthlyBreakdown, startMonth]);

  // Calculate key milestones (25%, 50%, 75%, 100%)
  const milestones = useMemo(() => {
    const originalBalance = schedule.originalBalance;
    const marks: { month: number; percent: number; label: string }[] = [];

    schedule.monthlyBreakdown.forEach((payment, index) => {
      const percentPaid = ((originalBalance - payment.remainingBalance) / originalBalance) * 100;

      if (percentPaid >= 25 && !marks.some(m => m.percent === 25)) {
        marks.push({ month: startMonth + index + 1, percent: 25, label: '25% Paid' });
      }
      if (percentPaid >= 50 && !marks.some(m => m.percent === 50)) {
        marks.push({ month: startMonth + index + 1, percent: 50, label: '50% Paid' });
      }
      if (percentPaid >= 75 && !marks.some(m => m.percent === 75)) {
        marks.push({ month: startMonth + index + 1, percent: 75, label: '75% Paid' });
      }
    });

    // Final payoff
    marks.push({
      month: startMonth + schedule.monthsToPayoff,
      percent: 100,
      label: 'Paid Off!',
    });

    return marks;
  }, [schedule, startMonth]);

  // Data point type for this chart
  interface ChartMonthData {
    month: string;
    monthNumber: number;
    principal: number;
    interest: number;
    balance: number;
    payment: number;
  }

  // Chart click event data type
  interface ChartClickData {
    activePayload?: Array<{
      payload: ChartMonthData;
    }>;
  }

  // Handle chart click
  const handleChartClick = (data: ChartClickData | null) => {
    if (data && data.activePayload && data.activePayload[0] && onMonthClick) {
      const monthNumber = data.activePayload[0].payload.monthNumber;
      const monthIndex = monthNumber - startMonth - 1;
      onMonthClick(monthIndex);
    }
  };

  // Format tick labels - show every Nth month based on total months
  const tickFormatter = (value: string) => {
    const totalMonths = schedule.monthlyBreakdown.length;

    // Show fewer labels for longer schedules
    if (totalMonths > 120) {
      // Show every 24 months for 10+ year schedules
      return parseInt(value) % 24 === 1 ? `Mo ${value}` : '';
    } else if (totalMonths > 60) {
      // Show every 12 months for 5+ year schedules
      return parseInt(value) % 12 === 1 ? `Mo ${value}` : '';
    } else if (totalMonths > 24) {
      // Show every 6 months for 2+ year schedules
      return parseInt(value) % 6 === 1 ? `Mo ${value}` : '';
    }
    // Show every month for short schedules
    return `Mo ${value}`;
  };

  return (
    <ChartContainer
      title="Principal vs Interest Breakdown"
      description="See how your payments split between principal and interest over time"
      className={className}
    >
      <ResponsiveContainer width="100%" height={height}>
        <RechartsComposedChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          onClick={handleChartClick as (data: unknown) => void}
        >
          <defs>
            {/* Gradient for principal */}
            <linearGradient id="principalGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-chart-principal)" stopOpacity={0.8} />
              <stop offset="95%" stopColor="var(--color-chart-principal)" stopOpacity={0.3} />
            </linearGradient>
            {/* Gradient for interest */}
            <linearGradient id="interestGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-chart-interest)" stopOpacity={0.8} />
              <stop offset="95%" stopColor="var(--color-chart-interest)" stopOpacity={0.3} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />

          <XAxis
            dataKey="month"
            stroke="var(--muted-foreground)"
            style={{ fontSize: '11px' }}
            tickFormatter={tickFormatter}
            interval="preserveStartEnd"
          />

          <YAxis
            stroke="var(--muted-foreground)"
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => `$${value.toLocaleString()}`}
          />

          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--elevated)', opacity: 0.3 }} />

          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="square"
          />

          {/* Stacked bars for Principal and Interest */}
          <Bar
            dataKey="principal"
            stackId="payment"
            fill="url(#principalGradient)"
            name="Principal"
            isAnimationActive={true}
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="interest"
            stackId="payment"
            fill="url(#interestGradient)"
            name="Interest"
            isAnimationActive={true}
            radius={[4, 4, 0, 0]}
          />

          {/* Balance line overlay */}
          {showBalance && (
            <Line
              type="monotone"
              dataKey="balance"
              stroke="var(--color-transfer)"
              name="Remaining Balance"
              strokeWidth={2}
              dot={false}
              isAnimationActive={true}
            />
          )}

          {/* Milestone reference lines */}
          {milestones.map((milestone, index) => (
            <ReferenceLine
              key={index}
              x={milestone.month.toString()}
              stroke={milestone.percent === 100 ? 'var(--color-chart-principal)' : 'var(--color-primary)'}
              strokeDasharray="3 3"
              strokeWidth={2}
              label={{
                value: milestone.label,
                position: 'top',
                fill: milestone.percent === 100 ? 'var(--color-chart-principal)' : 'var(--color-primary)',
                fontSize: 12,
                fontWeight: 'bold',
              }}
            />
          ))}
        </RechartsComposedChart>
      </ResponsiveContainer>

      {/* Chart Legend/Summary */}
      <div className="grid grid-cols-3 gap-4 mt-6 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)' }}>
        <div>
          <div className="text-xs uppercase mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Total Principal</div>
          <div className="text-lg font-semibold text-chart-principal font-mono">
            ${schedule.originalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Total Interest</div>
          <div className="text-lg font-semibold text-chart-interest font-mono">
            ${schedule.totalInterestPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Total Paid</div>
          <div className="text-lg font-semibold font-mono" style={{ color: 'var(--color-foreground)' }}>
            ${(schedule.originalBalance + schedule.totalInterestPaid).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Insight */}
      <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: 'color-mix(in oklch, var(--color-accent) 10%, transparent)', border: '1px solid color-mix(in oklch, var(--color-accent) 30%, transparent)' }}>
        <div className="flex items-start gap-2 text-sm" style={{ color: 'var(--color-accent)' }}>
          <Lightbulb className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Insight:</span>{' '}
            {schedule.monthlyBreakdown.length > 0 && (
              <>
                Your first payment is{' '}
                <span className="font-semibold">
                  {((schedule.monthlyBreakdown[0].interestAmount / schedule.monthlyBreakdown[0].paymentAmount) * 100).toFixed(1)}% interest
                </span>
                {schedule.monthlyBreakdown.length > 1 && (
                  <>
                    , but your last payment is only{' '}
                    <span className="font-semibold">
                      {((schedule.monthlyBreakdown[schedule.monthlyBreakdown.length - 1].interestAmount / schedule.monthlyBreakdown[schedule.monthlyBreakdown.length - 1].paymentAmount) * 100).toFixed(1)}% interest
                    </span>
                  </>
                )}
                . Making extra payments early saves the most money!
              </>
            )}
          </div>
        </div>
      </div>
    </ChartContainer>
  );
}
