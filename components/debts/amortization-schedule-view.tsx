'use client';

import { useState } from 'react';
import { Calendar, ClipboardList, BarChart3, Lightbulb, CreditCard } from 'lucide-react';
import type { PayoffStrategyResult } from '@/lib/debts/payoff-calculator';
import { PayoffTimeline } from './payoff-timeline';
import { AmortizationTable } from './amortization-table';
import { PrincipalInterestChart } from './principal-interest-chart';
import { MonthDetailModal } from './month-detail-modal';

interface AmortizationScheduleViewProps {
  strategy: PayoffStrategyResult;
  className?: string;
}

type ViewMode = 'overview' | 'table' | 'chart';

export function AmortizationScheduleView({
  strategy,
  className = '',
}: AmortizationScheduleViewProps) {
  const [activeDebtIndex, setActiveDebtIndex] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [view, setView] = useState<ViewMode>('overview');

  // Get currently selected debt's schedule
  const activeSchedule = strategy.schedules[activeDebtIndex];
  const hasMultipleDebts = strategy.schedules.length > 1;

  // Calculate start month for each debt (cumulative)
  const getStartMonth = (index: number): number => {
    let total = 0;
    for (let i = 0; i < index; i++) {
      total += strategy.schedules[i].monthsToPayoff;
    }
    return total;
  };

  const startMonth = getStartMonth(activeDebtIndex);

  // Month navigation handlers
  const handleMonthClick = (monthIndex: number) => {
    setSelectedMonth(monthIndex);
  };

  const handleModalNavigate = (direction: 'prev' | 'next') => {
    if (selectedMonth === null) return;

    if (direction === 'prev' && selectedMonth > 0) {
      setSelectedMonth(selectedMonth - 1);
    } else if (direction === 'next' && selectedMonth < activeSchedule.monthlyBreakdown.length - 1) {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const handleModalClose = () => {
    setSelectedMonth(null);
  };

  return (
    <div className={className}>
      {/* Debt Selector (if multiple debts) */}
      {hasMultipleDebts && (
        <div className="mb-6 bg-card rounded-xl border border-border p-4">
          <label className="block text-sm font-semibold text-muted-foreground uppercase mb-3">
            Select Debt
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {strategy.schedules.map((schedule, index) => {
              const payoffOrder = strategy.payoffOrder[index];
              const isActive = activeDebtIndex === index;

              return (
                <button
                  key={schedule.debtId}
                  onClick={() => setActiveDebtIndex(index)}
                  className={`
                    p-3 rounded-lg border transition-all text-left
                    ${isActive
                      ? 'bg-accent/20 border-accent ring-2 ring-accent/50'
                      : 'bg-elevated border-border hover:bg-[var(--border)]/20'
                    }
                  `}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground">
                      #{payoffOrder.order}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-foreground truncate">
                    {schedule.debtName}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    ${schedule.originalBalance.toLocaleString()} • {schedule.monthsToPayoff}mo
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* View Tabs */}
      <div className="mb-6 bg-card rounded-xl border border-border p-2">
        <div className="flex gap-2">
          <button
            onClick={() => setView('overview')}
            className={`
              flex-1 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2
              ${view === 'overview'
                ? 'bg-accent text-accent-foreground shadow-lg'
                : 'text-muted-foreground hover:text-foreground hover:bg-elevated'
              }
            `}
          >
            <Calendar className="w-4 h-4" />
            Overview
          </button>
          <button
            onClick={() => setView('table')}
            className={`
              flex-1 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2
              ${view === 'table'
                ? 'bg-accent text-accent-foreground shadow-lg'
                : 'text-muted-foreground hover:text-foreground hover:bg-elevated'
              }
            `}
          >
            <ClipboardList className="w-4 h-4" />
            Full Schedule
          </button>
          <button
            onClick={() => setView('chart')}
            className={`
              flex-1 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2
              ${view === 'chart'
                ? 'bg-accent text-accent-foreground shadow-lg'
                : 'text-muted-foreground hover:text-foreground hover:bg-elevated'
              }
            `}
          >
            <BarChart3 className="w-4 h-4" />
            Charts
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="space-y-6">
        {/* Overview Tab */}
        {view === 'overview' && (
          <div className="space-y-6">
            <PayoffTimeline strategy={strategy} />

            <div className="bg-accent/10 border border-accent/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Lightbulb className="w-6 h-6 text-accent flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold text-accent mb-1">
                    Interactive Amortization Schedule
                  </h4>
                  <p className="text-sm text-foreground">
                    Switch to <span className="font-semibold">Full Schedule</span> to see all {activeSchedule.monthlyBreakdown.length} months,
                    or view <span className="font-semibold">Charts</span> to visualize how your payments split between principal and interest over time.
                    Click any month to see detailed breakdowns and projections.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Table Tab */}
        {view === 'table' && (
          <AmortizationTable
            schedule={activeSchedule}
            startMonth={startMonth}
            onMonthClick={handleMonthClick}
          />
        )}

        {/* Chart Tab */}
        {view === 'chart' && (
          <PrincipalInterestChart
            schedule={activeSchedule}
            startMonth={startMonth}
            onMonthClick={handleMonthClick}
            height={500}
          />
        )}
      </div>

      {/* Month Detail Modal */}
      {selectedMonth !== null && (
        <MonthDetailModal
          schedule={activeSchedule}
          monthIndex={selectedMonth}
          startMonth={startMonth}
          onClose={handleModalClose}
          onNavigate={handleModalNavigate}
        />
      )}
    </div>
  );
}
