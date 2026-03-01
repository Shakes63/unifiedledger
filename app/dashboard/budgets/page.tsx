'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, Settings2, Copy, ChevronDown, ChevronUp, PiggyBank } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BudgetSummaryCard, type DebtBudgetData } from '@/components/budgets/budget-summary-card';
import { CategoryBudgetProgress } from '@/components/budgets/category-budget-progress';
import { BudgetGroupSection } from '@/components/budgets/budget-group-section';
import { BudgetManagerModal } from '@/components/budgets/budget-manager-modal';
import { VariableBillTracker } from '@/components/budgets/variable-bill-tracker';
import { BudgetAnalyticsSection } from '@/components/budgets/budget-analytics-section';
import { UnifiedDebtBudgetSection } from '@/components/budgets/unified-debt-budget-section';
import { RolloverSummary } from '@/components/budgets/rollover-summary';
import { toast } from 'sonner';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';

interface CategoryData {
  id: string;
  name: string;
  type: string;
  monthlyBudget: number;
  actualSpent: number;
  remaining: number;
  percentage: number;
  status: 'on_track' | 'warning' | 'exceeded' | 'unbudgeted';
  dailyAverage: number;
  budgetedDailyAverage: number;
  projectedMonthEnd: number;
  isOverBudget: boolean;
  incomeFrequency?: 'weekly' | 'biweekly' | 'monthly' | 'variable';
  shouldShowDailyAverage: boolean;
  rolloverEnabled?: boolean;
  rolloverBalance?: number;
  rolloverLimit?: number | null;
  effectiveBudget?: number;
  parentId?: string | null;
  isBudgetGroup?: boolean;
}

interface BudgetOverview {
  month: string;
  summary: {
    totalIncome: number;
    totalIncomeActual: number;
    totalExpenseBudget: number;
    totalExpenseActual: number;
    totalSavingsBudget: number;
    totalSavingsActual: number;
    budgetedSurplus: number;
    actualSurplus: number;
    adherenceScore: number;
    daysInMonth: number;
    daysRemaining: number;
    daysElapsed: number;
  };
  categories: CategoryData[];
  groupedCategories: {
    income: CategoryData[];
    expenses: CategoryData[];
    savings: CategoryData[];
    bills?: CategoryData[];
  };
}

interface BudgetGroup {
  id: string;
  name: string;
  type: string;
  targetAllocation: number | null;
  children: Array<{ id: string; name: string; type: string; monthlyBudget: number }>;
  totalBudget: number;
  totalSpent: number;
}

