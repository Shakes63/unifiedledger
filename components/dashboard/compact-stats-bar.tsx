'use client';

import { useEffect, useState } from 'react';
import { Wallet, TrendingUp, Calendar, Target, TrendingDown } from 'lucide-react';
import Decimal from 'decimal.js';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';

interface StatCardData {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  loading: boolean;
}

export function CompactStatsBar() {
  const { initialized, loading: householdLoading, selectedHouseholdId: householdId } = useHousehold();
  const { fetchWithHousehold, selectedHouseholdId } = useHouseholdFetch();
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [monthlySpending, setMonthlySpending] = useState<number>(0);
  const [billsDueCount, setBillsDueCount] = useState<number>(0);
  const [budgetAdherence, setBudgetAdherence] = useState<number | null>(null);
  const [debtProgress, setDebtProgress] = useState<number | null>(null);
  const [goalsProgress, setGoalsProgress] = useState<number | null>(null);
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

        // Fetch accounts for total balance
        const accountsResponse = await fetchWithHousehold('/api/accounts');
        if (accountsResponse.ok) {
          const accountsData = await accountsResponse.json();
          const total = accountsData.reduce((sum: number, account: any) => {
            return new Decimal(sum).plus(new Decimal(account.currentBalance || 0)).toNumber();
          }, 0);
          setTotalBalance(total);
        }

        // Fetch transactions for monthly spending
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const txResponse = await fetchWithHousehold('/api/transactions?limit=1000');
        if (txResponse.ok) {
          const txData = await txResponse.json();
          const monthlyExpenses = txData.filter((tx: any) => {
            const txDate = new Date(tx.date);
            return tx.type === 'expense' &&
                   txDate >= firstDayOfMonth &&
                   txDate <= lastDayOfMonth;
          });
          const total = monthlyExpenses.reduce((sum: number, tx: any) => {
            return new Decimal(sum).plus(new Decimal(tx.amount || 0)).toNumber();
          }, 0);
          setMonthlySpending(total);
        }

        // Fetch bills for pending count
        const billsResponse = await fetchWithHousehold('/api/bills/instances?status=pending&sortBy=dueDate');
        if (billsResponse.ok) {
          const billsData = await billsResponse.json();
          const rawData = Array.isArray(billsData) ? billsData : billsData.data || [];

          // Filter for this month only
          const thisMonthBills = rawData.filter((row: any) => {
            const dueDate = new Date(row.instance.dueDate);
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
              (c: any) => c.monthlyBudget > 0
            );
            if (categoriesWithBudgets.length > 0) {
              setBudgetAdherence(budgetData.summary.adherenceScore || 0);
            }
          }
        } catch (err) {
          // Budget data not available, skip
        }

        // Fetch debt progress (optional - only if user has debts)
        try {
          const debtsResponse = await fetchWithHousehold('/api/debts');
          if (debtsResponse.ok) {
            const debtsData = await debtsResponse.json();
            if (debtsData.length > 0) {
              // Calculate total debt paid percentage
              const totalOriginal = debtsData.reduce((sum: number, debt: any) => {
                return new Decimal(sum).plus(new Decimal(debt.originalBalance || debt.currentBalance || 0)).toNumber();
              }, 0);
              const totalCurrent = debtsData.reduce((sum: number, debt: any) => {
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
        } catch (err) {
          // Debt data not available, skip
        }

        // Fetch goals progress (optional - only if user has active goals)
        try {
          const goalsResponse = await fetchWithHousehold('/api/savings-goals?status=active');
          if (goalsResponse.ok) {
            const goalsData = await goalsResponse.json();
            if (Array.isArray(goalsData) && goalsData.length > 0) {
              const totalTarget = goalsData.reduce((sum: number, g: any) => {
                return new Decimal(sum).plus(new Decimal(g.targetAmount || 0)).toNumber();
              }, 0);
              const totalSaved = goalsData.reduce((sum: number, g: any) => {
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
        } catch (err) {
          // Goals data not available, skip
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
      label: 'Total Balance',
      value: loading ? '...' : `$${totalBalance.toFixed(2)}`,
      icon: <Wallet className="w-5 h-5" />,
      color: 'var(--color-income)',
      loading,
    },
    {
      label: 'Monthly Spending',
      value: loading ? '...' : `$${monthlySpending.toFixed(2)}`,
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
    },
  ];

  // Add budget adherence if available
  if (budgetAdherence !== null) {
    stats.push({
      label: 'Budget Adherence',
      value: loading ? '...' : `${budgetAdherence.toFixed(0)}%`,
      icon: <Target className="w-5 h-5" />,
      color: budgetAdherence >= 70 ? 'var(--color-success)' : budgetAdherence >= 50 ? 'var(--color-warning)' : 'var(--color-error)',
      loading,
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

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      {stats.map((stat, index) => (
        <div
          key={index}
          className="relative p-4 rounded-lg border transition-all hover:bg-elevated"
          style={{
            backgroundColor: 'var(--color-card)',
            borderColor: 'var(--color-border)',
          }}
        >
          {stat.loading ? (
            <div className="animate-pulse">
              <div className="h-4 w-16 rounded mb-2" style={{ backgroundColor: 'var(--color-elevated)' }}></div>
              <div className="h-6 w-20 rounded" style={{ backgroundColor: 'var(--color-elevated)' }}></div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-1">
                <div style={{ color: stat.color }}>
                  {stat.icon}
                </div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
              <p
                className="text-lg font-bold truncate"
                style={{ color: 'var(--color-foreground)' }}
              >
                {stat.value}
              </p>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
