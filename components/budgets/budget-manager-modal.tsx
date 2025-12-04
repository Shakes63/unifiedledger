'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import Decimal from 'decimal.js';
import { toast } from 'sonner';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { Info, Star, ExternalLink, CreditCard } from 'lucide-react';
import Link from 'next/link';

// Types for unified debt budget
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

interface Category {
  id: string;
  name: string;
  type: 'income' | 'variable_expense' | 'monthly_bill' | 'savings' | 'debt' | 'non_monthly_bill';
  monthlyBudget: number;
  sortOrder: number;
  incomeFrequency?: 'weekly' | 'biweekly' | 'monthly' | 'variable';
}

interface BudgetManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  month: string;
}

export function BudgetManagerModal({
  isOpen,
  onClose,
  onSave,
  month,
}: BudgetManagerModalProps) {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold, postWithHousehold, putWithHousehold } = useHouseholdFetch();
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgetValues, setBudgetValues] = useState<Record<string, string>>({});
  const [frequencies, setFrequencies] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [debtBudgetData, setDebtBudgetData] = useState<UnifiedDebtBudgetData | null>(null);
  const [manualDebtBudgets, setManualDebtBudgets] = useState<Record<string, string>>({});

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetchWithHousehold('/api/budgets');

      if (!response.ok) {
        throw new Error('Failed to fetch categories');
      }

      const data = await response.json();
      setCategories(data.budgets);

      // Initialize budget values and frequencies
      const initialValues: Record<string, string> = {};
      const initialFrequencies: Record<string, string> = {};
      data.budgets.forEach((cat: Category) => {
        initialValues[cat.id] = cat.monthlyBudget.toFixed(2);
        if (cat.type === 'income') {
          initialFrequencies[cat.id] = cat.incomeFrequency || 'variable';
        }
      });
      setBudgetValues(initialValues);
      setFrequencies(initialFrequencies);
    } catch (error) {
      console.error('Error fetching categories:', error);
      if (error instanceof Error && error.message === 'No household selected') {
        setLoading(false);
        return;
      }
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, [fetchWithHousehold]);

  const fetchDebtBudgetData = useCallback(async () => {
    try {
      const response = await fetchWithHousehold(`/api/budgets/debts-unified?month=${month}`);
      if (response.ok) {
        const data: UnifiedDebtBudgetData = await response.json();
        setDebtBudgetData(data);
        
        // Initialize manual debt budget values
        const initialManualBudgets: Record<string, string> = {};
        
        // For strategy mode: manual debts are editable
        data.manualDebts.forEach(debt => {
          const value = debt.budgetedPayment ?? debt.minimumPayment;
          initialManualBudgets[debt.id] = value.toFixed(2);
        });
        
        // For manual mode: all debts are editable
        if (!data.strategyEnabled) {
          data.strategyDebts.items.forEach(debt => {
            const value = debt.budgetedPayment ?? debt.minimumPayment;
            initialManualBudgets[debt.id] = value.toFixed(2);
          });
        }
        
        setManualDebtBudgets(initialManualBudgets);
      }
    } catch (error) {
      console.error('Error fetching debt budget data:', error);
      // Silently fail - debts section will just not show
    }
  }, [fetchWithHousehold, month]);

  // Fetch categories and debt data when modal opens
  useEffect(() => {
    if (isOpen && selectedHouseholdId) {
      fetchCategories();
      fetchDebtBudgetData();
    } else if (isOpen && !selectedHouseholdId) {
      setLoading(false);
    }
  }, [isOpen, selectedHouseholdId, fetchCategories, fetchDebtBudgetData]);

  const handleValueChange = (categoryId: string, value: string) => {
    setBudgetValues(prev => ({ ...prev, [categoryId]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Convert budget values to numbers and build request
      const budgets = Object.entries(budgetValues)
        .map(([categoryId, value]) => {
          const category = categories.find(c => c.id === categoryId);
          const budget: { categoryId: string; monthlyBudget: number; incomeFrequency?: string } = {
            categoryId,
            monthlyBudget: parseFloat(value) || 0,
          };
          // Include income frequency for income categories
          if (category?.type === 'income' && frequencies[categoryId]) {
            budget.incomeFrequency = frequencies[categoryId];
          }
          return budget;
        })
        .filter(b => !isNaN(b.monthlyBudget) && b.monthlyBudget >= 0);

      const response = await postWithHousehold('/api/budgets', {
        month,
        budgets,
      });

      if (!response.ok) {
        throw new Error('Failed to save budgets');
      }

      // Save manual debt budget values
      if (Object.keys(manualDebtBudgets).length > 0) {
        const debtBudgetUpdates = Object.entries(manualDebtBudgets).map(([debtId, value]) => ({
          id: debtId,
          budgetedMonthlyPayment: parseFloat(value) || 0,
        }));

        // Update account budgets
        const accountUpdates = debtBudgetUpdates.filter(d => 
          debtBudgetData?.strategyDebts.items.find(item => item.id === d.id && item.source === 'account') ||
          debtBudgetData?.manualDebts.find(item => item.id === d.id && item.source === 'account')
        );

        // Update bill budgets
        const billUpdates = debtBudgetUpdates.filter(d => 
          debtBudgetData?.strategyDebts.items.find(item => item.id === d.id && item.source === 'bill') ||
          debtBudgetData?.manualDebts.find(item => item.id === d.id && item.source === 'bill')
        );

        // Save account budget updates
        for (const update of accountUpdates) {
          await putWithHousehold(`/api/accounts/${update.id}`, {
            budgetedMonthlyPayment: update.budgetedMonthlyPayment,
          });
        }

        // Save bill budget updates
        for (const update of billUpdates) {
          await putWithHousehold(`/api/bills/${update.id}`, {
            budgetedMonthlyPayment: update.budgetedMonthlyPayment,
          });
        }
      }

      toast.success('Budgets saved successfully');
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving budgets:', error);
      toast.error('Failed to save budgets');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLastMonth = async () => {
    try {
      // Calculate last month
      const [year, monthNum] = month.split('-').map(Number);
      const lastMonthDate = new Date(year, monthNum - 2, 1);
      const lastMonth = `${lastMonthDate.getFullYear()}-${String(
        lastMonthDate.getMonth() + 1
      ).padStart(2, '0')}`;

      const response = await postWithHousehold('/api/budgets/copy', {
        fromMonth: lastMonth,
        toMonth: month,
      });

      if (!response.ok) {
        throw new Error('Failed to copy budgets');
      }

      toast.success('Budgets copied from last month');
      fetchCategories();
    } catch (error) {
      console.error('Error copying budgets:', error);
      toast.error('Failed to copy budgets');
    }
  };

  // Calculate totals
  const calculateTotals = () => {
    const incomeTotal = categories
      .filter(c => c.type === 'income')
      .reduce((sum, c) => {
        const value = parseFloat(budgetValues[c.id] || '0');
        return new Decimal(sum).plus(value || 0).toNumber();
      }, 0);

    const expenseTotal = categories
      .filter(
        c =>
          c.type === 'variable_expense' ||
          c.type === 'monthly_bill' ||
          c.type === 'non_monthly_bill'
      )
      .reduce((sum, c) => {
        const value = parseFloat(budgetValues[c.id] || '0');
        return new Decimal(sum).plus(value || 0).toNumber();
      }, 0);

    const savingsTotal = categories
      .filter(c => c.type === 'savings')
      .reduce((sum, c) => {
        const value = parseFloat(budgetValues[c.id] || '0');
        return new Decimal(sum).plus(value || 0).toNumber();
      }, 0);

    // Calculate debt total based on strategy mode
    let debtTotal = 0;
    if (debtBudgetData) {
      if (debtBudgetData.strategyEnabled) {
        // Strategy debts: use recommended payments
        debtTotal = new Decimal(debtBudgetData.strategyDebts.totalRecommended)
          .plus(
            debtBudgetData.manualDebts.reduce((sum, d) => {
              const value = parseFloat(manualDebtBudgets[d.id] || '0');
              return new Decimal(sum).plus(value || d.minimumPayment).toNumber();
            }, 0)
          )
          .toNumber();
      } else {
        // Manual mode: use editable values
        const allDebts = [...debtBudgetData.strategyDebts.items, ...debtBudgetData.manualDebts];
        debtTotal = allDebts.reduce((sum, d) => {
          const value = parseFloat(manualDebtBudgets[d.id] || '0');
          return new Decimal(sum).plus(value || d.minimumPayment).toNumber();
        }, 0);
      }
    }

    const surplus = new Decimal(incomeTotal)
      .minus(expenseTotal)
      .minus(savingsTotal)
      .minus(debtTotal)
      .toNumber();

    return { incomeTotal, expenseTotal, savingsTotal, debtTotal, surplus };
  };

  const totals = calculateTotals();

  // Group categories by type
  const groupedCategories = {
    income: categories.filter(c => c.type === 'income'),
    bills: categories.filter(
      c => c.type === 'monthly_bill' || c.type === 'non_monthly_bill'
    ),
    expenses: categories.filter(c => c.type === 'variable_expense'),
    savings: categories.filter(c => c.type === 'savings'),
    debt: categories.filter(c => c.type === 'debt'),
  };

  const renderCategoryInput = (category: Category) => (
    <div key={category.id} className="space-y-2">
      <div className="flex items-center gap-3">
        <label
          htmlFor={`budget-${category.id}`}
          className="flex-1 text-sm text-foreground"
        >
          {category.name}
        </label>
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground">$</span>
          <input
            id={`budget-${category.id}`}
            type="number"
            min="0"
            step="0.01"
            value={budgetValues[category.id] || '0'}
            onChange={e => handleValueChange(category.id, e.target.value)}
            className="w-32 bg-input border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </div>
      </div>
      {category.type === 'income' && (
        <div className="flex items-center gap-2 ml-4">
          <label htmlFor={`frequency-${category.id}`} className="text-xs text-muted-foreground">
            Frequency:
          </label>
          <select
            id={`frequency-${category.id}`}
            value={frequencies[category.id] || 'variable'}
            onChange={e => setFrequencies(prev => ({ ...prev, [category.id]: e.target.value }))}
            className="flex-1 bg-input border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            <option value="weekly">Weekly</option>
            <option value="biweekly">Biweekly (Every 2 weeks)</option>
            <option value="monthly">Monthly</option>
            <option value="variable">Variable (use daily average)</option>
          </select>
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Set Monthly Budgets</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Configure budget amounts for your income, expenses, bills, and savings categories. Changes will apply to the current month.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading categories...</div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleCopyLastMonth}
                className="px-4 py-2 bg-card border border-border text-foreground rounded-lg hover:bg-elevated transition-colors text-sm"
              >
                Copy Last Month
              </button>
              <button className="px-4 py-2 bg-card border border-border text-foreground rounded-lg hover:bg-elevated transition-colors text-sm">
                Use Template ▼
              </button>
            </div>

            {/* Income Categories */}
            {groupedCategories.income.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Income Categories
                </h3>
                <div className="space-y-2">
                  {groupedCategories.income.map(renderCategoryInput)}
                </div>
              </div>
            )}

            {/* Fixed Expenses (Bills) */}
            {groupedCategories.bills.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Fixed Expenses
                </h3>
                <div className="space-y-2">
                  {groupedCategories.bills.map(renderCategoryInput)}
                </div>
              </div>
            )}

            {/* Variable Expenses */}
            {groupedCategories.expenses.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Variable Expenses
                </h3>
                <div className="space-y-2">
                  {groupedCategories.expenses.map(renderCategoryInput)}
                </div>
              </div>
            )}

            {/* Savings & Goals */}
            {groupedCategories.savings.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Savings & Goals
                </h3>
                <div className="space-y-2">
                  {groupedCategories.savings.map(renderCategoryInput)}
                </div>
              </div>
            )}

            {/* Debt Payments */}
            {debtBudgetData && debtBudgetData.debtCount > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="w-4 h-4 text-[var(--color-expense)]" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Debt Payments
                  </h3>
                  {debtBudgetData.strategyEnabled && (
                    <span className="text-xs px-2 py-0.5 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded">
                      {debtBudgetData.payoffMethod} strategy
                    </span>
                  )}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="text-muted-foreground hover:text-foreground transition-colors">
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>
                          {debtBudgetData.strategyEnabled
                            ? 'Strategy debts are auto-calculated. Excluded debts can be edited below.'
                            : 'Set custom payment amounts for each debt.'}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="space-y-3 bg-elevated/50 rounded-lg p-3 border border-border">
                  {/* Strategy-managed debts (read-only when strategy is enabled) */}
                  {debtBudgetData.strategyEnabled && debtBudgetData.strategyDebts.items.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Star className="w-3 h-3 text-[var(--color-primary)]" />
                        <span className="text-xs font-medium text-muted-foreground">
                          Managed by Strategy
                        </span>
                      </div>
                      {debtBudgetData.strategyDebts.items.map(debt => (
                        <div key={debt.id} className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: debt.color || '#6b7280' }}
                            />
                            <span className="text-sm text-foreground">{debt.name}</span>
                            {debt.isFocusDebt && (
                              <span className="inline-flex items-center gap-0.5 text-xs text-[var(--color-primary)]">
                                <Star className="w-3 h-3" />
                                Focus
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-mono text-foreground">
                              ${debt.recommendedPayment.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                            {debt.isFocusDebt && debt.recommendedPayment > debt.minimumPayment && (
                              <span className="text-xs text-muted-foreground ml-1">
                                (min: ${debt.minimumPayment.toFixed(2)})
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Manual/Excluded debts (editable) */}
                  {((!debtBudgetData.strategyEnabled && debtBudgetData.strategyDebts.items.length > 0) ||
                    debtBudgetData.manualDebts.length > 0) && (
                    <div className="space-y-2">
                      {debtBudgetData.strategyEnabled && debtBudgetData.manualDebts.length > 0 && (
                        <div className="flex items-center gap-2 pt-2 border-t border-border">
                          <span className="text-xs font-medium text-muted-foreground">
                            Excluded from Strategy (Editable)
                          </span>
                        </div>
                      )}
                      {(!debtBudgetData.strategyEnabled && debtBudgetData.strategyDebts.items.length > 0) && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            Set payment amounts
                          </span>
                        </div>
                      )}
                      {/* Render editable debts */}
                      {(!debtBudgetData.strategyEnabled
                        ? debtBudgetData.strategyDebts.items
                        : debtBudgetData.manualDebts
                      ).map(debt => (
                        <div key={debt.id} className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: debt.color || '#6b7280' }}
                            />
                            <span className="text-sm text-foreground">{debt.name}</span>
                            <span className="text-xs text-muted-foreground">
                              (min: ${debt.minimumPayment.toFixed(2)})
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-muted-foreground">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={manualDebtBudgets[debt.id] || debt.minimumPayment.toFixed(2)}
                              onChange={e =>
                                setManualDebtBudgets(prev => ({
                                  ...prev,
                                  [debt.id]: e.target.value,
                                }))
                              }
                              className="w-28 bg-input border border-border rounded-lg px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 mt-2 border-t border-border">
                    <span className="text-sm font-medium text-muted-foreground">Total Debt Payments:</span>
                    <span className="text-sm font-mono font-semibold text-[var(--color-expense)]">
                      ${totals.debtTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-4 mt-2">
                    <Link
                      href="/dashboard/debts"
                      className="flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
                    >
                      Manage Debts
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                    <Link
                      href="/dashboard/settings?tab=household-financial"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Strategy Settings
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground mb-2">Summary</h3>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Income:</span>
                <span className="font-semibold text-[var(--color-income)]">
                  ${totals.incomeTotal.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Expenses:</span>
                <span className="font-semibold text-[var(--color-expense)]">
                  ${totals.expenseTotal.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Savings:</span>
                <span className="font-semibold text-foreground">
                  ${totals.savingsTotal.toFixed(2)}
                </span>
              </div>
              {totals.debtTotal > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Debt Payments:</span>
                  <span className="font-semibold text-[var(--color-expense)]">
                    ${totals.debtTotal.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="border-t border-border pt-2 mt-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Surplus/Deficit:</span>
                  <span
                    className={`font-semibold ${
                      totals.surplus >= 0
                        ? 'text-[var(--color-success)]'
                        : 'text-[var(--color-error)]'
                    }`}
                  >
                    ${totals.surplus.toFixed(2)}
                    {totals.surplus === 0 && ' ✓'}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <button
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 bg-card border border-border text-foreground rounded-lg hover:bg-elevated transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Budget'}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
