'use client';

import { useEffect, useState } from 'react';
import {
  Wallet,
  DollarSign,
  Receipt,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  Settings,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import Decimal from 'decimal.js';
import { useHousehold } from '@/contexts/household-context';
import Link from 'next/link';

interface IncomeBreakdownItem {
  id: string;
  name: string;
  expectedAmount: number;
  actualAmount: number | null;
  status: 'received' | 'pending' | 'overdue';
  dueDate: string;
  variance: number;
}

interface BillBreakdownItem {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  isAutopay: boolean;
  categoryName?: string;
}

interface AccountItem {
  id: string;
  name: string;
  balance: number;
  type: string;
}

interface PaycheckBalanceData {
  currentPeriod: {
    start: string;
    end: string;
    label: string;
    daysRemaining: number;
    periodNumber: number;
    periodsInMonth: number;
  };
  settings: {
    frequency: string;
  };
  income: {
    expected: number;
    actual: number;
    pending: number;
    variance: number;
    variancePercent: number;
    breakdown: IncomeBreakdownItem[];
  };
  bills: {
    total: number;
    paid: number;
    pending: number;
    breakdown: {
      paid: BillBreakdownItem[];
      autopayUpcoming: BillBreakdownItem[];
      manualUpcoming: BillBreakdownItem[];
    };
  };
  budget: {
    monthlyTotal: number;
    periodAllocation: number;
    actualSpent: number;
    remaining: number;
    percentUsed: number;
  };
  accounts: {
    includedBalance: number;
    includedAccounts: AccountItem[];
    excludedCount: number;
  };
  discretionary: {
    accountBalance: number;
    expectedIncome: number;
    actualIncome: number;
    billsTotal: number;
    billsPaid: number;
    billsPending: number;
    budgetAllocation: number;
    budgetSpent: number;
    budgetRemaining: number;
    expectedDiscretionary: number;
    currentDiscretionary: number;
    projectedDiscretionary: number;
    variance: number;
  };
}

function formatCurrency(amount: number, showSign = false): string {
  const formatted = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (showSign) {
    return amount >= 0 ? `+$${formatted}` : `-$${formatted}`;
  }
  return amount >= 0 ? `$${formatted}` : `-$${formatted}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface CollapsibleSectionProps {
  title: string;
  amount: number;
  isAddition?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
}

function CollapsibleSection({
  title,
  amount,
  isAddition = true,
  icon,
  children,
  defaultOpen = false,
  badge,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-elevated transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-muted-foreground">{icon}</div>
          <span className="font-medium text-foreground">{title}</span>
          {badge}
        </div>
        <div className="flex items-center gap-3">
          <span
            className="font-mono font-bold"
            style={{
              color: isAddition ? 'var(--color-income)' : 'var(--color-expense)',
            }}
          >
            {isAddition ? '+' : '-'}${Math.abs(amount).toLocaleString('en-US', {
              minimumFractionDigits: 2,
            })}
          </span>
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-0">
          {children}
        </div>
      )}
    </div>
  );
}

export function PaycheckBalanceWidget() {
  const { initialized, loading: householdLoading, selectedHouseholdId: householdId } = useHousehold();
  const [data, setData] = useState<PaycheckBalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialized || householdLoading || !householdId) {
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/budget-schedule/paycheck-balance?householdId=${householdId}`,
          { credentials: 'include' }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch paycheck balance data');
        }

        const responseData = await response.json();
        setData(responseData);
      } catch (err) {
        console.error('Failed to fetch paycheck balance:', err);
        setError('Unable to load paycheck balance data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [initialized, householdLoading, householdId]);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 animate-pulse">
        <div className="h-6 w-40 bg-elevated rounded mb-4"></div>
        <div className="h-12 w-32 bg-elevated rounded mb-6"></div>
        <div className="space-y-3">
          <div className="h-10 bg-elevated rounded"></div>
          <div className="h-10 bg-elevated rounded"></div>
          <div className="h-10 bg-elevated rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="text-center text-muted-foreground">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>{error || 'No data available'}</p>
        </div>
      </div>
    );
  }

  const discretionary = data.discretionary.projectedDiscretionary;
  const isPositive = discretionary >= 0;
  const hasIncomeVariance = data.income.variance !== 0;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">
            {data.currentPeriod.label}
          </h3>
          <span className="text-sm text-muted-foreground">
            {data.currentPeriod.daysRemaining} days left
          </span>
        </div>
      </div>

      {/* Hero Discretionary Amount */}
      <div className="p-6 text-center border-b border-border">
        <p
          className="text-4xl font-bold font-mono"
          style={{
            color: isPositive ? 'var(--color-income)' : 'var(--color-error)',
          }}
        >
          {formatCurrency(discretionary)}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Discretionary This Period
        </p>
        
        {/* Variance indicator */}
        {hasIncomeVariance && (
          <div
            className="inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-full text-xs font-medium"
            style={{
              backgroundColor: data.income.variance > 0
                ? 'rgba(var(--income-rgb), 0.1)'
                : 'rgba(var(--error-rgb), 0.1)',
              color: data.income.variance > 0
                ? 'var(--color-income)'
                : 'var(--color-error)',
            }}
          >
            {data.income.variance > 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {formatCurrency(data.income.variance, true)} from expected
          </div>
        )}
      </div>

      {/* Equation Breakdown */}
      <div className="divide-y divide-border">
        {/* Starting Balance */}
        <CollapsibleSection
          title="Starting Balance"
          amount={data.accounts.includedBalance}
          isAddition={true}
          icon={<Wallet className="w-5 h-5" />}
          badge={
            data.accounts.excludedCount > 0 ? (
              <span className="text-xs text-muted-foreground px-2 py-0.5 bg-elevated rounded-full">
                {data.accounts.includedAccounts.length} accounts
              </span>
            ) : null
          }
        >
          <div className="space-y-2 pl-8">
            {data.accounts.includedAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-muted-foreground">{account.name}</span>
                <span className="font-mono text-foreground">
                  {formatCurrency(account.balance)}
                </span>
              </div>
            ))}
            {data.accounts.excludedCount > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {data.accounts.excludedCount} account(s) excluded from discretionary
              </p>
            )}
          </div>
        </CollapsibleSection>

        {/* Income */}
        {(data.income.expected > 0 || data.income.actual > 0) && (
          <CollapsibleSection
            title="Income"
            amount={data.income.expected}
            isAddition={true}
            icon={<DollarSign className="w-5 h-5" />}
            badge={
              hasIncomeVariance ? (
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: data.income.variance > 0
                      ? 'rgba(var(--income-rgb), 0.1)'
                      : 'rgba(var(--error-rgb), 0.1)',
                    color: data.income.variance > 0
                      ? 'var(--color-income)'
                      : 'var(--color-error)',
                  }}
                >
                  {formatCurrency(data.income.variance, true)}
                </span>
              ) : null
            }
          >
            <div className="space-y-2 pl-8">
              {/* Summary row */}
              <div className="flex items-center justify-between text-sm pb-2 border-b border-border/50">
                <span className="text-muted-foreground">Expected</span>
                <span className="font-mono">{formatCurrency(data.income.expected)}</span>
              </div>
              <div className="flex items-center justify-between text-sm pb-2 border-b border-border/50">
                <span className="text-muted-foreground">Received</span>
                <span
                  className="font-mono"
                  style={{ color: 'var(--color-income)' }}
                >
                  {formatCurrency(data.income.actual)}
                </span>
              </div>
              
              {/* Individual income items */}
              {data.income.breakdown.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    {item.status === 'received' ? (
                      <CheckCircle2
                        className="w-4 h-4"
                        style={{ color: 'var(--color-income)' }}
                      />
                    ) : item.status === 'overdue' ? (
                      <AlertCircle
                        className="w-4 h-4"
                        style={{ color: 'var(--color-error)' }}
                      />
                    ) : (
                      <Clock className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="text-muted-foreground">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-foreground">
                      {item.actualAmount !== null
                        ? formatCurrency(item.actualAmount)
                        : formatCurrency(item.expectedAmount)}
                    </span>
                    {item.variance !== 0 && (
                      <span
                        className="text-xs"
                        style={{
                          color: item.variance > 0
                            ? 'var(--color-income)'
                            : 'var(--color-error)',
                        }}
                      >
                        ({formatCurrency(item.variance, true)})
                      </span>
                    )}
                  </div>
                </div>
              ))}
              
              {data.income.breakdown.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No income bills configured for this period
                </p>
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* Bills */}
        {data.bills.total > 0 && (
          <CollapsibleSection
            title="Bills"
            amount={data.bills.total}
            isAddition={false}
            icon={<Receipt className="w-5 h-5" />}
            badge={
              <span className="text-xs text-muted-foreground px-2 py-0.5 bg-elevated rounded-full">
                {data.bills.pending > 0
                  ? `${formatCurrency(data.bills.pending)} pending`
                  : 'All paid'}
              </span>
            }
          >
            <div className="space-y-3 pl-8">
              {/* Paid bills */}
              {data.bills.breakdown.paid.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Paid ({data.bills.breakdown.paid.length})
                  </p>
                  <div className="space-y-1">
                    {data.bills.breakdown.paid.slice(0, 3).map((bill) => (
                      <div
                        key={bill.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2
                            className="w-4 h-4"
                            style={{ color: 'var(--color-income)' }}
                          />
                          <span className="text-muted-foreground">{bill.name}</span>
                        </div>
                        <span className="font-mono text-foreground">
                          {formatCurrency(bill.amount)}
                        </span>
                      </div>
                    ))}
                    {data.bills.breakdown.paid.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{data.bills.breakdown.paid.length - 3} more paid
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Autopay upcoming */}
              {data.bills.breakdown.autopayUpcoming.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Autopay Upcoming ({data.bills.breakdown.autopayUpcoming.length})
                  </p>
                  <div className="space-y-1">
                    {data.bills.breakdown.autopayUpcoming.map((bill) => (
                      <div
                        key={bill.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {bill.name}
                            <span className="text-xs ml-1 opacity-60">
                              {formatDate(bill.dueDate)}
                            </span>
                          </span>
                        </div>
                        <span className="font-mono text-foreground">
                          {formatCurrency(bill.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual upcoming */}
              {data.bills.breakdown.manualUpcoming.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-warning mb-2">
                    Manual Payment Needed ({data.bills.breakdown.manualUpcoming.length})
                  </p>
                  <div className="space-y-1">
                    {data.bills.breakdown.manualUpcoming.map((bill) => (
                      <div
                        key={bill.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <AlertCircle
                            className="w-4 h-4"
                            style={{ color: 'var(--color-warning)' }}
                          />
                          <span className="text-muted-foreground">
                            {bill.name}
                            <span className="text-xs ml-1 opacity-60">
                              {formatDate(bill.dueDate)}
                            </span>
                          </span>
                        </div>
                        <span className="font-mono text-foreground">
                          {formatCurrency(bill.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* Budget */}
        {data.budget.periodAllocation > 0 && (
          <CollapsibleSection
            title="Budgeted Expenses"
            amount={data.budget.periodAllocation}
            isAddition={false}
            icon={<Receipt className="w-5 h-5" />}
            defaultOpen={false}
          >
            <div className="pl-8 space-y-3">
              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Spent</span>
                  <span className="font-mono">
                    {formatCurrency(data.budget.actualSpent)} / {formatCurrency(data.budget.periodAllocation)}
                  </span>
                </div>
                <div className="h-2 bg-elevated rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${Math.min(100, data.budget.percentUsed)}%`,
                      backgroundColor:
                        data.budget.percentUsed > 100
                          ? 'var(--color-error)'
                          : data.budget.percentUsed > 80
                          ? 'var(--color-warning)'
                          : 'var(--color-primary)',
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Decimal(data.budget.periodAllocation)
                    .minus(data.budget.actualSpent)
                    .toNumber() >= 0
                    ? `${formatCurrency(data.budget.remaining)} remaining`
                    : `${formatCurrency(Math.abs(data.budget.remaining))} over budget`}
                </p>
              </div>

              {/* Monthly context */}
              {data.currentPeriod.periodsInMonth > 1 && (
                <p className="text-xs text-muted-foreground">
                  This is {formatCurrency(data.budget.periodAllocation)} of your{' '}
                  {formatCurrency(data.budget.monthlyTotal)} monthly budget
                  (1/{data.currentPeriod.periodsInMonth} of the month)
                </p>
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* Discretionary Result */}
        <div className="p-4 bg-elevated/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div style={{ color: isPositive ? 'var(--color-income)' : 'var(--color-error)' }}>
                <DollarSign className="w-5 h-5" />
              </div>
              <span className="font-bold text-foreground">= Discretionary</span>
            </div>
            <span
              className="font-mono font-bold text-lg"
              style={{
                color: isPositive ? 'var(--color-income)' : 'var(--color-error)',
              }}
            >
              {formatCurrency(discretionary)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2 pl-8">
            Available for unplanned spending this period
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 bg-elevated/30 border-t border-border">
        <Link
          href="/dashboard/settings?tab=financial"
          className="flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Settings className="w-3 h-3" />
          Configure budget schedule in Settings
        </Link>
      </div>
    </div>
  );
}

