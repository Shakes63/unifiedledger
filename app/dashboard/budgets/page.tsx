'use client';

import React, { useState, useEffect } from 'react';
import { BudgetSummaryCard, type DebtBudgetData } from '@/components/budgets/budget-summary-card';
import { CategoryBudgetProgress } from '@/components/budgets/category-budget-progress';
import { BudgetGroupSection } from '@/components/budgets/budget-group-section';
import { BudgetManagerModal } from '@/components/budgets/budget-manager-modal';
import { BudgetExportModal } from '@/components/budgets/budget-export-modal';
import { VariableBillTracker } from '@/components/budgets/variable-bill-tracker';
import { BudgetAnalyticsSection } from '@/components/budgets/budget-analytics-section';
import { UnifiedDebtBudgetSection } from '@/components/budgets/unified-debt-budget-section';
import { RolloverSummary } from '@/components/budgets/rollover-summary';
import { Download, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { BudgetTemplateSelector } from '@/components/budgets/budget-template-selector';

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
  // Rollover fields (Phase 17)
  rolloverEnabled?: boolean;
  rolloverBalance?: number;
  rolloverLimit?: number | null;
  effectiveBudget?: number;
  // Budget group fields
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
  children: Array<{
    id: string;
    name: string;
    type: string;
    monthlyBudget: number;
  }>;
  totalBudget: number;
  totalSpent: number;
}

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
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [templateBudgets, setTemplateBudgets] = useState<
    Array<{ categoryId: string; categoryName: string; monthlyBudget: number; allocation: string }>
  >([]);

  // Initialize selected month to current month
  useEffect(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      '0'
    )}`;
    setSelectedMonth(currentMonth);
  }, []);

  // Fetch budget data when month changes
  useEffect(() => {
    if (!selectedMonth || !selectedHouseholdId) {
      setLoading(false);
      return;
    }

    const fetchBudgetData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch budget overview and budget groups in parallel
        const [overviewResponse, groupsResponse, debtsResponse] = await Promise.all([
          fetchWithHousehold(`/api/budgets/overview?month=${selectedMonth}`),
          fetchWithHousehold(`/api/budget-groups?month=${selectedMonth}`),
          fetchWithHousehold(`/api/budgets/debts?month=${selectedMonth}`),
        ]);

        if (!overviewResponse.ok) {
          throw new Error('Failed to fetch budget data');
        }

        const data = await overviewResponse.json();
        setBudgetData(data);

        if (debtsResponse.ok) {
          const debtsData = await debtsResponse.json();
          setDebtBudgetData(debtsData);
        } else {
          setDebtBudgetData(null);
        }

        // Budget groups are optional - don't fail if they don't load
        if (groupsResponse.ok) {
          const groupsData = await groupsResponse.json();
          setBudgetGroups(groupsData.groups || []);
        }
      } catch (err) {
        console.error('Error fetching budget data:', err);
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

    fetchBudgetData();
  }, [selectedMonth, selectedHouseholdId, fetchWithHousehold]);

  // Navigate to previous month
  const handlePreviousMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1); // month - 2 because months are 0-indexed
    const prevMonth = `${prevDate.getFullYear()}-${String(
      prevDate.getMonth() + 1
    ).padStart(2, '0')}`;
    setSelectedMonth(prevMonth);
  };

  // Navigate to next month
  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(year, month, 1); // month is already 1-indexed, so this gives us next month
    const nextMonth = `${nextDate.getFullYear()}-${String(
      nextDate.getMonth() + 1
    ).padStart(2, '0')}`;
    setSelectedMonth(nextMonth);
  };

  // Refresh budget data
  const refreshBudgetData = async () => {
    try {
      const [overviewResponse, groupsResponse] = await Promise.all([
        fetchWithHousehold(`/api/budgets/overview?month=${selectedMonth}`),
        fetchWithHousehold(`/api/budget-groups?month=${selectedMonth}`),
      ]);
      
      const data = await overviewResponse.json();
      setBudgetData(data);
      
      if (groupsResponse.ok) {
        const groupsData = await groupsResponse.json();
        setBudgetGroups(groupsData.groups || []);
      }
    } catch (err) {
      console.error('Error refreshing budget data:', err);
      if (err instanceof Error && err.message === 'No household selected') {
        return;
      }
      toast.error('Failed to refresh budget data');
    }
  };

  // Handle budget edit
  const handleEditBudget = async (categoryId: string, newBudget: number) => {
    try {
      const response = await postWithHousehold('/api/budgets', {
        month: selectedMonth,
        budgets: [{ categoryId, monthlyBudget: newBudget }],
      });

      if (!response.ok) {
        throw new Error('Failed to update budget');
      }

      toast.success('Budget updated successfully');
      await refreshBudgetData();
    } catch (err) {
      console.error('Error updating budget:', err);
      toast.error('Failed to update budget');
    }
  };

  // Handle template applied from page dropdown
  const handlePageTemplateApply = (
    suggestedBudgets: Array<{
      categoryId: string;
      categoryName: string;
      monthlyBudget: number;
      allocation: string;
    }>
  ) => {
    setTemplateBudgets(suggestedBudgets);
    setIsManagerModalOpen(true);
  };

  // Handle copy last month
  const handleCopyLastMonth = async () => {
    try {
      // Calculate last month
      const [year, monthNum] = selectedMonth.split('-').map(Number);
      const lastMonthDate = new Date(year, monthNum - 2, 1);
      const lastMonth = `${lastMonthDate.getFullYear()}-${String(
        lastMonthDate.getMonth() + 1
      ).padStart(2, '0')}`;

      const response = await postWithHousehold('/api/budgets/copy', {
        fromMonth: lastMonth,
        toMonth: selectedMonth,
      });

      if (!response.ok) {
        throw new Error('Failed to copy budgets');
      }

      toast.success('Budgets copied from last month');
      await refreshBudgetData();
    } catch (error) {
      console.error('Error copying budgets:', error);
      toast.error('Failed to copy budgets');
    }
  };

  // Format month for display
  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading budget data...</div>
          </div>
        </div>
      </div>
    );
  }

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

  if (!budgetData) {
    return null;
  }

  const hasAnyBudgets = budgetData.categories.some(c => c.monthlyBudget > 0);

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header with Month Navigation */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Budgets</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreviousMonth}
              className="p-2 hover:bg-elevated rounded-lg transition-colors"
              aria-label="Previous month"
            >
              <svg
                className="w-5 h-5 text-foreground"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M15 19l-7-7 7-7"></path>
              </svg>
            </button>
            <div className="text-base font-medium text-foreground min-w-[150px] text-center">
              {formatMonth(selectedMonth)}
            </div>
            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-elevated rounded-lg transition-colors"
              aria-label="Next month"
            >
              <svg
                className="w-5 h-5 text-foreground"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M9 5l7 7-7 7"></path>
              </svg>
            </button>
          </div>
        </div>

        {/* Monthly Summary */}
        <BudgetSummaryCard summary={budgetData.summary} month={budgetData.month} debtData={debtBudgetData} />

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setIsManagerModalOpen(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            Set Budgets
          </button>
          <button
            onClick={handleCopyLastMonth}
            className="px-4 py-2 bg-card border border-border text-foreground rounded-lg hover:bg-elevated transition-colors"
          >
            Copy Last Month
          </button>
          <BudgetTemplateSelector
            onApplyTemplate={handlePageTemplateApply}
            variant="page"
          />
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground rounded-lg hover:bg-elevated transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Budget
          </button>
        </div>

        {/* Empty State */}
        {!hasAnyBudgets && (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <div className="text-muted-foreground mb-4">
              No budgets set for this month
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Set budgets for your categories to start tracking your spending and staying
              on top of your finances.
            </p>
            <button
              onClick={() => setIsManagerModalOpen(true)}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              Set Your First Budget
            </button>
          </div>
        )}

        {/* Category Budgets */}
        {hasAnyBudgets && (
          <div className="space-y-6">
            {/* Budget Groups - Show first if any exist */}
            {budgetGroups.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground">Budget Groups</h2>
                  <button
                    onClick={() => setIsManagerModalOpen(true)}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Settings2 className="w-4 h-4" />
                    Manage Groups
                  </button>
                </div>
                {budgetGroups.map(group => {
                  // Find categories that belong to this group
                  const groupCategories = budgetData.categories.filter(
                    cat => cat.parentId === group.id
                  );
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

            {/* Ungrouped Categories - Categories without a parent */}
            {(() => {
              // Get IDs of categories that are in budget groups
              const groupedCategoryIds = new Set(
                budgetGroups.flatMap(g => g.children.map(c => c.id))
              );

              // Filter ungrouped categories
              const ungroupedIncome = (budgetData.groupedCategories.income ?? []).filter(
                (c: CategoryData) => !groupedCategoryIds.has(c.id) && !c.parentId
              );
              const ungroupedBills = (budgetData.groupedCategories.bills ?? []).filter(
                (c: CategoryData) => !groupedCategoryIds.has(c.id) && !c.parentId
              );
              const ungroupedExpenses = (budgetData.groupedCategories.expenses ?? []).filter(
                (c: CategoryData) => !groupedCategoryIds.has(c.id) && !c.parentId
              );
              const ungroupedSavings = (budgetData.groupedCategories.savings ?? []).filter(
                (c: CategoryData) => !groupedCategoryIds.has(c.id) && !c.parentId
              );

              const hasUngrouped = ungroupedIncome.length > 0 || 
                ungroupedBills.length > 0 || 
                ungroupedExpenses.length > 0 || 
                ungroupedSavings.length > 0;

              if (!hasUngrouped) return null;

              return (
                <div className="space-y-6">
                  {budgetGroups.length > 0 && (
                    <h2 className="text-lg font-semibold text-foreground">Uncategorized</h2>
                  )}
                  
                  {/* Income */}
                  {ungroupedIncome.length > 0 && (
                    <div>
                      <h3 className="text-base font-medium text-foreground mb-3">Income</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {ungroupedIncome.map((category: CategoryData) => (
                          <CategoryBudgetProgress
                            key={category.id}
                            category={category}
                            daysRemaining={budgetData.summary.daysRemaining}
                            onEdit={handleEditBudget}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Essential Expenses */}
                  {ungroupedBills.length > 0 && (
                    <div>
                      <h3 className="text-base font-medium text-foreground mb-3">
                        Essential Expenses
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {ungroupedBills.map((category: CategoryData) => (
                          <CategoryBudgetProgress
                            key={category.id}
                            category={category}
                            daysRemaining={budgetData.summary.daysRemaining}
                            onEdit={handleEditBudget}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Discretionary Spending */}
                  {ungroupedExpenses.length > 0 && (
                    <div>
                      <h3 className="text-base font-medium text-foreground mb-3">
                        Discretionary Spending
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {ungroupedExpenses.map((category: CategoryData) => (
                          <CategoryBudgetProgress
                            key={category.id}
                            category={category}
                            daysRemaining={budgetData.summary.daysRemaining}
                            onEdit={handleEditBudget}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Savings & Goals */}
                  {ungroupedSavings.length > 0 && (
                    <div>
                      <h3 className="text-base font-medium text-foreground mb-3">
                        Savings & Goals
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {ungroupedSavings.map((category: CategoryData) => (
                          <CategoryBudgetProgress
                            key={category.id}
                            category={category}
                            daysRemaining={budgetData.summary.daysRemaining}
                            onEdit={handleEditBudget}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Debt Payments */}
        <div className="pt-6 border-t border-border">
          <UnifiedDebtBudgetSection month={selectedMonth} />
        </div>

        {/* Variable Bill Tracking */}
        <div className="pt-6 border-t border-border">
          <VariableBillTracker />
        </div>

        {/* Budget Rollover Summary */}
        <div className="pt-6 border-t border-border">
          <RolloverSummary />
        </div>

        {/* Budget Analytics & Insights */}
        <div className="pt-6 border-t border-border">
          <BudgetAnalyticsSection />
        </div>

        {/* Budget Manager Modal */}
        <BudgetManagerModal
          isOpen={isManagerModalOpen}
          onClose={() => {
            setIsManagerModalOpen(false);
            setTemplateBudgets([]); // Clear template budgets when modal closes
          }}
          onSave={refreshBudgetData}
          month={selectedMonth}
          initialBudgets={templateBudgets}
        />

        {/* Budget Export Modal */}
        <BudgetExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          currentMonth={selectedMonth}
        />
      </div>
    </div>
  );
}
