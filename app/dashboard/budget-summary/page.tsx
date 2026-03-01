'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, DollarSign, ShoppingCart, PiggyBank, CreditCard, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    income: { budgeted: number; actual: number; categories: CategoryDetail[] };
    expenses: { budgeted: number; actual: number; categories: CategoryDetail[] };
    savings: { budgeted: number; actual: number; categories: CategoryDetail[] };
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
      expenses: number;
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

function fmtMonth(monthStr: string) {
  const [year, month] = monthStr.split('-');
  return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export default function BudgetSummaryPage() {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [data, setData] = useState<AllocationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  useEffect(() => {
    const now = new Date();
    setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  }, []);

  useEffect(() => {
    if (!selectedMonth || !selectedHouseholdId) { setLoading(false); return; }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchWithHousehold(
          `/api/budgets/allocation-summary?month=${selectedMonth}&trends=true`
        );
        if (!res.ok) throw new Error('Failed to fetch budget allocation data');
        setData(await res.json());
      } catch (err) {
        console.error(err);
        if (err instanceof Error && err.message === 'No household selected') { setLoading(false); return; }
        setError('Failed to load budget data.');
        toast.error('Failed to load budget data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedMonth, selectedHouseholdId, fetchWithHousehold]);

  const navigate = (dir: 1 | -1) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
        <div style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
              <div className="w-36 h-5 rounded animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
            </div>
            <div className="w-32 h-7 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
          <div className="h-36 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)' }} />
          <div className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)' }} />
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-40 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)', animationDelay: `${i * 60}ms` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-background)' }}>
        <div className="text-center">
          <p className="text-sm mb-2" style={{ color: 'var(--color-error)' }}>{error}</p>
          <button onClick={() => window.location.reload()} className="text-sm" style={{ color: 'var(--color-primary)' }}>Try again</button>
        </div>
      </div>
    );
  }

  const hasBudgets = data && (
    data.summary.totalIncomeBudgeted > 0 ||
    data.summary.totalExpensesBudgeted > 0 ||
    data.summary.totalSavingsBudgeted > 0 ||
    data.summary.totalDebtPaymentsBudgeted > 0
  );

  // ── Sticky header (shared across all states) ──────────────────────────────
  const Header = () => (
    <header className="sticky top-0 z-50">
      <div
        className="backdrop-blur-xl"
        style={{ backgroundColor: 'color-mix(in oklch, var(--color-background) 82%, transparent)' }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-foreground)' }}>
              Budget Insights
            </h1>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => navigate(-1)}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="text-sm font-semibold tabular-nums min-w-[120px] text-center" style={{ color: 'var(--color-foreground)' }}>
              {selectedMonth ? fmtMonth(selectedMonth) : '…'}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => navigate(1)}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>

          <Link href="/dashboard/budgets">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 px-3 text-xs font-medium">
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Budget Planner</span>
            </Button>
          </Link>
        </div>
      </div>
      <div
        className="h-px"
        style={{
          background: 'linear-gradient(to right, transparent 5%, var(--color-border) 20%, color-mix(in oklch, var(--color-primary) 45%, var(--color-border)) 50%, var(--color-border) 80%, transparent 95%)',
        }}
      />
    </header>
  );

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!hasBudgets) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
        <Header />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4"
            style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 12%, transparent)' }}
          >
            <BarChart3 className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
          </div>
          <p className="font-medium mb-1" style={{ color: 'var(--color-foreground)' }}>No budget set up yet</p>
          <p className="text-sm mb-6" style={{ color: 'var(--color-muted-foreground)' }}>
            Set up your monthly budget to see a complete breakdown of your income, expenses, savings, and debt.
          </p>
          <Link href="/dashboard/budgets">
            <Button size="sm" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
              Set Up Budget
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // ── Build derived data ────────────────────────────────────────────────────
  const chartData = {
    expenses: data.allocations.expenses.budgeted,
    savings: data.allocations.savings.budgeted,
    debtPayments: data.summary.totalDebtPaymentsBudgeted,
    surplus: Math.max(0, data.summary.budgetedSurplus),
    totalIncome: data.summary.totalIncomeBudgeted,
  };

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
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      <Header />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* ── Hero: Surplus + Allocation bar ────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Surplus hero card */}
          <div className="lg:col-span-2">
            <MonthlySurplusCard
              budgetedSurplus={data.summary.budgetedSurplus}
              actualSurplus={data.summary.actualSurplus}
              totalIncome={data.summary.totalIncomeActual}
            />
          </div>

          {/* Allocation donut / bar */}
          <div className="lg:col-span-3">
            <BudgetAllocationChart data={chartData} />
          </div>
        </div>

        {/* ── Allocation cards ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <BudgetAllocationCard
            title="Income"
            icon={<DollarSign className="w-4 h-4" />}
            budgeted={data.allocations.income.budgeted}
            actual={data.allocations.income.actual}
            color="var(--color-income)"
            type="income"
            categories={data.allocations.income.categories}
          />
          <BudgetAllocationCard
            title="Expenses"
            icon={<ShoppingCart className="w-4 h-4" />}
            budgeted={data.allocations.expenses.budgeted}
            actual={data.allocations.expenses.actual}
            color="var(--color-expense)"
            type="expense"
            categories={data.allocations.expenses.categories}
          />
          <BudgetAllocationCard
            title="Savings"
            icon={<PiggyBank className="w-4 h-4" />}
            budgeted={data.allocations.savings.budgeted}
            actual={data.allocations.savings.actual}
            color="var(--color-success)"
            type="savings"
            categories={data.allocations.savings.categories}
          />
          {data.summary.totalDebtPaymentsBudgeted > 0 && (
            <BudgetAllocationCard
              title="Debt Payments"
              icon={<CreditCard className="w-4 h-4" />}
              budgeted={data.summary.totalDebtPaymentsBudgeted}
              actual={data.summary.totalDebtPaymentsActual}
              color="var(--color-error)"
              type="debt"
              categories={debtCategories}
            />
          )}
        </div>

        {/* ── Trends chart ──────────────────────────────────────────────── */}
        {data.trends && <AllocationTrendsChart data={data.trends} />}
      </main>
    </div>
  );
}
