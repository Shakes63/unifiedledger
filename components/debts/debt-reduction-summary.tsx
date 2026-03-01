'use client';

import { useMemo } from 'react';
import { ProgressRing } from '@/components/ui/progress-ring';
import { PartyPopper } from 'lucide-react';
import { format } from 'date-fns';

interface SummaryData {
  totalOriginalDebt: number;
  totalCurrentDebt: number;
  totalPaid: number;
  percentageComplete: number;
  debtFreeDate: string | null;
}

interface DebtReductionSummaryProps {
  summary: SummaryData;
  isLoading?: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getProgressColor(percentage: number): 'red' | 'orange' | 'blue' | 'green' | 'gold' {
  if (percentage >= 100) return 'green';
  if (percentage >= 75) return 'blue';
  if (percentage >= 50) return 'gold';
  if (percentage >= 25) return 'orange';
  return 'red';
}

function _getProgressGradient(percentage: number) {
  if (percentage >= 100) return 'from-emerald-600 to-emerald-400';
  if (percentage >= 75) return 'from-cyan-600 to-cyan-400';
  if (percentage >= 50) return 'from-purple-600 to-purple-400';
  if (percentage >= 25) return 'from-amber-600 to-amber-400';
  return 'from-red-600 to-red-400';
}

export function DebtReductionSummary({ summary, isLoading }: DebtReductionSummaryProps) {
  const monthsRemaining = useMemo(() => {
    if (!summary.debtFreeDate) return null;
    const debtFreeDate = new Date(summary.debtFreeDate);
    const today = new Date();
    const diffTime = debtFreeDate.getTime() - today.getTime();
    const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
    return Math.max(0, diffMonths);
  }, [summary.debtFreeDate]);

  const debtFreeLabel = useMemo(() => {
    if (!summary.debtFreeDate) return 'Not calculated';
    try {
      return format(new Date(summary.debtFreeDate), 'MMM yyyy');
    } catch {
      return 'Not calculated';
    }
  }, [summary.debtFreeDate]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="p-4 rounded-lg h-32 animate-pulse"
            style={{ backgroundColor: 'var(--color-elevated)' }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Total Paid */}
      <div
        className="p-4 rounded-lg border"
        style={{
          backgroundColor: 'var(--color-background)',
          borderColor: 'var(--color-border)',
        }}
      >
        <p className="text-xs mb-2" style={{ color: 'var(--color-muted-foreground)' }}>Total Paid</p>
        <p className="text-2xl font-bold" style={{ color: 'var(--color-foreground)' }}>
          {formatCurrency(summary.totalPaid)}
        </p>
        <p className="text-xs mt-2" style={{ color: 'var(--color-muted-foreground)' }}>
          of {formatCurrency(summary.totalOriginalDebt)}
        </p>
      </div>

      {/* Progress percentage */}
      <div
        className="p-4 rounded-lg border flex flex-col items-center justify-center"
        style={{
          backgroundColor: 'var(--color-background)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="relative mb-2">
          <ProgressRing
            percentage={summary.percentageComplete}
            size="medium"
            strokeWidth={4}
            color={getProgressColor(summary.percentageComplete)}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold" style={{ color: 'var(--color-foreground)' }}>
              {Math.round(summary.percentageComplete)}%
            </span>
          </div>
        </div>
        <p className="text-xs text-center" style={{ color: 'var(--color-muted-foreground)' }}>
          Complete
        </p>
      </div>

      {/* Current debt */}
      <div
        className="p-4 rounded-lg border"
        style={{
          backgroundColor: 'var(--color-background)',
          borderColor: 'var(--color-border)',
        }}
      >
        <p className="text-xs mb-2" style={{ color: 'var(--color-muted-foreground)' }}>Remaining Debt</p>
        <p className="text-2xl font-bold" style={{ color: 'var(--color-foreground)' }}>
          {formatCurrency(summary.totalCurrentDebt)}
        </p>
        <p className="text-xs mt-2" style={{ color: 'var(--color-muted-foreground)' }}>
          {formatCurrency(summary.totalOriginalDebt - summary.totalCurrentDebt)} paid
        </p>
      </div>

      {/* Debt-free date */}
      <div
        className="p-4 rounded-lg border"
        style={{
          backgroundColor: 'var(--color-background)',
          borderColor: 'var(--color-border)',
        }}
      >
        <p className="text-xs mb-2" style={{ color: 'var(--color-muted-foreground)' }}>Debt-Free Date</p>
        <p className="text-xl font-bold" style={{ color: 'var(--color-foreground)' }}>
          {debtFreeLabel}
        </p>
        {monthsRemaining !== null && monthsRemaining > 0 && (
          <p className="text-xs mt-2" style={{ color: 'var(--color-muted-foreground)' }}>
            {monthsRemaining} month{monthsRemaining !== 1 ? 's' : ''} away
          </p>
        )}
        {monthsRemaining === 0 && (
          <p className="text-xs mt-2 font-semibold flex items-center gap-1 justify-center" style={{ color: 'var(--color-success)' }}>
            This month! <PartyPopper className="w-3 h-3" />
          </p>
        )}
      </div>
    </div>
  );
}
