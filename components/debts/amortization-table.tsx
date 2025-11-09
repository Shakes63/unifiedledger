'use client';

import { useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
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

    schedule.monthlyBreakdown.forEach((payment, index) => {
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
    <div className={`bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📋</span>
            <h3 className="text-lg font-semibold text-white">Payment Schedule</h3>
            <span className="text-sm text-[#808080]">
              ({schedule.monthlyBreakdown.length} payments)
            </span>
          </div>
          <div className="text-sm text-[#808080]">
            Total Interest: <span className="text-[#f87171] font-mono font-semibold">${schedule.totalInterestPaid.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="relative">
        {/* Sticky Column Headers */}
        <div className="sticky top-0 z-10 bg-[#242424] border-b border-[#2a2a2a]">
          <div className="grid grid-cols-5 gap-4 px-6 py-3 text-xs font-semibold text-[#808080] uppercase">
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
                      ? 'bg-gradient-to-r from-[#10b981]/20 to-transparent border-l-4 border-[#10b981]'
                      : virtualRow.index % 2 === 0
                      ? 'bg-[#1a1a1a]'
                      : 'bg-[#0a0a0a]/50'
                    }
                    hover:bg-[#242424] cursor-pointer transition-colors
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
                      <span className="text-white font-medium">
                        Month {monthNumber}
                      </span>
                      {isLastPayment && highlightPayoffMonth && (
                        <span className="text-lg" title="Debt paid off!">
                          🎉
                        </span>
                      )}
                    </div>

                    {/* Payment Amount */}
                    <div className="text-right">
                      <span className="text-white font-mono">
                        ${payment.paymentAmount.toFixed(2)}
                      </span>
                    </div>

                    {/* Principal Amount */}
                    <div className="text-right">
                      <span className="text-[#10b981] font-mono">
                        ${payment.principalAmount.toFixed(2)}
                      </span>
                      <div className="text-xs text-[#808080] mt-0.5">
                        {cumulative.percentPaid.toFixed(1)}% paid
                      </div>
                    </div>

                    {/* Interest Amount */}
                    <div className="text-right">
                      <span className="text-[#f87171] font-mono">
                        ${payment.interestAmount.toFixed(2)}
                      </span>
                      <div className="text-xs text-[#808080] mt-0.5">
                        {((payment.interestAmount / payment.paymentAmount) * 100).toFixed(1)}%
                      </div>
                    </div>

                    {/* Remaining Balance */}
                    <div className="text-right">
                      <span className={`font-mono ${
                        payment.remainingBalance === 0
                          ? 'text-[#10b981] font-semibold'
                          : 'text-white'
                      }`}>
                        ${payment.remainingBalance.toFixed(2)}
                      </span>
                      {isLastPayment && (
                        <div className="text-xs text-[#10b981] font-semibold mt-0.5 uppercase">
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
      <div className="border-t border-[#2a2a2a] bg-[#242424] px-6 py-4">
        <div className="grid grid-cols-5 gap-4 text-sm">
          <div className="font-semibold text-[#808080]">Totals</div>
          <div className="text-right">
            <span className="text-white font-mono font-semibold">
              ${(schedule.originalBalance + schedule.totalInterestPaid).toFixed(2)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[#10b981] font-mono font-semibold">
              ${schedule.originalBalance.toFixed(2)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[#f87171] font-mono font-semibold">
              ${schedule.totalInterestPaid.toFixed(2)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-white font-mono font-semibold">$0.00</span>
          </div>
        </div>
      </div>
    </div>
  );
}
