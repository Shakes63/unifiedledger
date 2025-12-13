'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CreditCard,
  Star,
  TrendingUp,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Info,
  AlertCircle,
  CheckCircle2,
  Settings,
  Edit2,
} from 'lucide-react';
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

// Types matching the API response
interface UnifiedDebtItem {
  id: string;
  name: string;
  source: 'account' | 'bill';
  sourceType: string;
  balance: number;
  minimumPayment: number;
  recommendedPayment: number;
  budgetedPayment: number | null;
  actualPaid: number;
  isFocusDebt: boolean;
  includeInPayoffStrategy: boolean;
  interestRate?: number;
  color?: string;
}

interface UnifiedDebtBudgetData {
  strategyEnabled: boolean;
  payoffMethod: 'snowball' | 'avalanche';
  extraMonthlyPayment: number;
  paymentFrequency: 'weekly' | 'biweekly' | 'monthly';
  strategyDebts: {
    items: UnifiedDebtItem[];
    totalMinimum: number;
    totalRecommended: number;
    totalPaid: number;
  };
  manualDebts: UnifiedDebtItem[];
  totalMinimumPayments: number;
  totalBudgetedPayments: number;
  totalActualPaid: number;
  debtCount: number;
}

// Payment status type for tracking
type _PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'overpaid';

interface StatusCounts {
  unpaid: number;
  partial: number;
  paid: number;
  overpaid: number;
}

interface UnifiedDebtBudgetSectionProps {
  month: string;
}

