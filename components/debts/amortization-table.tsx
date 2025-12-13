'use client';

import { useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ClipboardList, PartyPopper } from 'lucide-react';
import type { DebtPayoffSchedule } from '@/lib/debts/payoff-calculator';

interface AmortizationTableProps {
  schedule: DebtPayoffSchedule;
  startMonth?: number;
  highlightPayoffMonth?: boolean;
  onMonthClick?: (monthIndex: number) => void;
  className?: string;
}

export function AmortizationTable({
  schedule,
  startMonth = 0,
  highlightPayoffMonth = true,
  onMonthClick,
  className = '',
}: AmortizationTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Virtual scrolling setup
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: schedule.monthlyBreakdown.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56, // Row height in pixels
    overscan: 10, // Buffer rows for smoother scrolling
  });

  // Calculate cumulative totals for tooltips
  const cumulativeTotals = useMemo(() => {
    const totals: {
      principalPaid: number;
      interestPaid: number;
      percentPaid: number;
    }[] = [];

    let cumulativePrincipal = 0;
    let cumulativeInterest = 0;

    schedule.monthlyBreakdown.forEach((payment, _index) => {
      cumulativePrincipal += payment.principalAmount;
      cumulativeInterest += payment.interestAmount;
      const percentPaid = (cumulativePrincipal / schedule.originalBalance) * 100;

      totals.push({
        principalPaid: cumulativePrincipal,
        interestPaid: cumulativeInterest,
        percentPaid,
      });
    });

    return totals;
  }, [schedule.monthlyBreakdown, schedule.originalBalance]);

  const handleRowClick = (monthIndex: number) => {
    if (onMonthClick) {
      onMonthClick(monthIndex);
    }
  };

  const isPayoffMonth = (index: number) => {
    return index === schedule.monthlyBreakdown.length - 1;
  };

  return (
    <div className={`bg-card rounded-xl border border-border overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-foreground" />
            <h3 className="text-lg font-semibold text-foreground">Payment Schedule</h3>
            <span className="text-sm text-muted-foreground">
              ({schedule.monthlyBreakdown.length} payments)
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            Total Interest: <span className="text-(--color-chart-interest) font-mono font-semibold">${schedule.totalInterestPaid.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="relative">
        {/* Sticky Column Headers */}
        <div className="sticky top-0 z-10 bg-elevated border-b border-border">
          <div className="grid grid-cols-5 gap-4 px-6 py-3 text-xs font-semibold text-muted-foreground uppercase">
            <div>Month</div>
            <div className="text-right">Payment</div>
            <div className="text-right">Principal</div>
            <div className="text-right">Interest</div>
            <div className="text-right">Balance</div>
          </div>
        </div>

        {/* Virtualized Table Body */}
        <div
          ref={parentRef}
          className="overflow-auto"
          style={{ height: '500px' }}
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const payment = schedule.monthlyBreakdown[virtualRow.index];
              const monthNumber = startMonth + virtualRow.index + 1;
              const isLastPayment = isPayoffMonth(virtualRow.index);
              const cumulative = cumulativeTotals[virtualRow.index];

              return (
                <div
                  key={virtualRow.index}
                  className={`
                    absolute top-0 left-0 w-full
                    ${isLastPayment && highlightPayoffMonth
                      ? 'bg-gradient-to-r from-(--color-chart-principal)/20 to-transparent border-l-4 border-(--color-chart-principal)'
                      : virtualRow.index % 2 === 0
                      ? 'bg-card'
                      : 'bg-background/50'
                    }
                    hover:bg-elevated cursor-pointer transition-colors
                  `}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  onClick={() => handleRowClick(virtualRow.index)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleRowClick(virtualRow.index);
                    }
                  }}
                  aria-label={`Payment ${monthNumber}: ${payment.paymentAmount.toFixed(2)} dollars`}
                >
                  <div className="grid grid-cols-5 gap-4 px-6 py-4 items-center h-full">
                    {/* Month Number */}
                    <div className="flex items-center gap-2">
                      <span className="text-foreground font-medium">
                        Month {monthNumber}
                      </span>
                      {isLastPayment && highlightPayoffMonth && (
                        <PartyPopper className="w-5 h-5 text-(--color-chart-principal)" aria-label="Debt paid off!" />
                      )}
                    </div>

                    {/* Payment Amount */}
                    <div className="text-right">
                      <span className="text-foreground font-mono">
                        ${payment.paymentAmount.toFixed(2)}
                      </span>
                    </div>

                    {/* Principal Amount */}
                    <div className="text-right">
                      <span className="text-(--color-chart-principal) font-mono">
                        ${payment.principalAmount.toFixed(2)}
                      </span>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {cumulative.percentPaid.toFixed(1)}% paid
                      </div>
                    </div>

                    {/* Interest Amount */}
                    <div className="text-right">
                      <span className="text-(--color-chart-interest) font-mono">
                        ${payment.interestAmount.toFixed(2)}
                      </span>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {((payment.interestAmount / payment.paymentAmount) * 100).toFixed(1)}%
                      </div>
                    </div>

                    {/* Remaining Balance */}
                    <div className="text-right">
                      <span className={`font-mono ${
                        payment.remainingBalance === 0
                          ? 'text-(--color-chart-principal) font-semibold'
                          : 'text-foreground'
                      }`}>
                        ${payment.remainingBalance.toFixed(2)}
                      </span>
                      {isLastPayment && (
                        <div className="text-xs text-(--color-chart-principal) font-semibold mt-0.5 uppercase">
                          Paid Off
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Summary Footer */}
      <div className="border-t border-border bg-elevated px-6 py-4">
        <div className="grid grid-cols-5 gap-4 text-sm">
          <div className="font-semibold text-muted-foreground">Totals</div>
          <div className="text-right">
            <span className="text-foreground font-mono font-semibold">
              ${(schedule.originalBalance + schedule.totalInterestPaid).toFixed(2)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-(--color-chart-principal) font-mono font-semibold">
              ${schedule.originalBalance.toFixed(2)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-(--color-chart-interest) font-mono font-semibold">
              ${schedule.totalInterestPaid.toFixed(2)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-foreground font-mono font-semibold">$0.00</span>
          </div>
        </div>
      </div>
    </div>
  );
}