interface UnifiedDebtBudgetResponse {
  totalBudgetedPayments: number;
  totalActualPaid: number;
  strategyDebts: { items: Array<{ id: string }> };
  manualDebts: Array<{ id: string }>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtMonth(monthStr: string) {
  const [year, month] = monthStr.split('-');
  return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

// ── Section list container ────────────────────────────────────────────────────
function SectionContainer({
  label,
  totalBudget,
  totalSpent,
  categories,
  daysRemaining,
  onEdit,
  accent,
}: {
  label: string;
  totalBudget: number;
  totalSpent: number;
  categories: CategoryData[];
  daysRemaining: number;
  onEdit: (id: string, v: number) => void;
  accent: string;
}) {
  if (categories.length === 0) return null;

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-3 mb-2">
        <span
          className="text-[11px] font-semibold uppercase tracking-widest shrink-0"
          style={{ color: accent }}
        >
          {label}
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 50%, transparent)' }} />
        <span className="text-[11px] font-mono tabular-nums shrink-0" style={{ color: 'var(--color-muted-foreground)' }}>
          ${fmt(totalSpent)} <span style={{ color: 'color-mix(in oklch, var(--color-muted-foreground) 50%, transparent)' }}>/ ${fmt(totalBudget)}</span>
        </span>
      </div>

      {/* Connected list */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
      >
        {categories.map((cat, i) => (
          <div
            key={cat.id}
            className="tx-row-enter"
            style={{
              animationDelay: `${i * 25}ms`,
              borderBottom: i < categories.length - 1
                ? '1px solid color-mix(in oklch, var(--color-border) 35%, transparent)'
                : 'none',
            }}
          >
            <CategoryBudgetProgress
              category={cat}
              daysRemaining={daysRemaining}
              onEdit={onEdit}
              listRow
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Collapsible section ───────────────────────────────────────────────────────
function CollapsibleSection({
  label,
  expanded,
  onToggle,
  children,
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1.25rem' }}>
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full text-left mb-3"
      >
        <span className="text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>
          {label}
        </span>
        {expanded
          ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--color-muted-foreground)' }} />
          : <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-muted-foreground)' }} />}
      </button>
      {expanded && children}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function BudgetsPage() {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold, postWithHousehold } = useHouseholdFetch();
  const [budgetData, setBudgetData] = useState<BudgetOverview | null>(null);
  const [debtBudgetData, setDebtBudgetData] = useState<DebtBudgetData | null>(null);
  const [budgetGroups, setBudgetGroups] = useState<BudgetGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    variableBills: false,
    rollover: false,
    analytics: false,
  });

  useEffect(() => {
    const saved = localStorage.getItem('budget-section-expanded');
    if (saved) { try { setExpandedSections(JSON.parse(saved)); } catch { /* ignore */ } }
  }, []);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = { ...prev, [section]: !prev[section] };
      localStorage.setItem('budget-section-expanded', JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    const now = new Date();
    setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  }, []);

  useEffect(() => {
    if (!selectedMonth || !selectedHouseholdId) { setLoading(false); return; }

    const fetch = async () => {
      try {
        setLoading(true);
        setError(null);
        const [overviewRes, groupsRes, debtsRes] = await Promise.all([
          fetchWithHousehold(`/api/budgets/overview?month=${selectedMonth}`),
          fetchWithHousehold(`/api/budget-groups?month=${selectedMonth}`),
          fetchWithHousehold(`/api/budgets/debts-unified?month=${selectedMonth}`),
        ]);
        if (!overviewRes.ok) throw new Error('Failed to fetch budget data');
        setBudgetData(await overviewRes.json());
        if (debtsRes.ok) {
          const d = (await debtsRes.json()) as UnifiedDebtBudgetResponse;
          setDebtBudgetData({
            totalRecommendedPayments: d.totalBudgetedPayments,
            totalActualPaid: d.totalActualPaid,
            debts: [
              ...d.strategyDebts.items.map(i => ({ debtId: i.id })),
              ...d.manualDebts.map(i => ({ debtId: i.id })),
            ],
          });
        }
        if (groupsRes.ok) {
          const g = await groupsRes.json();
          setBudgetGroups(g.groups || []);
        }
      } catch (e) {
        console.error(e);
        if (e instanceof Error && e.message === 'No household selected') { setLoading(false); return; }
        setError('Failed to load budget data.');
        toast.error('Failed to load budget data');
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [selectedMonth, selectedHouseholdId, fetchWithHousehold]);

  const navigate = (dir: 1 | -1) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const refreshBudgetData = async () => {
    if (!selectedMonth) return;
    const [ovRes, grRes] = await Promise.all([
      fetchWithHousehold(`/api/budgets/overview?month=${selectedMonth}`),
      fetchWithHousehold(`/api/budget-groups?month=${selectedMonth}`),
    ]);
    if (ovRes.ok) setBudgetData(await ovRes.json());
    if (grRes.ok) { const g = await grRes.json(); setBudgetGroups(g.groups || []); }
  };

  const handleEditBudget = async (categoryId: string, newBudget: number) => {
    try {
      const res = await postWithHousehold('/api/budgets', {
        month: selectedMonth,
        budgets: [{ categoryId, monthlyBudget: newBudget }],
      });
      if (!res.ok) throw new Error('Failed to update budget');
      toast.success('Budget updated');
      await refreshBudgetData();
    } catch { toast.error('Failed to update budget'); }
  };

  const handleCopyLastMonth = async () => {
    try {
      const [y, m] = selectedMonth.split('-').map(Number);
      const prev = new Date(y, m - 2, 1);
      const lastMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
      const res = await postWithHousehold('/api/budgets/copy', { fromMonth: lastMonth, toMonth: selectedMonth });
      if (!res.ok) throw new Error('Failed to copy budgets');
      toast.success('Budgets copied from last month');
      await refreshBudgetData();
    } catch { toast.error('Failed to copy budgets'); }
  };

  // ── Render states ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
        <div style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
              <div className="w-32 h-5 rounded animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
            </div>
            <div className="w-28 h-8 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
          <div className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)' }} />
          <div className="space-y-1">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)', animationDelay: `${i * 50}ms` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-background)' }}>
        <div className="text-center">
          <p className="text-sm mb-2" style={{ color: 'var(--color-error)' }}>{error}</p>
          <button onClick={() => window.location.reload()} className="text-sm" style={{ color: 'var(--color-primary)' }}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!budgetData) return null;

  const hasAnyBudgets = budgetData.categories.some(c => c.monthlyBudget > 0);

  const groupedCategoryIds = new Set(budgetGroups.flatMap(g => g.children.map(c => c.id)));
  const ungroupedIncome    = (budgetData.groupedCategories.income ?? []).filter(c => !groupedCategoryIds.has(c.id) && !c.parentId);
  const ungroupedBills     = (budgetData.groupedCategories.bills ?? []).filter(c => !groupedCategoryIds.has(c.id) && !c.parentId);
  const ungroupedExpenses  = (budgetData.groupedCategories.expenses ?? []).filter(c => !groupedCategoryIds.has(c.id) && !c.parentId);
  const ungroupedSavings   = (budgetData.groupedCategories.savings ?? []).filter(c => !groupedCategoryIds.has(c.id) && !c.parentId);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>

      {/* ── Sticky header ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50">
        <div
          className="backdrop-blur-xl"
          style={{ backgroundColor: 'color-mix(in oklch, var(--color-background) 82%, transparent)' }}
        >
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
            {/* Left: back + title */}
            <div className="flex items-center gap-3">
              <Link href="/dashboard">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-foreground)' }}>
                Budget Planner
              </h1>
            </div>