export function UnifiedDebtBudgetSection({ month }: UnifiedDebtBudgetSectionProps) {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [data, setData] = useState<UnifiedDebtBudgetData | null>(null);
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
      const response = await fetchWithHousehold(
        `/api/budgets/debts-unified?month=${month}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch unified debt budget data');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching unified debt budget data:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [selectedHouseholdId, month, fetchWithHousehold]);

  useEffect(() => {
    fetchDebtData();
  }, [fetchDebtData]);

  // Calculate status counts for all debts
  const statusCounts = useMemo((): StatusCounts => {
    const counts: StatusCounts = { unpaid: 0, partial: 0, paid: 0, overpaid: 0 };

    if (!data) return counts;

    const allDebts = [
      ...data.strategyDebts.items,
      ...data.manualDebts,
    ];

    allDebts.forEach((debt) => {
      const target = data.strategyEnabled && debt.includeInPayoffStrategy
        ? debt.recommendedPayment
        : (debt.budgetedPayment ?? debt.minimumPayment);

      if (debt.actualPaid === 0 && target > 0) {
        counts.unpaid++;
      } else if (debt.actualPaid > target) {
        counts.overpaid++;
      } else if (debt.actualPaid >= target) {
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
    return null;
  }

  // No debts - don't show section
  if (!data || data.debtCount === 0) {
    return null;
  }

  const totalRemaining = new Decimal(data.totalBudgetedPayments)
    .minus(data.totalActualPaid)
    .toNumber();
  const percentagePaid =
    data.totalBudgetedPayments > 0
      ? new Decimal(data.totalActualPaid)
          .div(data.totalBudgetedPayments)
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
            <CreditCard className="w-5 h-5 text-(--color-expense)" />
            <h2 className="text-lg font-semibold text-foreground">
              Debt Payments
            </h2>
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
                  {data.strategyEnabled
                    ? `Debts managed by your ${data.payoffMethod} payoff strategy. The focus debt receives extra payments.`
                    : 'Each debt is tracked individually. Enable payoff strategy in settings for centralized management.'}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/settings?tab=household-financial"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings className="w-3 h-3" />
            Strategy
          </Link>
          <span className="text-muted-foreground">|</span>
          <Link
            href="/dashboard/debts"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Manage Debts
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Strategy Mode Display */}
          {data.strategyEnabled && data.strategyDebts.items.length > 0 && (
            <div className="mb-4 p-4 bg-(--color-primary)/10 border border-(--color-primary)/30 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-(--color-primary)" />
                  <span className="text-sm font-medium text-foreground">
                    Managed by{' '}
                    <span className="capitalize">{data.payoffMethod}</span>{' '}
                    Strategy
                  </span>
                </div>
                <span className="text-sm font-mono text-(--color-primary)">
                  $
                  {data.strategyDebts.totalRecommended.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>

              {/* Focus Debt Highlight */}
              {data.strategyDebts.items.find((d) => d.isFocusDebt) && (
                <div className="mb-3 pb-3 border-b border-(--color-primary)/20">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-3 h-3 text-(--color-income)" />
                    <span className="text-sm text-muted-foreground">
                      Focus:{' '}
                      <span className="text-foreground font-medium">
                        {
                          data.strategyDebts.items.find((d) => d.isFocusDebt)
                            ?.name
                        }
                      </span>
                    </span>
                    {data.extraMonthlyPayment > 0 && (
                      <span className="text-xs text-(--color-income)">
                        (+$
                        {data.extraMonthlyPayment.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}{' '}
                        extra)
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Strategy Debts List */}
              <div className="flex flex-wrap gap-2 text-sm">
                {data.strategyDebts.items.map((debt) => (
                  <div
                    key={debt.id}
                    className={`flex items-center gap-1 px-2 py-1 rounded ${
                      debt.isFocusDebt
                        ? 'bg-(--color-primary)/20 text-(--color-primary)'
                        : 'bg-background/50 text-muted-foreground'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: debt.color || '#6b7280' }}
                    />
                    <span>{debt.name}</span>
                    <span className="text-xs opacity-70">
                      $
                      {debt.recommendedPayment.toLocaleString('en-US', {
                        minimumFractionDigits: 0,
                      })}
                    </span>
                  </div>
                ))}
              </div>

              {/* Strategy Progress */}
              <div className="mt-3 pt-3 border-t border-(--color-primary)/20">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Paid this month</span>
                  <span
                    className={`font-mono ${
                      data.strategyDebts.totalPaid >=
                      data.strategyDebts.totalRecommended
                        ? 'text-(--color-success)'
                        : 'text-foreground'
                    }`}
                  >
                    $
                    {data.strategyDebts.totalPaid.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                    })}{' '}
                    /{' '}
                    <span className="text-(--color-primary)">
                      $
                      {data.strategyDebts.totalRecommended.toLocaleString(
                        'en-US',
                        { minimumFractionDigits: 2 }
                      )}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Manual/Excluded Debts */}
          {data.manualDebts.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <Edit2 className="w-3 h-3" />
                {data.strategyEnabled
                  ? 'Manual (Excluded from Strategy)'
                  : 'Individual Debt Payments'}
              </h3>
              <div className="space-y-2">
                {data.manualDebts.map((debt) => (
                  <ManualDebtRow key={debt.id} debt={debt} />
                ))}
              </div>
            </div>
          )}

          {/* Show all debts as manual when strategy is disabled */}
          {!data.strategyEnabled && data.strategyDebts.items.length > 0 && (
            <div className="mb-4">
              <div className="space-y-2">
                {data.strategyDebts.items.map((debt) => (
                  <ManualDebtRow key={debt.id} debt={debt} />
                ))}
              </div>
              <Link
                href="/dashboard/settings?tab=household-financial"
                className="inline-flex items-center gap-1 text-sm text-(--color-primary) hover:opacity-80 transition-opacity mt-3"
              >
                <TrendingUp className="w-3 h-3" />
                Enable Payoff Strategy for centralized management
              </Link>
            </div>
          )}

          {/* Status Summary */}
          {needsAttention && (
            <div className="mb-4 p-3 bg-(--color-warning)/10 border border-(--color-warning)/30 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-(--color-warning)" />
                <span className="text-sm font-medium text-foreground">
                  Payment Status
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {statusCounts.unpaid > 0 && (
                  <span className="flex items-center gap-1 text-(--color-error)">
                    <span className="w-2 h-2 rounded-full bg-(--color-error)" />
                    {statusCounts.unpaid} unpaid
                  </span>
                )}
                {statusCounts.partial > 0 && (
                  <span className="flex items-center gap-1 text-(--color-warning)">
                    <span className="w-2 h-2 rounded-full bg-(--color-warning)" />
                    {statusCounts.partial} partial
                  </span>
                )}
                {statusCounts.paid > 0 && (
                  <span className="flex items-center gap-1 text-(--color-success)">
                    <span className="w-2 h-2 rounded-full bg-(--color-success)" />
                    {statusCounts.paid} paid
                  </span>
                )}
                {statusCounts.overpaid > 0 && (
                  <span className="flex items-center gap-1 text-(--color-primary)">
                    <span className="w-2 h-2 rounded-full bg-(--color-primary)" />
                    {statusCounts.overpaid} overpaid
                  </span>
                )}
              </div>
            </div>
          )}

          {/* All Paid Success Message */}
          {!needsAttention && data.debtCount > 0 && (
            <div className="mb-4 p-3 bg-(--color-success)/10 border border-(--color-success)/30 rounded-xl">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-(--color-success)" />
                <span className="text-sm font-medium text-(--color-success)">
                  All {data.debtCount} debt
                  {data.debtCount !== 1 ? 's' : ''} paid this month
                  {statusCounts.overpaid > 0 &&
                    ` (${statusCounts.overpaid} with extra payments)`}
                </span>
              </div>
            </div>
          )}

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-card border border-border rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Total Minimum</p>
              <p className="font-mono font-semibold text-foreground">
                $
                {data.totalMinimumPayments.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Budgeted</p>
              <p className="font-mono font-semibold text-(--color-primary)">
                $
                {data.totalBudgetedPayments.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Paid This Month</p>
              <p
                className={`font-mono font-semibold ${
                  percentagePaid >= 100
                    ? 'text-(--color-success)'
                    : 'text-foreground'
                }`}
              >
                $
                {data.totalActualPaid.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Remaining</p>
              <p
                className={`font-mono font-semibold ${
                  totalRemaining <= 0
                    ? 'text-(--color-success)'
                    : 'text-(--color-expense)'
                }`}
              >
                $
                {Math.max(0, totalRemaining).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>
        </>
      )}

      {/* Collapsed Summary */}
      {!isExpanded && (
        <div
          className={`flex items-center justify-between p-3 bg-card border rounded-lg ${
            needsAttention ? 'border-(--color-warning)' : 'border-border'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {data.debtCount} debt{data.debtCount !== 1 ? 's' : ''}
            </span>
            {data.strategyEnabled && (
              <span className="text-xs text-(--color-primary) bg-(--color-primary)/10 px-2 py-0.5 rounded">
                {data.payoffMethod}
              </span>
            )}
            {/* Compact status indicators */}
            <div className="flex items-center gap-2 text-xs">
              {statusCounts.paid > 0 && (
                <span className="flex items-center gap-1 text-(--color-success)">
                  <span className="w-1.5 h-1.5 rounded-full bg-(--color-success)" />
                  {statusCounts.paid}
                </span>
              )}
              {statusCounts.overpaid > 0 && (
                <span className="flex items-center gap-1 text-(--color-primary)">
                  <span className="w-1.5 h-1.5 rounded-full bg-(--color-primary)" />
                  +{statusCounts.overpaid}
                </span>
              )}
              {statusCounts.partial > 0 && (
                <span className="flex items-center gap-1 text-(--color-warning)">
                  <span className="w-1.5 h-1.5 rounded-full bg-(--color-warning)" />
                  {statusCounts.partial}
                </span>
              )}
              {statusCounts.unpaid > 0 && (
                <span className="flex items-center gap-1 text-(--color-error)">
                  <AlertCircle className="w-3 h-3" />
                  {statusCounts.unpaid}
                </span>
              )}
            </div>
          </div>
          <span className="text-sm font-mono">
            <span
              className={
                percentagePaid >= 100
                  ? 'text-(--color-success)'
                  : 'text-foreground'
              }
            >
              $
              {data.totalActualPaid.toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </span>
            <span className="text-muted-foreground"> / </span>
            <span className="text-(--color-primary)">
              $
              {data.totalBudgetedPayments.toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

// Manual debt row component
function ManualDebtRow({ debt }: { debt: UnifiedDebtItem }) {
  const target = debt.budgetedPayment ?? debt.minimumPayment;
  const isPaid = debt.actualPaid >= target;
  const isOverpaid = debt.actualPaid > target;

  return (
    <div className="flex items-center justify-between p-3 bg-card border border-border rounded-lg hover:bg-elevated transition-colors">
      <div className="flex items-center gap-3">
        <span
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: debt.color || '#6b7280' }}
        />
        <div>
          <p className="text-sm font-medium text-foreground">{debt.name}</p>
          <p className="text-xs text-muted-foreground">
            {debt.source === 'account' ? 'Credit' : 'Loan'} - $
            {debt.balance.toLocaleString('en-US', { minimumFractionDigits: 0 })}{' '}
            balance
          </p>
        </div>
      </div>
      <div className="text-right">
        <p
          className={`text-sm font-mono ${
            isOverpaid
              ? 'text-(--color-primary)'
              : isPaid
              ? 'text-(--color-success)'
              : 'text-foreground'
          }`}
        >
          ${debt.actualPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-muted-foreground">
          / ${target.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </p>
      </div>
    </div>
  );
}

