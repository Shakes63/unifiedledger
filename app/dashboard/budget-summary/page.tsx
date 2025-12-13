'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  DollarSign, 
  ShoppingCart, 
  Home, 
  CalendarDays,
  PiggyBank, 
  CreditCard,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { BudgetAllocationCard } from '@/components/budget-summary/budget-allocation-card';
import { MonthlySurplusCard } from '@/components/budget-summary/monthly-surplus-card';
import { BudgetAllocationChart } from '@/components/budget-summary/budget-allocation-chart';
import { AllocationTrendsChart } from '@/components/budget-summary/allocation-trends-chart';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';

interface CategoryDetail {
  id: string;
  name: string;
  budgeted: number;
  actual: number;
  percentage: number;
}

interface DebtDetail {
  id: string;
  name: string;
  creditorName: string;
  minimumPayment: number;
  additionalPayment: number;
  actualPaid: number;
  remainingBalance: number;
}

interface AllocationSummary {
  month: string;
  allocations: {
    income: {
      budgeted: number;
      actual: number;
      categories: CategoryDetail[];
    };
    variableExpenses: {
      budgeted: number;
      actual: number;
      categories: CategoryDetail[];
    };
    monthlyBills: {
      budgeted: number;
      actual: number;
      categories: CategoryDetail[];
    };
    nonMonthlyBills: {
      budgeted: number;
      actual: number;
      categories: CategoryDetail[];
    };
    savings: {
      budgeted: number;
      actual: number;
      categories: CategoryDetail[];
    };
    debtPayments: {
      minimumPayments: number;
      extraPayments: number;
      actualPaid: number;
      debts: DebtDetail[];
    };
  };
  summary: {
    totalIncomeBudgeted: number;
    totalIncomeActual: number;
    totalExpensesBudgeted: number;
    totalExpensesActual: number;
    totalSavingsBudgeted: number;
    totalSavingsActual: number;
    totalDebtPaymentsBudgeted: number;
    totalDebtPaymentsActual: number;
    budgetedSurplus: number;
    actualSurplus: number;
    allocationPercentages: {
      variableExpenses: number;
      monthlyBills: number;
      nonMonthlyBills: number;
      savings: number;
      debtPayments: number;
    };
  };
  trends?: {
    months: string[];
    income: number[];
    expenses: number[];
    savings: number[];
    surplus: number[];
  };
}

