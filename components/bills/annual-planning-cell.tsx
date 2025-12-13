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
        <span className="text-muted-foreground/30">-</span>
      </div>
    );
  }

  // Determine styling based on status
  const getStatusStyles = () => {
    switch (data.status) {
      case 'paid':
        return {
          bg: 'bg-(--color-income)/10 hover:bg-(--color-income)/20',
          border: 'border-(--color-income)/30',
          icon: <CheckCircle2 className="w-3 h-3 text-(--color-income)" />,
          iconTitle: 'Paid',
        };
      case 'pending':
        return {
          bg: 'bg-(--color-warning)/10 hover:bg-(--color-warning)/20',
          border: 'border-(--color-warning)/30',
          icon: <Clock className="w-3 h-3 text-(--color-warning)" />,
          iconTitle: 'Pending',
        };
      case 'overdue':
        return {
          bg: 'bg-(--color-error)/10 hover:bg-(--color-error)/20',
          border: 'border-(--color-error)/30',
          icon: <AlertCircle className="w-3 h-3 text-(--color-error)" />,
          iconTitle: 'Overdue',
        };
      case 'skipped':
        return {
          bg: 'bg-muted/30 hover:bg-muted/50',
          border: 'border-muted-foreground/20',
          icon: <SkipForward className="w-3 h-3 text-muted-foreground" />,
          iconTitle: 'Skipped',
        };
      default:
        return {
          bg: 'bg-card hover:bg-elevated',
          border: 'border-border',
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
        ${styles.bg} ${styles.border}
      `}
      title={`${styles.iconTitle} - Due: ${data.dueDate}${getDueDateSuffix(data.dueDate)} - $${displayAmount.toFixed(2)}`}
    >
      {/* Status Icon */}
      <div className="flex items-center gap-1">
        {styles.icon}
        <span className="text-[10px] text-muted-foreground">
          {data.dueDate}{getDueDateSuffix(data.dueDate)}
        </span>
      </div>
      
      {/* Amount */}
      <span className="font-mono text-xs font-medium text-foreground">
        ${displayAmount >= 1000 ? `${(displayAmount / 1000).toFixed(1)}k` : displayAmount.toFixed(0)}
      </span>
    </button>
  );
}

