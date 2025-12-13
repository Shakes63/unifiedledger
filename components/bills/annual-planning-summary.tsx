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
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Total Annual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-(--color-primary) font-mono">
            ${summary.totalAnnualAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            ~${averageMonthly.toFixed(0)}/month average
          </p>
        </CardContent>
      </Card>

      {/* Progress */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-(--color-income)">
              {summary.paidCount}
            </span>
            <span className="text-muted-foreground">/</span>
            <span className="text-lg text-muted-foreground">
              {totalInstances}
            </span>
            <span className="text-sm text-muted-foreground">
              ({progressPercentage}%)
            </span>
          </div>
          {/* Progress Bar */}
          <div className="mt-2 h-2 bg-border rounded-full overflow-hidden">
            <div 
              className="h-full bg-(--color-income) rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Status Breakdown */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Status Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {/* Paid */}
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-(--color-income)" />
              <span className="text-sm text-foreground font-medium">{summary.paidCount}</span>
              <span className="text-xs text-muted-foreground">Paid</span>
            </div>
            {/* Pending */}
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-(--color-warning)" />
              <span className="text-sm text-foreground font-medium">{summary.pendingCount}</span>
              <span className="text-xs text-muted-foreground">Due</span>
            </div>
            {/* Overdue */}
            {summary.overdueCount > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-(--color-error)" />
                <span className="text-sm text-foreground font-medium">{summary.overdueCount}</span>
                <span className="text-xs text-muted-foreground">Late</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Next Due */}
      <Card className={`bg-card border-border ${summary.overdueCount > 0 ? 'border-(--color-error)/30' : ''}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            {summary.overdueCount > 0 ? (
              <AlertCircle className="w-4 h-4 text-(--color-error)" />
            ) : (
              <Calendar className="w-4 h-4" />
            )}
            {summary.overdueCount > 0 ? 'Attention Needed' : 'Next Due'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {summary.overdueCount > 0 ? (
            <div>
              <div className="text-2xl font-bold text-(--color-error)">
                {summary.overdueCount} Overdue
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Requires immediate attention
              </p>
            </div>
          ) : summary.nextDue ? (
            <div>
              <div className="text-lg font-bold text-foreground truncate" title={summary.nextDue.billName}>
                {summary.nextDue.billName}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-(--color-warning)">
                  {formatNextDue()}
                </span>
                <span className="text-sm text-muted-foreground">•</span>
                <span className="text-sm font-mono text-muted-foreground">
                  ${summary.nextDue.amount.toFixed(2)}
                </span>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-lg font-medium text-muted-foreground">
                All paid for {year}!
              </div>
              <p className="text-xs text-(--color-income) mt-1">
                Great job staying on top of bills
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

