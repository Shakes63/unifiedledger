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
    <div className={`rounded-xl overflow-hidden ${className}`} style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
      {/* Header */}
      <div className="p-6" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-6 h-6" style={{ color: 'var(--color-foreground)' }} />
            <h3 className="text-lg font-semibold" style={{ color: 'var(--color-foreground)' }}>Payment Schedule</h3>
            <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
              ({schedule.monthlyBreakdown.length} payments)
            </span>
          </div>
          <div className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
            Total Interest: <span className="font-mono font-semibold" style={{ color: 'var(--color-chart-interest)' }}>${schedule.totalInterestPaid.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="relative">
        {/* Sticky Column Headers */}
        <div className="sticky top-0 z-10" style={{ backgroundColor: 'var(--color-elevated)', borderBottom: '1px solid var(--color-border)' }}>
          <div className="grid grid-cols-5 gap-4 px-6 py-3 text-xs font-semibold uppercase" style={{ color: 'var(--color-muted-foreground)' }}>
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
                  className="absolute top-0 left-0 w-full cursor-pointer transition-colors"
                  style={{
                    ...(isLastPayment && highlightPayoffMonth
                      ? {
                          background: 'linear-gradient(to right, color-mix(in oklch, var(--color-chart-principal) 20%, transparent), transparent)',
                          borderLeft: '4px solid var(--color-chart-principal)',
                        }
                      : {
                          backgroundColor:
                            virtualRow.index % 2 === 0
                              ? 'var(--color-card)'
                              : 'color-mix(in oklch, var(--color-background) 50%, transparent)',
                        }),
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
                      <span className="font-medium" style={{ color: 'var(--color-foreground)' }}>
                        Month {monthNumber}
                      </span>
                      {isLastPayment && highlightPayoffMonth && (
                        <PartyPopper className="w-5 h-5" style={{ color: 'var(--color-chart-principal)' }} aria-label="Debt paid off!" />
                      )}
                    </div>

                    {/* Payment Amount */}
                    <div className="text-right">
                      <span className="font-mono" style={{ color: 'var(--color-foreground)' }}>
                        ${payment.paymentAmount.toFixed(2)}
                      </span>
                    </div>

                    {/* Principal Amount */}
                    <div className="text-right">
                      <span className="font-mono" style={{ color: 'var(--color-chart-principal)' }}>
                        ${payment.principalAmount.toFixed(2)}
                      </span>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                        {cumulative.percentPaid.toFixed(1)}% paid
                      </div>
                    </div>

                    {/* Interest Amount */}
                    <div className="text-right">
                      <span className="font-mono" style={{ color: 'var(--color-chart-interest)' }}>
                        ${payment.interestAmount.toFixed(2)}
                      </span>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                        {((payment.interestAmount / payment.paymentAmount) * 100).toFixed(1)}%
                      </div>
                    </div>

                    {/* Remaining Balance */}
                    <div className="text-right">
                      <span
                        className="font-mono"
                        style={{
                          color: payment.remainingBalance === 0 ? 'var(--color-chart-principal)' : 'var(--color-foreground)',
                          fontWeight: payment.remainingBalance === 0 ? 600 : undefined,
                        }}
                      >
                        ${payment.remainingBalance.toFixed(2)}
                      </span>
                      {isLastPayment && (
                        <div className="text-xs font-semibold mt-0.5 uppercase" style={{ color: 'var(--color-chart-principal)' }}>
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
      <div className="px-6 py-4" style={{ borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-elevated)' }}>
        <div className="grid grid-cols-5 gap-4 text-sm">
          <div className="font-semibold" style={{ color: 'var(--color-muted-foreground)' }}>Totals</div>
          <div className="text-right">
            <span className="font-mono font-semibold" style={{ color: 'var(--color-foreground)' }}>
              ${(schedule.originalBalance + schedule.totalInterestPaid).toFixed(2)}
            </span>
          </div>
          <div className="text-right">
            <span className="font-mono font-semibold" style={{ color: 'var(--color-chart-principal)' }}>
              ${schedule.originalBalance.toFixed(2)}
            </span>
          </div>
          <div className="text-right">
            <span className="font-mono font-semibold" style={{ color: 'var(--color-chart-interest)' }}>
              ${schedule.totalInterestPaid.toFixed(2)}
            </span>
          </div>
          <div className="text-right">
            <span className="font-mono font-semibold" style={{ color: 'var(--color-foreground)' }}>$0.00</span>
          </div>
        </div>
      </div>
    </div>
  );
}
