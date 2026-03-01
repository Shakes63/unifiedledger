'use client';

import { useEffect, useState } from 'react';
import { Wallet, TrendingUp, Calendar, Target, TrendingDown, HelpCircle, CreditCard, DollarSign } from 'lucide-react';
import Decimal from 'decimal.js';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Account type groupings
const CASH_ACCOUNT_TYPES = ['checking', 'savings', 'cash', 'investment'];
const CREDIT_ACCOUNT_TYPES = ['credit', 'line_of_credit'];

interface StatCardData {
  label: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  loading: boolean;
  tooltip?: string;
}

interface DiscretionaryData {
  projectedDiscretionary: number;
  expectedDiscretionary: number;
  periodLabel: string;
  daysRemaining: number;
  frequency: string;
  incomeExpected: number;
  incomeActual: number;
  billsTotal: number;
  billsPending: number;
  budgetAllocation: number;
  accountBalance: number;
}

export function CompactStatsBar() {
  const { initialized, loading: householdLoading, selectedHouseholdId: householdId } = useHousehold();
  const { fetchWithHousehold, selectedHouseholdId } = useHouseholdFetch();
  const [cashBalance, setCashBalance] = useState<number>(0);
  const [creditUsed, setCreditUsed] = useState<number>(0);
  const [availableCredit, setAvailableCredit] = useState<number>(0);
  const [hasCreditAccounts, setHasCreditAccounts] = useState(false);
  const [monthlySpending, setMonthlySpending] = useState<number>(0);
  const [billsDueCount, setBillsDueCount] = useState<number>(0);
  const [budgetAdherence, setBudgetAdherence] = useState<number | null>(null);
  const [debtProgress, setDebtProgress] = useState<number | null>(null);
  const [goalsProgress, setGoalsProgress] = useState<number | null>(null);
  const [discretionaryData, setDiscretionaryData] = useState<DiscretionaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Don't fetch if household context isn't initialized yet
    if (!initialized || householdLoading) {
      return;
    }

    // Don't fetch if no household is selected
    if (!selectedHouseholdId || !householdId) {
      setLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        setLoading(true);

        // Fetch accounts and split by type
        const accountsResponse = await fetchWithHousehold('/api/accounts');
        if (accountsResponse.ok) {
          const accountsData = await accountsResponse.json();
          
          // Filter accounts by type
          const cashAccounts = accountsData.filter((acc: { type: string }) => 
            CASH_ACCOUNT_TYPES.includes(acc.type)
          );
          const creditAccounts = accountsData.filter((acc: { type: string }) => 
            CREDIT_ACCOUNT_TYPES.includes(acc.type)
          );
          
          // Calculate cash balance
          const cashSum = cashAccounts.reduce((sum: number, acc: { currentBalance?: number }) => {
            return new Decimal(sum).plus(new Decimal(acc.currentBalance || 0)).toNumber();
          }, 0);
          setCashBalance(cashSum);
          
          // Calculate credit used and available
          if (creditAccounts.length > 0) {
            setHasCreditAccounts(true);
            const creditSum = creditAccounts.reduce((sum: number, acc: { currentBalance?: number }) => {
              return new Decimal(sum).plus(new Decimal(Math.abs(acc.currentBalance || 0))).toNumber();
            }, 0);
            const limitSum = creditAccounts.reduce((sum: number, acc: { creditLimit?: number }) => {
              return new Decimal(sum).plus(new Decimal(acc.creditLimit || 0)).toNumber();
            }, 0);
            setCreditUsed(creditSum);
            setAvailableCredit(new Decimal(limitSum).minus(creditSum).toNumber());
          } else {
            setHasCreditAccounts(false);
          }
        }

        // Fetch transactions for monthly spending
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const txResponse = await fetchWithHousehold('/api/transactions?limit=1000');
        if (txResponse.ok) {
          const txData = await txResponse.json();
          const transactions = Array.isArray(txData) ? txData : txData.data || [];
          const monthlyExpenses = transactions.filter((tx: { date: string; type: string; amount?: number }) => {
            const txDate = new Date(tx.date);
            return tx.type === 'expense' &&
                   txDate >= firstDayOfMonth &&
                   txDate <= lastDayOfMonth;
          });
          const total = monthlyExpenses.reduce((sum: number, tx: { amount?: number }) => {
            return new Decimal(sum).plus(new Decimal(tx.amount || 0)).toNumber();
          }, 0);
          setMonthlySpending(total);
        }

        // Fetch bills for pending count
        const billsResponse = await fetchWithHousehold('/api/bills/occurrences?status=unpaid,partial&limit=1000');
        if (billsResponse.ok) {
          const billsData = await billsResponse.json();
          const rawData = Array.isArray(billsData?.data) ? billsData.data : [];

          // Filter for this month only
          const thisMonthBills = rawData.filter((row: { occurrence: { dueDate: string } }) => {
            const dueDate = new Date(row.occurrence.dueDate);
            return dueDate >= firstDayOfMonth && dueDate <= lastDayOfMonth;
          });
          setBillsDueCount(thisMonthBills.length);
        }

        // Fetch budget adherence (optional - only if user has budgets)
        try {
          const budgetResponse = await fetchWithHousehold('/api/budgets/overview');
          if (budgetResponse.ok) {
            const budgetData = await budgetResponse.json();
            const categoriesWithBudgets = budgetData.categories.filter(
              (c: { monthlyBudget: number }) => c.monthlyBudget > 0
            );
            if (categoriesWithBudgets.length > 0) {
              setBudgetAdherence(budgetData.summary.adherenceScore || 0);
            }
          }
        } catch (_err) {
          // Budget data not available, skip
        }

        // Fetch debt progress (optional - only if user has debts)
        try {
          const debtsResponse = await fetchWithHousehold('/api/debts');
          if (debtsResponse.ok) {
            const debtsData = await debtsResponse.json();
            if (debtsData.length > 0) {
              // Calculate total debt paid percentage
              const totalOriginal = debtsData.reduce((sum: number, debt: { originalBalance?: number; currentBalance?: number }) => {
                return new Decimal(sum).plus(new Decimal(debt.originalBalance || debt.currentBalance || 0)).toNumber();
              }, 0);
              const totalCurrent = debtsData.reduce((sum: number, debt: { currentBalance?: number }) => {
                return new Decimal(sum).plus(new Decimal(debt.currentBalance || 0)).toNumber();
              }, 0);
              if (totalOriginal > 0) {
                const percentPaid = new Decimal(totalOriginal)
                  .minus(totalCurrent)
                  .div(totalOriginal)
                  .times(100)
                  .toNumber();
                setDebtProgress(Math.min(100, Math.max(0, percentPaid)));
              }
            }
          }
        } catch (_err) {
          // Debt data not available, skip
        }

        // Fetch goals progress (optional - only if user has active goals)
        try {
          const goalsResponse = await fetchWithHousehold('/api/savings-goals?status=active');
          if (goalsResponse.ok) {
            const goalsData = await goalsResponse.json();
            if (Array.isArray(goalsData) && goalsData.length > 0) {
              const totalTarget = goalsData.reduce((sum: number, g: { targetAmount?: number }) => {
                return new Decimal(sum).plus(new Decimal(g.targetAmount || 0)).toNumber();
              }, 0);
              const totalSaved = goalsData.reduce((sum: number, g: { currentAmount?: number }) => {
                return new Decimal(sum).plus(new Decimal(g.currentAmount || 0)).toNumber();
              }, 0);
              if (totalTarget > 0) {
                const progressPercent = new Decimal(totalSaved)
                  .div(totalTarget)
                  .times(100)
                  .toNumber();
                setGoalsProgress(Math.min(100, Math.max(0, progressPercent)));
              }
            }
          }
        } catch (_err) {
          // Goals data not available, skip
        }

        // Fetch paycheck balance / discretionary amount
        try {
          const periodResponse = await fetch(
            `/api/budget-schedule/paycheck-balance?householdId=${selectedHouseholdId}`,
            { credentials: 'include' }
          );
          if (periodResponse.ok) {
            const periodData = await periodResponse.json();
            // Show discretionary for all budget frequencies
            setDiscretionaryData({
              projectedDiscretionary: periodData.discretionary?.projectedDiscretionary ?? 0,
              expectedDiscretionary: periodData.discretionary?.expectedDiscretionary ?? 0,
              periodLabel: periodData.currentPeriod?.label || 'This Period',
              daysRemaining: periodData.currentPeriod?.daysRemaining ?? 0,
              frequency: periodData.settings?.frequency || 'monthly',
              incomeExpected: periodData.income?.expected ?? 0,
              incomeActual: periodData.income?.actual ?? 0,
              billsTotal: periodData.bills?.total ?? 0,
              billsPending: periodData.bills?.pending ?? 0,
              budgetAllocation: periodData.budget?.periodAllocation ?? 0,
              accountBalance: periodData.accounts?.includedBalance ?? 0,
            });
          }
        } catch (_err) {
          // Discretionary data not available, skip
        }
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [initialized, householdLoading, selectedHouseholdId, householdId, fetchWithHousehold]);

  const stats: StatCardData[] = [
    {
      label: 'Cash Balance',
      value: loading ? '...' : `$${cashBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: <Wallet className="w-5 h-5" />,
      color: 'var(--color-income)',
      loading,
      tooltip: 'Total balance across checking, savings, cash, and investment accounts',
    },
  ];

  // Add credit stats only if user has credit accounts
  if (hasCreditAccounts) {
    stats.push({
      label: 'Credit Used',
      value: loading ? '...' : `$${creditUsed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: <CreditCard className="w-5 h-5" />,
      color: 'var(--color-error)',
      loading,
      tooltip: `Available: $${availableCredit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    });
  }

  stats.push(
    {
      label: 'Monthly Spending',
      value: loading ? '...' : `$${monthlySpending.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'var(--color-expense)',
      loading,
    },
    {
      label: 'Bills Due',
      value: loading ? '...' : `${billsDueCount} pending`,
      icon: <Calendar className="w-5 h-5" />,
      color: 'var(--color-warning)',
      loading,
    }
  );

  // Add budget adherence if available
  if (budgetAdherence !== null) {
    stats.push({
      label: 'Budget Adherence',
      value: loading ? '...' : `${budgetAdherence.toFixed(0)}%`,
      icon: <Target className="w-5 h-5" />,
      color: budgetAdherence >= 70 ? 'var(--color-success)' : budgetAdherence >= 50 ? 'var(--color-warning)' : 'var(--color-error)',
      loading,
      tooltip: 'Budget Adherence measures how well you stay within your set budget limits.\n\n90%+ Excellent - On track\n70-89% Good - Minor adjustments needed\n50-69% Fair - Review spending\nBelow 50% Needs work',
    });
  }

  // Add debt progress if available
  if (debtProgress !== null) {
    stats.push({
      label: 'Debt Paid Off',
      value: loading ? '...' : `${debtProgress.toFixed(0)}%`,
      icon: <TrendingDown className="w-5 h-5" />,
      color: 'var(--color-transfer)',
      loading,
    });
  }

  // Add goals progress if available
  if (goalsProgress !== null) {
    stats.push({
      label: 'Goals Progress',
      value: loading ? '...' : `${goalsProgress.toFixed(0)}%`,
      icon: <Target className="w-5 h-5" />,
      color: goalsProgress >= 70 ? 'var(--color-success)' : goalsProgress >= 30 ? 'var(--color-warning)' : 'var(--color-error)',
      loading,
    });
  }

  // Add discretionary amount at the start (most prominent position)
  if (discretionaryData !== null) {
    const discretionary = discretionaryData.projectedDiscretionary;
    const isPositive = discretionary >= 0;
    const discretionaryColor = isPositive ? 'var(--color-success)' : 'var(--color-error)';
    
    // Build tooltip with breakdown
    const tooltipLines = [
      `${discretionaryData.periodLabel}`,
      `${discretionaryData.daysRemaining} days remaining`,
      '',
      'Calculation:',
      `  Account Balance: $${discretionaryData.accountBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    ];
    
    if (discretionaryData.incomeExpected > 0) {
      const incomeStatus = discretionaryData.incomeActual > 0 
        ? `$${discretionaryData.incomeActual.toLocaleString('en-US', { minimumFractionDigits: 2 })} received`
        : `$${discretionaryData.incomeExpected.toLocaleString('en-US', { minimumFractionDigits: 2 })} expected`;
      tooltipLines.push(`  + Income: ${incomeStatus}`);
    }
    
    if (discretionaryData.billsTotal > 0) {
      const billsStatus = discretionaryData.billsPending > 0
        ? `$${discretionaryData.billsPending.toLocaleString('en-US', { minimumFractionDigits: 2 })} pending`
        : 'all paid';
      tooltipLines.push(`  - Bills: ${billsStatus}`);
    }
    
    if (discretionaryData.budgetAllocation > 0) {
      tooltipLines.push(`  - Budget: $${discretionaryData.budgetAllocation.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    }
    
    stats.unshift({
      label: `Discretionary`,
      value: loading 
        ? '...' 
        : `${isPositive ? '' : '-'}$${Math.abs(discretionary).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      subtitle: `${discretionaryData.daysRemaining} days left`,
      icon: <DollarSign className="w-5 h-5" />,
      color: discretionaryColor,
      loading,
      tooltip: tooltipLines.join('\n'),
    });
  }

  const heroStat = discretionaryData !== null ? stats[0] : null;
  const supportingStats = discretionaryData !== null ? stats.slice(1) : stats;

  return (
    <TooltipProvider>
      <div className="space-y-3">
        {/* Hero Discretionary Card */}
        {heroStat && discretionaryData && !heroStat.loading && (
          <div
            className="relative overflow-hidden rounded-xl border p-5 dashboard-fade-in"
            style={{
              backgroundColor: 'var(--color-background)',
              borderColor: 'var(--color-border)',
            }}
          >
            <div
              className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full"
              style={{ backgroundColor: heroStat.color }}
            />
            <div
              className="absolute -top-24 -right-24 w-64 h-64 rounded-full pointer-events-none"
              style={{
                background: `radial-gradient(circle, ${heroStat.color}, transparent 70%)`,
                opacity: 0.04,
              }}
            />

            <div className="relative flex items-start justify-between pl-3">
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{
                      backgroundColor: `color-mix(in oklch, ${heroStat.color} 12%, transparent)`,
                      color: heroStat.color,
                    }}
                  >
                    {heroStat.icon}
                  </div>
                  {heroStat.tooltip ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1.5 cursor-help">
                          <span className="text-sm font-medium" style={{ color: 'var(--color-muted-foreground)' }}>
                            {heroStat.label}
                          </span>
                          <HelpCircle className="w-3.5 h-3.5" style={{ color: 'var(--color-muted-foreground)' }} />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs whitespace-pre-line">
                        <p className="text-sm">{heroStat.tooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-sm font-medium" style={{ color: 'var(--color-muted-foreground)' }}>
                      {heroStat.label}
                    </span>
                  )}
                </div>
                <p
                  className="text-3xl font-bold tracking-tight"
                  style={{ color: heroStat.color }}
                >
                  {heroStat.value}
                </p>
              </div>

              <div className="flex flex-col items-end gap-1.5">
                <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                  {discretionaryData.periodLabel}
                </span>
                <span
                  className="px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: 'var(--color-elevated)',
                    color: 'var(--color-muted-foreground)',
                  }}
                >
                  {discretionaryData.daysRemaining}d remaining
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Hero Loading Skeleton */}
        {loading && (
          <div
            className="rounded-xl border p-5 animate-pulse"
            style={{
              backgroundColor: 'var(--color-background)',
              borderColor: 'var(--color-border)',
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <div
                    className="w-9 h-9 rounded-lg"
                    style={{ backgroundColor: 'var(--color-elevated)' }}
                  />
                  <div
                    className="h-4 w-24 rounded"
                    style={{ backgroundColor: 'var(--color-elevated)' }}
                  />
                </div>
                <div
                  className="h-9 w-40 rounded"
                  style={{ backgroundColor: 'var(--color-elevated)' }}
                />
              </div>
              <div
                className="h-7 w-24 rounded-full"
                style={{ backgroundColor: 'var(--color-elevated)' }}
              />
            </div>
          </div>
        )}

        {/* Supporting Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
          {supportingStats.map((stat, index) => (
            <div
              key={index}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all hover:bg-(--color-elevated) dashboard-fade-in"
              style={{
                backgroundColor: 'var(--color-background)',
                borderColor: 'var(--color-border)',
                animationDelay: `${(index + 1) * 60}ms`,
              }}
            >
              {stat.loading ? (
                <div className="animate-pulse flex items-center gap-2.5 w-full">
                  <div
                    className="w-8 h-8 rounded-lg shrink-0"
                    style={{ backgroundColor: 'var(--color-elevated)' }}
                  />
                  <div className="flex-1">
                    <div
                      className="h-3 w-14 rounded mb-1.5"
                      style={{ backgroundColor: 'var(--color-elevated)' }}
                    />
                    <div
                      className="h-4 w-20 rounded"
                      style={{ backgroundColor: 'var(--color-elevated)' }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: `color-mix(in oklch, ${stat.color} 12%, transparent)`,
                      color: stat.color,
                    }}
                  >
                    {stat.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    {stat.tooltip ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1 cursor-help">
                            <p className="text-xs truncate" style={{ color: 'var(--color-muted-foreground)' }}>
                              {stat.label}
                            </p>
                            <HelpCircle className="w-2.5 h-2.5 shrink-0" style={{ color: 'var(--color-muted-foreground)' }} />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs whitespace-pre-line">
                          <p className="text-sm">{stat.tooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <p className="text-xs truncate" style={{ color: 'var(--color-muted-foreground)' }}>{stat.label}</p>
                    )}
                    <p className="text-sm font-bold truncate" style={{ color: 'var(--color-foreground)' }}>
                      {stat.value}
                    </p>
                    {stat.subtitle && (
                      <p className="text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>{stat.subtitle}</p>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
