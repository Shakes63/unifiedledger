'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { DebtToIncomeIndicator } from '@/components/budgets/debt-to-income-indicator';
import { ApplySurplusModal } from '@/components/budgets/apply-surplus-modal';
import { DollarSign, TrendingDown, AlertCircle, CheckCircle } from 'lucide-react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';

interface BudgetSummary {
  monthlyIncome: number;
  totalBudgetedExpenses: number;
  totalActualExpenses: number;
  totalMinimumPayments: number;
  currentExtraPayment: number;
  budgetedSurplus: number;
  availableToApply: number;
  totalDebtPayments: number;
  debtToIncomeRatio: number;
  debtToIncomeLevel: 'healthy' | 'manageable' | 'high';
  hasSurplus: boolean;
  suggestedExtraPayment: number;
  hasDebts: boolean;
  hasIncome: boolean;
  hasBudgets: boolean;
}

export function BudgetSurplusCard() {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [data, setData] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [applied, setApplied] = useState(false);
  const [authError, setAuthError] = useState(false);

  const fetchBudgetSummary = useCallback(async () => {
    try {
      setLoading(true);
      setAuthError(false);
      const response = await fetchWithHousehold('/api/budgets/summary');

      // Handle auth errors (401, 403)
      if (response.status === 401 || response.status === 403) {
        setAuthError(true);
        setData(null);
        return;
      }

      // Handle expected error responses gracefully (400 = no household)
      if (response.status === 400) {
        setData(null);
        return;
      }

      if (!response.ok) {
        // Only log unexpected errors (5xx)
        console.error('Error fetching budget summary: HTTP', response.status);
        setData(null);
        return;
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      // Network errors or "No household selected" from the hook
      if (err instanceof Error && err.message === 'No household selected') {
        // Expected case - silently handle
        setData(null);
        return;
      }
      console.error('Error fetching budget summary:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [fetchWithHousehold]);

  useEffect(() => {
    // Only fetch when household is selected
    // Auth errors are handled by the API response (401 status)
    if (!selectedHouseholdId) {
      setLoading(false);
      return;
    }
    fetchBudgetSummary();
  }, [selectedHouseholdId, fetchBudgetSummary]);

  const handleApplied = () => {
    setApplied(true);
    setShowModal(false);
    // Refresh data
    fetchBudgetSummary();
    // Reset applied state after 3 seconds
    setTimeout(() => setApplied(false), 3000);
  };

  // Loading state
  if (loading) {
    return (
      <div
        className="p-5 rounded-xl relative overflow-hidden"
        style={{
          border: '1px solid var(--color-border)',
          background: 'radial-gradient(ellipse 120% 120% at 100% 0%, color-mix(in oklch, var(--color-foreground) 4%, transparent) 0%, transparent 70%), var(--color-background)',
        }}
      >
        <div className="animate-pulse">
          <div className="flex items-start justify-between mb-4">
            <div className="h-4 rounded w-24" style={{ backgroundColor: 'var(--color-elevated)' }}></div>
            <div className="w-10 h-10 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)' }}></div>
          </div>
          <div className="h-8 rounded w-32 mb-4" style={{ backgroundColor: 'var(--color-elevated)' }}></div>
          <div className="h-2 rounded w-full" style={{ backgroundColor: 'var(--color-elevated)' }}></div>
        </div>
      </div>
    );
  }

  // Auth error
  if (authError) {
    return (
      <div
        className="p-5 rounded-xl relative overflow-hidden"
        style={{
          border: '1px solid var(--color-border)',
          background: 'radial-gradient(ellipse 120% 120% at 100% 0%, color-mix(in oklch, var(--color-foreground) 4%, transparent) 0%, transparent 70%), var(--color-background)',
        }}
      >
        <div className="flex flex-col items-center justify-center h-full text-center">
          <AlertCircle className="w-8 h-8 mb-2" style={{ color: 'var(--color-destructive)' }} />
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-foreground)' }}>Authentication Required</p>
          <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Please sign in to view budget data</p>
        </div>
      </div>
    );
  }

  // No data
  if (!data) {
    return (
      <div
        className="p-5 rounded-xl relative overflow-hidden"
        style={{
          border: '1px solid var(--color-border)',
          background: 'radial-gradient(ellipse 120% 120% at 100% 0%, color-mix(in oklch, var(--color-foreground) 4%, transparent) 0%, transparent 70%), var(--color-background)',
        }}
      >
        <div className="flex flex-col items-center justify-center h-full text-center">
          <AlertCircle className="w-8 h-8 mb-2" style={{ color: 'var(--color-muted-foreground)' }} />
          <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Unable to load budget data</p>
        </div>
      </div>
    );
  }

  // No income - show message
  if (!data.hasIncome) {
    return (
      <div
        className="p-5 rounded-xl relative overflow-hidden"
        style={{
          border: '1px solid var(--color-border)',
          borderLeftWidth: '4px',
          borderLeftColor: 'var(--color-destructive)',
          background: 'radial-gradient(ellipse 120% 120% at 100% 0%, color-mix(in oklch, var(--color-foreground) 4%, transparent) 0%, transparent 70%), var(--color-background)',
        }}
      >
        <div className="flex items-start justify-between mb-4">
          <p className="text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-muted-foreground)' }}>Budget Surplus</p>
          <div className="p-3 rounded-lg" style={{ backgroundColor: 'color-mix(in oklch, var(--color-transfer) 20%, transparent)' }}>
            <DollarSign className="w-6 h-6" style={{ color: 'var(--color-transfer)' }} />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Add income transactions to calculate your budget surplus</p>
          <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Track income to see how much you can apply to debt</p>
        </div>
      </div>
    );
  }

  // No debts - show savings message
  if (!data.hasDebts) {
    return (
      <div
        className="p-5 rounded-xl relative overflow-hidden"
        style={{
          border: '1px solid var(--color-border)',
          borderLeftWidth: '4px',
          borderLeftColor: 'var(--color-success)',
          background: 'radial-gradient(ellipse 120% 120% at 100% 0%, color-mix(in oklch, var(--color-foreground) 4%, transparent) 0%, transparent 70%), var(--color-background)',
        }}
      >
        <div className="flex items-start justify-between mb-4">
          <p className="text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-muted-foreground)' }}>Budget Surplus</p>
          <div className="p-3 rounded-lg" style={{ backgroundColor: 'color-mix(in oklch, var(--color-income) 20%, transparent)' }}>
            <CheckCircle className="w-6 h-6" style={{ color: 'var(--color-income)' }} />
          </div>
        </div>
        <div>
          <h3 className="text-4xl font-bold mb-2 tabular-nums" style={{ color: 'var(--color-foreground)', fontVariantNumeric: 'tabular-nums' }}>
            ${data.availableToApply.toFixed(2)}
          </h3>
          <p className="text-sm mb-2" style={{ color: 'var(--color-income)' }}>Debt-free! Consider saving this surplus</p>
          <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>You have no active debts. Great job!</p>
        </div>
      </div>
    );
  }

  // Negative surplus - show warning
  if (data.availableToApply <= 0) {
    return (
      <div
        className="p-5 rounded-xl relative overflow-hidden"
        style={{
          border: '1px solid var(--color-border)',
          borderLeftWidth: '4px',
          borderLeftColor: 'var(--color-destructive)',
          background: 'radial-gradient(ellipse 120% 120% at 100% 0%, color-mix(in oklch, var(--color-foreground) 4%, transparent) 0%, transparent 70%), var(--color-background)',
        }}
      >
        <div className="flex items-start justify-between mb-4">
          <p className="text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-muted-foreground)' }}>Budget Surplus</p>
          <div className="p-3 rounded-lg" style={{ backgroundColor: 'color-mix(in oklch, var(--color-expense) 20%, transparent)' }}>
            <AlertCircle className="w-6 h-6" style={{ color: 'var(--color-expense)' }} />
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <h3 className="text-4xl font-bold tabular-nums" style={{ color: 'var(--color-destructive)', fontVariantNumeric: 'tabular-nums' }}>
              -${Math.abs(data.availableToApply).toFixed(2)}
            </h3>
            <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>Spending exceeds income</p>
          </div>
          {data.debtToIncomeRatio > 0 && (
            <DebtToIncomeIndicator
              ratio={data.debtToIncomeRatio}
              level={data.debtToIncomeLevel}
              size="small"
            />
          )}
          <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Review your budget and reduce expenses</p>
        </div>
      </div>
    );
  }

  // Has surplus - show main card
  return (
    <>
      <div
        className="p-5 rounded-xl relative overflow-hidden"
        style={{
          border: '1px solid var(--color-border)',
          borderLeftWidth: '4px',
          borderLeftColor: 'var(--color-success)',
          background: 'radial-gradient(ellipse 120% 120% at 100% 0%, color-mix(in oklch, var(--color-foreground) 4%, transparent) 0%, transparent 70%), var(--color-background)',
        }}
      >
        <div className="flex items-start justify-between mb-4">
          <p className="text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-muted-foreground)' }}>Budget Surplus</p>
          <div className="p-3 rounded-lg" style={{ backgroundColor: 'color-mix(in oklch, var(--color-income) 20%, transparent)' }}>
            <TrendingDown className="w-6 h-6" style={{ color: 'var(--color-income)' }} />
          </div>
        </div>

        <div className="space-y-4">
          {/* Surplus amount */}
          <div>
            <h3 className="text-4xl font-bold tabular-nums" style={{ color: 'var(--color-foreground)', fontVariantNumeric: 'tabular-nums' }}>
              ${data.availableToApply.toFixed(2)}
            </h3>
            <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>Available this month</p>
          </div>

          {/* Debt-to-Income Indicator */}
          <DebtToIncomeIndicator
            ratio={data.debtToIncomeRatio}
            level={data.debtToIncomeLevel}
            size="small"
          />

          {/* Apply button or success message */}
          {applied ? (
            <div className="flex items-center gap-2 rounded-lg p-3 border" style={{ color: 'var(--color-income)', backgroundColor: 'color-mix(in oklch, var(--color-income) 10%, transparent)', borderColor: 'color-mix(in oklch, var(--color-income) 30%, transparent)' }}>
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Applied to debt payments!</span>
            </div>
          ) : (
            <Button
              onClick={() => setShowModal(true)}
              className="w-full font-medium rounded-full hover:opacity-90"
              style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
            >
              Apply to Debt
            </Button>
          )}

          {/* Breakdown - ledger list style */}
          <div className="pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
            <div className="flex justify-between items-center text-[12px] py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ color: 'var(--color-muted-foreground)' }}>Income</span>
              <span className="tabular-nums" style={{ color: 'var(--color-foreground)', fontVariantNumeric: 'tabular-nums' }}>${data.monthlyIncome.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-[12px] py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ color: 'var(--color-muted-foreground)' }}>Expenses</span>
              <span className="tabular-nums" style={{ color: 'var(--color-foreground)', fontVariantNumeric: 'tabular-nums' }}>-${data.totalActualExpenses.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-[12px] py-2">
              <span style={{ color: 'var(--color-muted-foreground)' }}>Debt Minimums</span>
              <span className="tabular-nums" style={{ color: 'var(--color-foreground)', fontVariantNumeric: 'tabular-nums' }}>-${data.totalMinimumPayments.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Apply Surplus Modal */}
      {showModal && (
        <ApplySurplusModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          availableAmount={data.availableToApply}
          suggestedAmount={data.suggestedExtraPayment}
          onSuccess={handleApplied}
        />
      )}
    </>
  );
}