export default function BudgetSummaryPage() {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [data, setData] = useState<AllocationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  // Initialize selected month to current month
  useEffect(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(currentMonth);
  }, []);

  // Fetch data when month changes
  useEffect(() => {
    if (!selectedMonth || !selectedHouseholdId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetchWithHousehold(
          `/api/budgets/allocation-summary?month=${selectedMonth}&trends=true`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch budget allocation data');
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error('Error fetching budget allocation:', err);
        if (err instanceof Error && err.message === 'No household selected') {
          setLoading(false);
          return;
        }
        setError('Failed to load budget data. Please try again.');
        toast.error('Failed to load budget data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedMonth, selectedHouseholdId, fetchWithHousehold]);

  // Navigate to previous month
  const handlePreviousMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(prevMonth);
  };

  // Navigate to next month
  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(year, month, 1);
    const nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(nextMonth);
  };

  // Format month for display
  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header skeleton */}
          <div className="flex items-center justify-between mb-8">
            <div className="h-8 w-48 bg-elevated rounded animate-pulse" />
            <div className="h-10 w-48 bg-elevated rounded animate-pulse" />
          </div>
          
          {/* Chart skeleton */}
          <div className="h-80 bg-elevated rounded-xl animate-pulse mb-6" />
          
          {/* Cards grid skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-elevated rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="text-error mb-2">{error}</div>
              <button
                onClick={() => window.location.reload()}
                className="text-sm text-primary hover:opacity-80"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check if we have any budget data
  const hasBudgets = data && (
    data.summary.totalIncomeBudgeted > 0 ||
    data.summary.totalExpensesBudgeted > 0 ||
    data.summary.totalSavingsBudgeted > 0 ||
    data.summary.totalDebtPaymentsBudgeted > 0
  );

  // Empty state
  if (!hasBudgets) {
    return (
      <div className="p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Budget Summary</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePreviousMonth}
                className="p-2 hover:bg-elevated rounded-lg transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-5 h-5 text-foreground" />
              </button>
              <div className="text-base font-medium text-foreground min-w-[150px] text-center">
                {selectedMonth && formatMonth(selectedMonth)}
              </div>
              <button
                onClick={handleNextMonth}
                className="p-2 hover:bg-elevated rounded-lg transition-colors"
                aria-label="Next month"
              >
                <ChevronRight className="w-5 h-5 text-foreground" />
              </button>
            </div>
          </div>

          {/* Empty state */}
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-elevated flex items-center justify-center">
              <DollarSign className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              No Budget Set Up
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Set up your monthly budget to see a complete breakdown of your income, 
              expenses, savings, and debt payments.
            </p>
            <Link
              href="/dashboard/budgets"
              className="inline-flex items-center justify-center px-6 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              Set Up Budget
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Build chart data
  const chartData = {
    variableExpenses: data.allocations.variableExpenses.budgeted,
    monthlyBills: data.allocations.monthlyBills.budgeted,
    nonMonthlyBills: data.allocations.nonMonthlyBills.budgeted,
    savings: data.allocations.savings.budgeted,
    debtPayments: data.summary.totalDebtPaymentsBudgeted,
    surplus: Math.max(0, data.summary.budgetedSurplus),
    totalIncome: data.summary.totalIncomeBudgeted,
  };

  // Build debt categories for the allocation card
  const debtCategories: CategoryDetail[] = data.allocations.debtPayments.debts.map(debt => ({
    id: debt.id,
    name: debt.name,
    budgeted: debt.minimumPayment + debt.additionalPayment,
    actual: debt.actualPaid,
    percentage: (debt.minimumPayment + debt.additionalPayment) > 0
      ? (debt.actualPaid / (debt.minimumPayment + debt.additionalPayment)) * 100
      : 0,
  }));

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header with Month Navigation */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Budget Summary</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreviousMonth}
              className="p-2 hover:bg-elevated rounded-lg transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
            <div className="text-base font-medium text-foreground min-w-[150px] text-center">
              {formatMonth(selectedMonth)}
            </div>
            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-elevated rounded-lg transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="w-5 h-5 text-foreground" />
            </button>
          </div>
        </div>

        {/* Top Row: Chart + Surplus */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <BudgetAllocationChart data={chartData} />
          </div>
          <div>
            <MonthlySurplusCard 
              budgetedSurplus={data.summary.budgetedSurplus}
              actualSurplus={data.summary.actualSurplus}
              totalIncome={data.summary.totalIncomeActual}
            />
          </div>
        </div>

        {/* Allocation Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Income */}
          <BudgetAllocationCard
            title="Income"
            icon={<DollarSign className="w-5 h-5" />}
            budgeted={data.allocations.income.budgeted}
            actual={data.allocations.income.actual}
            color="var(--color-income)"
            type="income"
            categories={data.allocations.income.categories}
          />

          {/* Variable Expenses */}
          <BudgetAllocationCard
            title="Variable Expenses"
            icon={<ShoppingCart className="w-5 h-5" />}
            budgeted={data.allocations.variableExpenses.budgeted}
            actual={data.allocations.variableExpenses.actual}
            color="var(--color-expense)"
            type="expense"
            categories={data.allocations.variableExpenses.categories}
          />

          {/* Monthly Bills */}
          <BudgetAllocationCard
            title="Monthly Bills"
            icon={<Home className="w-5 h-5" />}
            budgeted={data.allocations.monthlyBills.budgeted}
            actual={data.allocations.monthlyBills.actual}
            color="var(--color-transfer)"
            type="expense"
            categories={data.allocations.monthlyBills.categories}
          />

          {/* Non-Monthly Bills */}
          {data.allocations.nonMonthlyBills.budgeted > 0 && (
            <BudgetAllocationCard
              title="Non-Monthly Bills"
              icon={<CalendarDays className="w-5 h-5" />}
              budgeted={data.allocations.nonMonthlyBills.budgeted}
              actual={data.allocations.nonMonthlyBills.actual}
              color="var(--color-warning)"
              type="expense"
              categories={data.allocations.nonMonthlyBills.categories}
            />
          )}

          {/* Savings */}
          <BudgetAllocationCard
            title="Savings"
            icon={<PiggyBank className="w-5 h-5" />}
            budgeted={data.allocations.savings.budgeted}
            actual={data.allocations.savings.actual}
            color="var(--color-success)"
            type="savings"
            categories={data.allocations.savings.categories}
          />

          {/* Debt Payments */}
          {data.summary.totalDebtPaymentsBudgeted > 0 && (
            <BudgetAllocationCard
              title="Debt Payments"
              icon={<CreditCard className="w-5 h-5" />}
              budgeted={data.summary.totalDebtPaymentsBudgeted}
              actual={data.summary.totalDebtPaymentsActual}
              color="var(--color-error)"
              type="debt"
              categories={debtCategories}
            />
          )}
        </div>

        {/* Allocation Percentages Summary */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground mb-4">Budget Allocation</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Variable Expenses</p>
              <p className="text-lg font-bold text-expense">
                {data.summary.allocationPercentages.variableExpenses}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Monthly Bills</p>
              <p className="text-lg font-bold text-transfer">
                {data.summary.allocationPercentages.monthlyBills}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Non-Monthly Bills</p>
              <p className="text-lg font-bold text-warning">
                {data.summary.allocationPercentages.nonMonthlyBills}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Savings</p>
              <p className="text-lg font-bold text-success">
                {data.summary.allocationPercentages.savings}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Debt Payments</p>
              <p className="text-lg font-bold text-error">
                {data.summary.allocationPercentages.debtPayments}%
              </p>
            </div>
          </div>
        </div>

        {/* Trends Chart */}
        {data.trends && (
          <AllocationTrendsChart data={data.trends} />
        )}
      </div>
    </div>
  );
}

