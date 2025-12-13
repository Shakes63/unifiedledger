'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DebtBudgetCard } from './debt-budget-card';
import { CreditCard, Star, TrendingUp, ExternalLink, ChevronDown, ChevronUp, Info, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import Link from 'next/link';
import Decimal from 'decimal.js';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Payment status type for tracking
type _PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'overpaid';

interface StatusCounts {
  unpaid: number;
  partial: number;
  paid: number;
  overpaid: number;
}

interface DebtBudgetItem {
  debtId: string;
  debtName: string;
  creditorName: string;
  minimumPayment: number;
  additionalMonthlyPayment: number;
  recommendedPayment: number;
  isFocusDebt: boolean;
  actualPaid: number;
  remainingBalance: number;
  interestRate: number;
  payoffMonth: number;
  payoffDate: string;
  color: string;
  type: string;
}

interface DebtBudgetData {
  debts: DebtBudgetItem[];
  totalMinimumPayments: number;
  totalRecommendedPayments: number;
  totalActualPaid: number;
  focusDebt: DebtBudgetItem | null;
  extraPaymentAmount: number;
  payoffMethod: 'snowball' | 'avalanche';
  paymentFrequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
}

interface DebtBudgetSectionProps {
  month: string;
}

export function DebtBudgetSection({ month }: DebtBudgetSectionProps) {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [data, setData] = useState<DebtBudgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const fetchDebtData = useCallback(async () => {
    if (!selectedHouseholdId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(false);
      const response = await fetchWithHousehold(`/api/budgets/debts?month=${month}`);

      if (!response.ok) {
        throw new Error('Failed to fetch debt budget data');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching debt budget data:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [selectedHouseholdId, month, fetchWithHousehold]);

  useEffect(() => {
    fetchDebtData();
  }, [fetchDebtData]);

  // Calculate status counts for individual debts - MUST be before early returns (Rules of Hooks)
  const statusCounts = useMemo((): StatusCounts => {
    const counts: StatusCounts = { unpaid: 0, partial: 0, paid: 0, overpaid: 0 };
    
    if (!data || !data.debts) {
      return counts;
    }
    
    data.debts.forEach(debt => {
      if (debt.actualPaid === 0 && debt.recommendedPayment > 0) {
        counts.unpaid++;
      } else if (debt.actualPaid > debt.recommendedPayment) {
        counts.overpaid++;
      } else if (debt.actualPaid >= debt.recommendedPayment) {
        counts.paid++;
      } else {
        counts.partial++;
      }
    });
    
    return counts;
  }, [data]);

  // Check if there are debts that need attention
  const needsAttention = statusCounts.unpaid > 0 || statusCounts.partial > 0;

  // Loading state
  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-6 bg-elevated rounded w-48 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="h-40 bg-elevated rounded-xl" />
          <div className="h-40 bg-elevated rounded-xl" />
        </div>
      </div>
    );
  }

  // Error or no data
  if (error) {
    return null; // Silently hide on error
  }

  // No debts - don't show section
  if (!data || data.debts.length === 0) {
    return null;
  }

  const totalRemaining = new Decimal(data.totalRecommendedPayments)
    .minus(data.totalActualPaid)
    .toNumber();
  const percentagePaid = data.totalRecommendedPayments > 0
    ? new Decimal(data.totalActualPaid)
        .div(data.totalRecommendedPayments)
        .times(100)
        .toNumber()
    : 0;

  return (
    <div>
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 hover:text-foreground transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
            <CreditCard className="w-5 h-5 text-expense" />
            <h2 className="text-lg font-semibold text-foreground">Debt Payments</h2>
          </button>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-muted-foreground hover:text-foreground transition-colors">
                  <Info className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  Debt payments are auto-calculated from your debt payoff strategy.
                  The focused debt shows the recommended payment based on your{' '}
                  <span className="capitalize">{data.payoffMethod}</span> method.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <Link
          href="/dashboard/debts"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Manage Debts
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {isExpanded && (
        <>
          {/* Focus Debt Highlight */}
          {data.focusDebt && (
            <div className="mb-4 p-4 bg-primary/10 border border-primary/30 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  Focus Debt: {data.focusDebt.debtName}
                </span>
                <span className="text-xs text-muted-foreground capitalize">
                  ({data.payoffMethod} method)
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Your payoff strategy recommends paying{' '}
                <span className="font-mono font-semibold text-primary">
                  ${data.focusDebt.recommendedPayment.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>{' '}
                this month to accelerate your debt-free date.
              </p>
              {data.extraPaymentAmount > 0 && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-income" />
                  Includes ${data.extraPaymentAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} extra payment
                </p>
              )}
            </div>
          )}

          {/* Status Summary - Shows individual debt payment statuses */}
          {needsAttention && (
            <div className="mb-4 p-3 bg-warning/10 border border-warning/30 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-warning" />
                <span className="text-sm font-medium text-foreground">Payment Status</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {statusCounts.unpaid > 0 && (
                  <span className="flex items-center gap-1 text-error">
                    <span className="w-2 h-2 rounded-full bg-error" />
                    {statusCounts.unpaid} unpaid
                  </span>
                )}
                {statusCounts.partial > 0 && (
                  <span className="flex items-center gap-1 text-warning">
                    <span className="w-2 h-2 rounded-full bg-warning" />
                    {statusCounts.partial} partial
                  </span>
                )}
                {statusCounts.paid > 0 && (
                  <span className="flex items-center gap-1 text-success">
                    <span className="w-2 h-2 rounded-full bg-success" />
                    {statusCounts.paid} paid
                  </span>
                )}
                {statusCounts.overpaid > 0 && (
                  <span className="flex items-center gap-1 text-primary">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    {statusCounts.overpaid} overpaid
                  </span>
                )}
              </div>
            </div>
          )}

          {/* All Paid Success Message */}
          {!needsAttention && data.debts.length > 0 && (
            <div className="mb-4 p-3 bg-success/10 border border-success/30 rounded-xl">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span className="text-sm font-medium text-success">
                  All {data.debts.length} debt{data.debts.length !== 1 ? 's' : ''} paid this month
                  {statusCounts.overpaid > 0 && ` (${statusCounts.overpaid} with extra payments)`}
                </span>
              </div>
            </div>
          )}

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-card border border-border rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Total Minimum</p>
              <p className="font-mono font-semibold text-foreground">
                ${data.totalMinimumPayments.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Recommended</p>
              <p className="font-mono font-semibold text-primary">
                ${data.totalRecommendedPayments.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Paid This Month</p>
              <p className={`font-mono font-semibold ${
                percentagePaid >= 100 ? 'text-success' : 'text-foreground'
              }`}>
                ${data.totalActualPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Remaining</p>
              <p className={`font-mono font-semibold ${
                totalRemaining <= 0 ? 'text-success' : 'text-expense'
              }`}>
                ${Math.max(0, totalRemaining).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Debt Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.debts.map(debt => (
              <DebtBudgetCard key={debt.debtId} debt={debt} />
            ))}
          </div>
        </>
      )}

      {/* Collapsed Summary */}
      {!isExpanded && (
        <div className={`flex items-center justify-between p-3 bg-card border rounded-lg ${
          needsAttention ? 'border-warning' : 'border-border'
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {data.debts.length} debt{data.debts.length !== 1 ? 's' : ''}
            </span>
            {/* Compact status indicators */}
            <div className="flex items-center gap-2 text-xs">
              {statusCounts.paid > 0 && (
                <span className="flex items-center gap-1 text-success">
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
                  {statusCounts.paid}
                </span>
              )}
              {statusCounts.overpaid > 0 && (
                <span className="flex items-center gap-1 text-primary">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  +{statusCounts.overpaid}
                </span>
              )}
              {statusCounts.partial > 0 && (
                <span className="flex items-center gap-1 text-warning">
                  <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                  {statusCounts.partial}
                </span>
              )}
              {statusCounts.unpaid > 0 && (
                <span className="flex items-center gap-1 text-error">
                  <AlertCircle className="w-3 h-3" />
                  {statusCounts.unpaid}
                </span>
              )}
            </div>
          </div>
          <span className="text-sm font-mono">
            <span className={percentagePaid >= 100 ? 'text-success' : 'text-foreground'}>
              ${data.totalActualPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-muted-foreground"> / </span>
            <span className="text-primary">
              ${data.totalRecommendedPayments.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