            {/* Center: month navigation */}
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => navigate(-1)}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span
                className="text-sm font-semibold tabular-nums min-w-[120px] text-center"
                style={{ color: 'var(--color-foreground)' }}
              >
                {fmtMonth(selectedMonth)}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => navigate(1)}>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-xs"
                onClick={handleCopyLastMonth}
                title="Copy last month's budgets"
              >
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Copy</span>
              </Button>
              <Button
                size="sm"
                className="h-8 gap-1.5 px-3 text-xs font-medium"
                onClick={() => setIsManagerModalOpen(true)}
                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
              >
                <Settings2 className="w-3.5 h-3.5" />
                Set Budgets
              </Button>
            </div>
          </div>
        </div>
        <div
          className="h-px"
          style={{
            background: 'linear-gradient(to right, transparent 5%, var(--color-border) 20%, color-mix(in oklch, var(--color-primary) 45%, var(--color-border)) 50%, var(--color-border) 80%, transparent 95%)',
          }}
        />
      </header>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Summary metrics strip */}
        <BudgetSummaryCard
          summary={budgetData.summary}
          month={budgetData.month}
          debtData={debtBudgetData}
        />

        {/* Empty state */}
        {!hasAnyBudgets && (
          <div
            className="rounded-xl py-16 text-center"
            style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
          >
            <div
              className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4"
              style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 12%, transparent)' }}
            >
              <PiggyBank className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
            </div>
            <p className="font-medium mb-1" style={{ color: 'var(--color-foreground)' }}>No budgets set for {fmtMonth(selectedMonth)}</p>
            <p className="text-sm mb-5" style={{ color: 'var(--color-muted-foreground)' }}>
              Set budgets for your categories to start tracking spending.
            </p>
            <Button
              size="sm"
              onClick={() => setIsManagerModalOpen(true)}
              style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
            >
              Set Your First Budget
            </Button>
          </div>
        )}

        {/* Category sections */}
        {hasAnyBudgets && (
          <div className="space-y-6">

            {/* Budget groups */}
            {budgetGroups.length > 0 && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)' }}>
                    Budget Groups
                  </span>
                  <button
                    onClick={() => setIsManagerModalOpen(true)}
                    className="flex items-center gap-1 text-xs transition-colors"
                    style={{ color: 'var(--color-muted-foreground)' }}
                  >
                    <Settings2 className="w-3 h-3" />
                    Manage
                  </button>
                </div>
                {budgetGroups.map(group => {
                  const groupCategories = budgetData.categories.filter(c => c.parentId === group.id);
                  if (groupCategories.length === 0) return null;
                  return (
                    <BudgetGroupSection
                      key={group.id}
                      group={group}
                      categories={groupCategories}
                      monthlyIncome={budgetData.summary.totalIncomeActual}
                      daysRemaining={budgetData.summary.daysRemaining}
                      onEditBudget={handleEditBudget}
                    />
                  );
                })}
              </div>
            )}

            {/* Ungrouped categories */}
            {(ungroupedIncome.length > 0 || ungroupedBills.length > 0 || ungroupedExpenses.length > 0 || ungroupedSavings.length > 0) && (
              <div className="space-y-5">
                {budgetGroups.length > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)' }}>
                      Other
                    </span>
                    <div className="flex-1 h-px" style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 40%, transparent)' }} />
                  </div>
                )}

                <SectionContainer
                  label="Income"
                  categories={ungroupedIncome}
                  totalBudget={ungroupedIncome.reduce((s, c) => s + (c.monthlyBudget || 0), 0)}
                  totalSpent={ungroupedIncome.reduce((s, c) => s + (c.actualSpent || 0), 0)}
                  daysRemaining={budgetData.summary.daysRemaining}
                  onEdit={handleEditBudget}
                  accent="var(--color-income)"
                />
                <SectionContainer
                  label="Essential Expenses"
                  categories={ungroupedBills}
                  totalBudget={ungroupedBills.reduce((s, c) => s + (c.monthlyBudget || 0), 0)}
                  totalSpent={ungroupedBills.reduce((s, c) => s + (c.actualSpent || 0), 0)}
                  daysRemaining={budgetData.summary.daysRemaining}
                  onEdit={handleEditBudget}
                  accent="var(--color-warning)"
                />
                <SectionContainer
                  label="Discretionary"
                  categories={ungroupedExpenses}
                  totalBudget={ungroupedExpenses.reduce((s, c) => s + (c.monthlyBudget || 0), 0)}
                  totalSpent={ungroupedExpenses.reduce((s, c) => s + (c.actualSpent || 0), 0)}
                  daysRemaining={budgetData.summary.daysRemaining}
                  onEdit={handleEditBudget}
                  accent="var(--color-expense)"
                />
                <SectionContainer
                  label="Savings & Goals"
                  categories={ungroupedSavings}
                  totalBudget={ungroupedSavings.reduce((s, c) => s + (c.monthlyBudget || 0), 0)}
                  totalSpent={ungroupedSavings.reduce((s, c) => s + (c.actualSpent || 0), 0)}
                  daysRemaining={budgetData.summary.daysRemaining}
                  onEdit={handleEditBudget}
                  accent="var(--color-primary)"
                />
              </div>
            )}
          </div>
        )}

        {/* Debt payments */}
        <div style={{ paddingTop: '1.25rem', borderTop: '1px solid var(--color-border)' }}>
          <UnifiedDebtBudgetSection month={selectedMonth} />
        </div>

        {/* Collapsible sections */}
        <CollapsibleSection label="Variable Bill Tracking" expanded={expandedSections.variableBills} onToggle={() => toggleSection('variableBills')}>
          <VariableBillTracker hideHeader />
        </CollapsibleSection>
        <CollapsibleSection label="Budget Rollover" expanded={expandedSections.rollover} onToggle={() => toggleSection('rollover')}>
          <RolloverSummary hideHeader />
        </CollapsibleSection>
        <CollapsibleSection label="Budget Analytics & Insights" expanded={expandedSections.analytics} onToggle={() => toggleSection('analytics')}>
          <BudgetAnalyticsSection hideHeader />
        </CollapsibleSection>
      </main>

      <BudgetManagerModal
        isOpen={isManagerModalOpen}
        onClose={() => setIsManagerModalOpen(false)}
        onSave={refreshBudgetData}
        month={selectedMonth}
      />
    </div>
  );
}
