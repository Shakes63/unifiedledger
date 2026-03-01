'use client';

import { CheckCircle2, Clock, AlertCircle, SkipForward } from 'lucide-react';

interface MonthData {
  dueDate: number;
  amount: number;
  instanceId: string;
  status: 'pending' | 'paid' | 'overdue' | 'skipped';
  actualAmount?: number;
  paidDate?: string;
}

interface AnnualPlanningCellProps {
  data: MonthData | null;
  onClick?: () => void;
}

export function AnnualPlanningCell({ data, onClick }: AnnualPlanningCellProps) {
  if (!data) {
    // Empty cell - no bill due this month
    return (
      <div className="h-14 flex items-center justify-center">
        <span style={{ color: 'color-mix(in oklch, var(--color-muted-foreground) 30%, transparent)' }}>-</span>
      </div>
    );
  }

  // Determine styling based on status
  const getStatusStyles = () => {
    switch (data.status) {
      case 'paid':
        return {
          bg: 'hover:opacity-90',
          bgStyle: { backgroundColor: 'color-mix(in oklch, var(--color-income) 10%, transparent)' },
          border: 'color-mix(in oklch, var(--color-income) 30%, transparent)',
          icon: <CheckCircle2 className="w-3 h-3" style={{ color: 'var(--color-income)' }} />,
          iconTitle: 'Paid',
        };
      case 'pending':
        return {
          bg: 'hover:opacity-90',
          bgStyle: { backgroundColor: 'color-mix(in oklch, var(--color-warning) 10%, transparent)' },
          border: 'color-mix(in oklch, var(--color-warning) 30%, transparent)',
          icon: <Clock className="w-3 h-3" style={{ color: 'var(--color-warning)' }} />,
          iconTitle: 'Pending',
        };
      case 'overdue':
        return {
          bg: 'hover:opacity-90',
          bgStyle: { backgroundColor: 'color-mix(in oklch, var(--color-destructive) 10%, transparent)' },
          border: 'color-mix(in oklch, var(--color-destructive) 30%, transparent)',
          icon: <AlertCircle className="w-3 h-3" style={{ color: 'var(--color-destructive)' }} />,
          iconTitle: 'Overdue',
        };
      case 'skipped':
        return {
          bg: 'hover:opacity-90',
          bgStyle: { backgroundColor: 'color-mix(in oklch, var(--color-muted-foreground) 30%, transparent)' },
          border: 'color-mix(in oklch, var(--color-muted-foreground) 20%, transparent)',
          icon: <SkipForward className="w-3 h-3" style={{ color: 'var(--color-muted-foreground)' }} />,
          iconTitle: 'Skipped',
        };
      default:
        return {
          bg: 'hover:bg-[var(--color-elevated)]',
          bgStyle: { backgroundColor: 'var(--color-background)' } as React.CSSProperties,
          border: 'var(--color-border)',
          icon: null,
          iconTitle: '',
        };
    }
  };

  const styles = getStatusStyles();

  // Format the due date suffix (1st, 2nd, 3rd, etc.)
  const getDueDateSuffix = (day: number) => {
    if (day >= 11 && day <= 13) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  // Display actual amount if paid and different from expected
  const displayAmount = data.status === 'paid' && data.actualAmount
    ? data.actualAmount
    : data.amount;

  return (
    <button
      onClick={onClick}
      className={`
        w-full h-14 flex flex-col items-center justify-center gap-0.5 p-1
        rounded-lg border transition-colors cursor-pointer
        ${styles.bg}
      `}
      style={{
        ...(styles.bgStyle || {}),
        borderColor: styles.border,
      }}
      title={`${styles.iconTitle} - Due: ${data.dueDate}${getDueDateSuffix(data.dueDate)} - $${displayAmount.toFixed(2)}`}
    >
      {/* Status Icon */}
      <div className="flex items-center gap-1">
        {styles.icon}
        <span className="text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>
          {data.dueDate}{getDueDateSuffix(data.dueDate)}
        </span>
      </div>
      
      {/* Amount */}
      <span className="font-mono text-xs font-medium" style={{ color: 'var(--color-foreground)' }}>
        ${displayAmount >= 1000 ? `${(displayAmount / 1000).toFixed(1)}k` : displayAmount.toFixed(0)}
      </span>
    </button>
  );
}

