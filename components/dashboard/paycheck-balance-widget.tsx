'use client';

import { useEffect, useState } from 'react';
import {
  Wallet,
  DollarSign,
  Receipt,
  ChevronDown,
  ChevronUp,
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
    <div className="border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-start justify-between gap-3 py-3 px-4 transition-colors"
        style={{ backgroundColor: 'transparent' }}
      >
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <div className="shrink-0 mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>{icon}</div>
          <div className="min-w-0">
            <span className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>{title}</span>
            {badge && <div className="mt-0.5 whitespace-nowrap">{badge}</div>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          <span
            className="font-mono font-semibold text-sm whitespace-nowrap"
            style={{
              color: isAddition ? 'var(--color-income)' : 'var(--color-expense)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {isAddition ? '+' : '-'}${Math.abs(amount).toLocaleString('en-US', {
              minimumFractionDigits: 2,
            })}
          </span>
          {isOpen ? (
            <ChevronUp className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-muted-foreground)' }} />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-muted-foreground)' }} />
          )}
        </div>
      </button>
      {isOpen && (
        <div className="px-4 pb-3 pt-1">
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
      <div className="rounded-xl p-6 animate-pulse border" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
        <div className="h-6 w-40 rounded mb-4" style={{ backgroundColor: 'var(--color-elevated)' }}></div>
        <div className="h-12 w-32 rounded mb-6" style={{ backgroundColor: 'var(--color-elevated)' }}></div>
        <div className="space-y-3">
          <div className="h-10 rounded" style={{ backgroundColor: 'var(--color-elevated)' }}></div>
          <div className="h-10 rounded" style={{ backgroundColor: 'var(--color-elevated)' }}></div>
          <div className="h-10 rounded" style={{ backgroundColor: 'var(--color-elevated)' }}></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl p-6 border" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
        <div className="text-center" style={{ color: 'var(--color-muted-foreground)' }}>
          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>{error || 'No data available'}</p>
        </div>
      </div>
    );
  }

  const discretionary = data.discretionary.projectedDiscretionary;
  const isPositive = discretionary >= 0;
  const hasIncomeVariance = data.income.variance !== 0;
  const accentColor = isPositive ? 'var(--color-income)' : 'var(--color-destructive)';

  return (
    <div
      className="rounded-xl overflow-hidden relative"
      style={{
        backgroundColor: 'var(--color-background)',
        border: '1px solid var(--color-border)',
        borderLeftWidth: 4,
        borderLeftColor: accentColor,
        backgroundImage: `radial-gradient(ellipse 80% 80% at 100% 0%, color-mix(in oklch, ${accentColor} 3%, transparent), transparent)`,
      }}
    >
      {/* Header */}
      <div className="py-2 px-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-muted-foreground)' }}>
            {data.currentPeriod.label}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px]"
            style={{ backgroundColor: 'var(--color-elevated)', color: 'var(--color-muted-foreground)' }}
          >
            {data.currentPeriod.daysRemaining} days left
          </span>
        </div>
      </div>

      {/* Hero Discretionary Amount */}
      <div className="px-4 pb-5 pt-2 text-center">
        <p
          className="font-bold font-mono"
          style={{
            color: accentColor,
            fontVariantNumeric: 'tabular-nums',
            fontSize: 'clamp(1rem, 6vw, 2.25rem)',
            lineHeight: 1.1,
          }}
        >
          {formatCurrency(discretionary)}
        </p>
        <p className="text-[10px] uppercase tracking-[0.08em] mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
          Discretionary This Period
        </p>
        <p className="text-[10px] mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: 'var(--color-muted-foreground)' }}>
          = Account − Income − Bills − Budget
        </p>

        {/* Variance indicator */}
        {hasIncomeVariance && (
          <div
            className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full text-[11px] font-medium"
            style={{
              backgroundColor: data.income.variance > 0
                ? 'color-mix(in oklch, var(--color-income) 10%, transparent)'
                : 'color-mix(in oklch, var(--color-destructive) 10%, transparent)',
              color: data.income.variance > 0
                ? 'var(--color-income)'
                : 'var(--color-destructive)',
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
      <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
        {/* Starting Balance */}
        <CollapsibleSection
          title="Starting Balance"
          amount={data.accounts.includedBalance}
          isAddition={true}
          icon={<Wallet className="w-5 h-5" />}
          badge={
            data.accounts.excludedCount > 0 ? (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  color: 'var(--color-muted-foreground)',
                  backgroundColor: 'var(--color-elevated)',
                }}
              >
                {data.accounts.includedAccounts.length} accounts
              </span>
            ) : null
          }
        >
          <div className="space-y-0">
            {data.accounts.includedAccounts.map((account, idx) => (
              <div
                key={account.id}
                className="flex items-center gap-3 py-2 px-3 dashboard-fade-in"
                style={{
                  borderBottom: '1px solid color-mix(in oklch, var(--color-border) 40%, transparent)',
                  animationDelay: `${idx * 30}ms`,
                }}
              >
                <div
                  className="shrink-0 rounded-full"
                  style={{ width: 3, height: 16, backgroundColor: 'var(--color-muted-foreground)' }}
                />
                <span className="flex-1 text-[13px] min-w-0 truncate" style={{ color: 'var(--color-muted-foreground)' }}>{account.name}</span>
                <span className="font-mono text-[13px] shrink-0" style={{ color: 'var(--color-foreground)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(account.balance)}
                </span>
              </div>
            ))}
            {data.accounts.excludedCount > 0 && (
              <p className="text-[11px] mt-2 pl-6" style={{ color: 'var(--color-muted-foreground)' }}>
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
                      ? 'color-mix(in oklch, var(--color-income) 10%, transparent)'
                      : 'color-mix(in oklch, var(--color-destructive) 10%, transparent)',
                    color: data.income.variance > 0
                      ? 'var(--color-income)'
                      : 'var(--color-destructive)',
                  }}
                >
                  {formatCurrency(data.income.variance, true)}
                </span>
              ) : null
            }
          >
            <div className="space-y-0">
              {/* Summary rows */}
              <div
                className="flex items-center gap-3 py-2 px-3"
                style={{ borderBottom: '1px solid color-mix(in oklch, var(--color-border) 40%, transparent)' }}
              >
                <div className="shrink-0 rounded-full" style={{ width: 3, height: 16, backgroundColor: 'var(--color-muted-foreground)' }} />
                <span className="flex-1 text-[13px]" style={{ color: 'var(--color-muted-foreground)' }}>Expected</span>
                <span className="font-mono text-[13px]" style={{ color: 'var(--color-foreground)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(data.income.expected)}</span>
              </div>
              <div
                className="flex items-center gap-3 py-2 px-3"
                style={{ borderBottom: '1px solid color-mix(in oklch, var(--color-border) 40%, transparent)' }}
              >
                <div className="shrink-0 rounded-full" style={{ width: 3, height: 16, backgroundColor: 'var(--color-income)' }} />
                <span className="flex-1 text-[13px]" style={{ color: 'var(--color-muted-foreground)' }}>Received</span>
                <span className="font-mono text-[13px]" style={{ color: 'var(--color-income)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(data.income.actual)}
                </span>
              </div>
              {data.income.breakdown.map((item, idx) => {
                const dotColor = item.status === 'received' ? 'var(--color-income)' : item.status === 'overdue' ? 'var(--color-destructive)' : 'var(--color-muted-foreground)';
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 py-2 px-3 dashboard-fade-in"
                    style={{
                      borderBottom: '1px solid color-mix(in oklch, var(--color-border) 40%, transparent)',
                      animationDelay: `${idx * 30}ms`,
                    }}
                  >
                    <div className="shrink-0 rounded-full" style={{ width: 3, height: 16, backgroundColor: dotColor }} />
                    <span className="flex-1 text-[13px] min-w-0 truncate" style={{ color: 'var(--color-muted-foreground)' }}>{item.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-[13px]" style={{ color: 'var(--color-foreground)', fontVariantNumeric: 'tabular-nums' }}>
                        {item.actualAmount !== null ? formatCurrency(item.actualAmount) : formatCurrency(item.expectedAmount)}
                      </span>
                      {item.variance !== 0 && (
                        <span
                          className="text-[11px]"
                          style={{ color: item.variance > 0 ? 'var(--color-income)' : 'var(--color-destructive)' }}
                        >
                          ({formatCurrency(item.variance, true)})
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {data.income.breakdown.length === 0 && (
                <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
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
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  color: 'var(--color-muted-foreground)',
                  backgroundColor: 'var(--color-elevated)',
                }}
              >
                {data.bills.pending > 0
                  ? `${formatCurrency(data.bills.pending)} pending`
                  : 'All paid'}
              </span>
            }
          >
            <div className="space-y-0">
              {/* Paid bills */}
              {data.bills.breakdown.paid.length > 0 && (
                <>
                  <p className="text-[10px] uppercase tracking-[0.08em] py-2 px-3" style={{ color: 'var(--color-muted-foreground)' }}>
                    Paid ({data.bills.breakdown.paid.length})
                  </p>
                  {data.bills.breakdown.paid.slice(0, 3).map((bill, idx) => (
                    <div
                      key={bill.id}
                      className="flex items-center gap-3 py-2 px-3 dashboard-fade-in"
                      style={{
                        borderBottom: '1px solid color-mix(in oklch, var(--color-border) 40%, transparent)',
                        animationDelay: `${idx * 30}ms`,
                      }}
                    >
                      <div className="shrink-0 rounded-full" style={{ width: 3, height: 16, backgroundColor: 'var(--color-income)' }} />
                      <span className="flex-1 text-[13px] min-w-0 truncate" style={{ color: 'var(--color-muted-foreground)' }}>{bill.name}</span>
                      <span className="font-mono text-[13px] shrink-0" style={{ color: 'var(--color-foreground)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(bill.amount)}
                      </span>
                    </div>
                  ))}
                  {data.bills.breakdown.paid.length > 3 && (
                    <p className="text-[11px] py-2 px-3" style={{ color: 'var(--color-muted-foreground)' }}>
                      +{data.bills.breakdown.paid.length - 3} more paid
                    </p>
                  )}
                </>
              )}

              {/* Autopay upcoming */}
              {data.bills.breakdown.autopayUpcoming.length > 0 && (
                <>
                  <p className="text-[10px] uppercase tracking-[0.08em] py-2 px-3 mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                    Autopay Upcoming ({data.bills.breakdown.autopayUpcoming.length})
                  </p>
                  {data.bills.breakdown.autopayUpcoming.map((bill, idx) => (
                    <div
                      key={bill.id}
                      className="flex items-center gap-3 py-2 px-3 dashboard-fade-in"
                      style={{
                        borderBottom: '1px solid color-mix(in oklch, var(--color-border) 40%, transparent)',
                        animationDelay: `${idx * 30}ms`,
                      }}
                    >
                      <div className="shrink-0 rounded-full" style={{ width: 3, height: 16, backgroundColor: 'var(--color-muted-foreground)' }} />
                      <span className="flex-1 text-[13px] min-w-0 truncate" style={{ color: 'var(--color-muted-foreground)' }}>
                        {bill.name}
                        <span className="text-[11px] ml-1 opacity-60">{formatDate(bill.dueDate)}</span>
                      </span>
                      <span className="font-mono text-[13px] shrink-0" style={{ color: 'var(--color-foreground)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(bill.amount)}
                      </span>
                    </div>
                  ))}
                </>
              )}

              {/* Manual upcoming */}
              {data.bills.breakdown.manualUpcoming.length > 0 && (
                <>
                  <p className="text-[10px] uppercase tracking-[0.08em] py-2 px-3 mt-1" style={{ color: 'var(--color-warning)' }}>
                    Manual Payment Needed ({data.bills.breakdown.manualUpcoming.length})
                  </p>
                  {data.bills.breakdown.manualUpcoming.map((bill, idx) => (
                    <div
                      key={bill.id}
                      className="flex items-center gap-3 py-2 px-3 dashboard-fade-in"
                      style={{
                        borderBottom: '1px solid color-mix(in oklch, var(--color-border) 40%, transparent)',
                        animationDelay: `${idx * 30}ms`,
                      }}
                    >
                      <div className="shrink-0 rounded-full" style={{ width: 3, height: 16, backgroundColor: 'var(--color-destructive)' }} />
                      <span className="flex-1 text-[13px] min-w-0 truncate" style={{ color: 'var(--color-muted-foreground)' }}>
                        {bill.name}
                        <span className="text-[11px] ml-1 opacity-60">{formatDate(bill.dueDate)}</span>
                      </span>
                      <span className="font-mono text-[13px] shrink-0" style={{ color: 'var(--color-foreground)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(bill.amount)}
                      </span>
                    </div>
                  ))}
                </>
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
            <div className="space-y-3">
              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-muted-foreground)' }}>Spent</span>
                  <span className="font-mono text-[13px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(data.budget.actualSpent)} / {formatCurrency(data.budget.periodAllocation)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-elevated)' }}>
                  <div
                    className="h-full transition-all rounded-full"
                    style={{
                      width: `${Math.min(100, data.budget.percentUsed)}%`,
                      backgroundColor:
                        data.budget.percentUsed > 100
                          ? 'var(--color-destructive)'
                          : data.budget.percentUsed > 80
                          ? 'var(--color-warning)'
                          : 'var(--color-primary)',
                    }}
                  />
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                  {new Decimal(data.budget.periodAllocation)
                    .minus(data.budget.actualSpent)
                    .toNumber() >= 0
                    ? `${formatCurrency(data.budget.remaining)} remaining`
                    : `${formatCurrency(Math.abs(data.budget.remaining))} over budget`}
                </p>
              </div>

              {/* Monthly context */}
              {data.currentPeriod.periodsInMonth > 1 && (
                <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                  This is {formatCurrency(data.budget.periodAllocation)} of your{' '}
                  {formatCurrency(data.budget.monthlyTotal)} monthly budget
                  (1/{data.currentPeriod.periodsInMonth} of the month)
                </p>
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* Discretionary Result */}
        <div
          className="py-3 px-4"
          style={{ background: `color-mix(in oklch, ${accentColor} 6%, transparent)` }}
        >
          <div className="flex items-center gap-2">
            <div style={{ color: accentColor }}>
              <DollarSign className="w-4 h-4 shrink-0" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.08em] font-medium" style={{ color: 'var(--color-muted-foreground)' }}>= Discretionary</div>
              <div
                className="font-mono font-bold"
                style={{
                  color: accentColor,
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: 'clamp(0.9rem, 5vw, 1.25rem)',
                  lineHeight: 1.2,
                }}
              >
                {formatCurrency(discretionary)}
              </div>
            </div>
          </div>
          <p className="text-[11px] mt-2 pl-8" style={{ color: 'var(--color-muted-foreground)' }}>
            Available for unplanned spending this period
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="py-2 px-3 border-t" style={{ backgroundColor: 'color-mix(in oklch, var(--color-elevated) 30%, transparent)', borderColor: 'var(--color-border)' }}>
        <Link
          href="/dashboard/settings?tab=financial"
          className="flex items-center justify-center gap-1.5 text-[11px] transition-colors hover:opacity-80"
          style={{ color: 'var(--color-muted-foreground)' }}
        >
          <Settings className="w-3 h-3" />
          Configure budget schedule in Settings
        </Link>
      </div>
    </div>
  );
}

