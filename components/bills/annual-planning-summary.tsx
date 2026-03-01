'use client';

import { DollarSign, Calendar, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import Decimal from 'decimal.js';

interface MonthlySummary {
  total: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
}

interface NextDue {
  billId: string;
  billName: string;
  dueDate: string;
  amount: number;
  instanceId: string;
}

interface Summary {
  totalAnnualAmount: number;
  monthlyBreakdown: Record<string, MonthlySummary>;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  totalInstances: number;
  nextDue: NextDue | null;
}

interface AnnualPlanningSummaryProps {
  summary: Summary;
  year: number;
}

export function AnnualPlanningSummary({ summary, year }: AnnualPlanningSummaryProps) {
  const totalInstances = summary.paidCount + summary.pendingCount + summary.overdueCount;
  const progressPercentage = totalInstances > 0 
    ? Math.round((summary.paidCount / totalInstances) * 100) 
    : 0;

  // Calculate average monthly amount
  const monthsWithBills = Object.values(summary.monthlyBreakdown).filter(m => m.total > 0).length;
  const averageMonthly = monthsWithBills > 0 
    ? new Decimal(summary.totalAnnualAmount).div(monthsWithBills).toNumber() 
    : 0;

  // Format next due date
  const formatNextDue = () => {
    if (!summary.nextDue) return null;
    try {
      const date = parseISO(summary.nextDue.dueDate);
      return format(date, 'MMM d');
    } catch {
      return summary.nextDue.dueDate;
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Annual Amount */}
      <Card className="border" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--color-muted-foreground)' }}>
            <DollarSign className="w-4 h-4" />
            Total Annual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold font-mono" style={{ color: 'var(--color-primary)' }}>
            ${summary.totalAnnualAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
            ~${averageMonthly.toFixed(0)}/month average
          </p>
        </CardContent>
      </Card>

      {/* Progress */}
      <Card className="border" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--color-muted-foreground)' }}>
            <CheckCircle2 className="w-4 h-4" />
            Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold" style={{ color: 'var(--color-income)' }}>
              {summary.paidCount}
            </span>
            <span style={{ color: 'var(--color-muted-foreground)' }}>/</span>
            <span className="text-lg" style={{ color: 'var(--color-muted-foreground)' }}>
              {totalInstances}
            </span>
            <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
              ({progressPercentage}%)
            </span>
          </div>
          {/* Progress Bar */}
          <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%`, backgroundColor: 'var(--color-income)' }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Status Breakdown */}
      <Card className="border" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--color-muted-foreground)' }}>
            <Clock className="w-4 h-4" />
            Status Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {/* Paid */}
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--color-income)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>{summary.paidCount}</span>
              <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Paid</span>
            </div>
            {/* Pending */}
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--color-warning)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>{summary.pendingCount}</span>
              <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Due</span>
            </div>
            {/* Overdue */}
            {summary.overdueCount > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--color-destructive)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>{summary.overdueCount}</span>
                <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Late</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Next Due */}
      <Card
        className="border"
        style={{
          backgroundColor: 'var(--color-background)',
          borderColor: summary.overdueCount > 0 ? 'color-mix(in oklch, var(--color-destructive) 30%, transparent)' : 'var(--color-border)',
        }}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--color-muted-foreground)' }}>
            {summary.overdueCount > 0 ? (
              <AlertCircle className="w-4 h-4" style={{ color: 'var(--color-destructive)' }} />
            ) : (
              <Calendar className="w-4 h-4" />
            )}
            {summary.overdueCount > 0 ? 'Attention Needed' : 'Next Due'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {summary.overdueCount > 0 ? (
            <div>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-destructive)' }}>
                {summary.overdueCount} Overdue
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                Requires immediate attention
              </p>
            </div>
          ) : summary.nextDue ? (
            <div>
              <div className="text-lg font-bold truncate" style={{ color: 'var(--color-foreground)' }} title={summary.nextDue.billName}>
                {summary.nextDue.billName}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm" style={{ color: 'var(--color-warning)' }}>
                  {formatNextDue()}
                </span>
                <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>•</span>
                <span className="text-sm font-mono" style={{ color: 'var(--color-muted-foreground)' }}>
                  ${summary.nextDue.amount.toFixed(2)}
                </span>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-lg font-medium" style={{ color: 'var(--color-muted-foreground)' }}>
                All paid for {year}!
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--color-income)' }}>
                Great job staying on top of bills
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

