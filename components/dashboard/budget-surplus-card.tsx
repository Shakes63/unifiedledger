'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DebtToIncomeIndicator } from '@/components/budgets/debt-to-income-indicator';
import { ApplySurplusModal } from '@/components/budgets/apply-surplus-modal';
import { DollarSign, TrendingDown, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';

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
  const { isLoaded, isSignedIn } = useAuth();
  const [data, setData] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [applied, setApplied] = useState(false);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    // Only fetch when auth is fully loaded and user is signed in
    if (isLoaded && isSignedIn) {
      fetchBudgetSummary();
    } else if (isLoaded && !isSignedIn) {
      setAuthError(true);
      setLoading(false);
    }
  }, [isLoaded, isSignedIn]);

  const fetchBudgetSummary = async () => {
    try {
      setLoading(true);
      setAuthError(false);
      const response = await fetch('/api/budgets/summary');

      if (response.status === 401) {
        console.error('Budget summary: Unauthorized');
        setAuthError(true);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch budget summary');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching budget summary:', err);
    } finally {
      setLoading(false);
    }
  };

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
      <Card className="p-6 border rounded-xl" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
        <div className="animate-pulse">
          <div className="flex items-start justify-between mb-4">
            <div className="h-4 rounded w-24" style={{ backgroundColor: 'var(--color-elevated)' }}></div>
            <div className="w-10 h-10 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)' }}></div>
          </div>
          <div className="h-8 rounded w-32 mb-4" style={{ backgroundColor: 'var(--color-elevated)' }}></div>
          <div className="h-2 rounded w-full" style={{ backgroundColor: 'var(--color-elevated)' }}></div>
        </div>
      </Card>
    );
  }

  // Auth error
  if (authError) {
    return (
      <Card className="p-6 border rounded-xl" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
        <div className="flex flex-col items-center justify-center h-full text-center">
          <AlertCircle className="w-8 h-8 text-[var(--color-error)] mb-2" />
          <p className="text-sm font-medium text-foreground mb-1">Authentication Required</p>
          <p className="text-xs text-muted-foreground">Please sign in to view budget data</p>
        </div>
      </Card>
    );
  }

  // No data
  if (!data) {
    return (
      <Card className="p-6 border rounded-xl" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
        <div className="flex flex-col items-center justify-center h-full text-center">
          <AlertCircle className="w-8 h-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Unable to load budget data</p>
        </div>
      </Card>
    );
  }

  // No income - show message
  if (!data.hasIncome) {
    return (
      <Card className="p-6 border rounded-xl" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
        <div className="flex items-start justify-between mb-4">
          <p className="text-sm text-muted-foreground">Budget Surplus</p>
          <div className="p-3 rounded-lg bg-[var(--color-transfer)]/20">
            <DollarSign className="w-6 h-6 text-[var(--color-transfer)]" />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Add income transactions to calculate your budget surplus</p>
          <p className="text-xs text-muted-foreground">Track income to see how much you can apply to debt</p>
        </div>
      </Card>
    );
  }

  // No debts - show savings message
  if (!data.hasDebts) {
    return (
      <Card className="p-6 border rounded-xl" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
        <div className="flex items-start justify-between mb-4">
          <p className="text-sm text-muted-foreground">Budget Surplus</p>
          <div className="p-3 rounded-lg bg-[var(--color-income)]/20">
            <CheckCircle className="w-6 h-6 text-[var(--color-income)]" />
          </div>
        </div>
        <div>
          <h3 className="text-3xl font-bold text-foreground mb-2">
            ${data.availableToApply.toFixed(2)}
          </h3>
          <p className="text-sm mb-2" style={{ color: 'var(--color-income)' }}>Debt-free! Consider saving this surplus</p>
          <p className="text-xs text-muted-foreground">You have no active debts. Great job!</p>
        </div>
      </Card>
    );
  }

  // Negative surplus - show warning
  if (data.availableToApply <= 0) {
    return (
      <Card className="p-6 border rounded-xl" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
        <div className="flex items-start justify-between mb-4">
          <p className="text-sm text-muted-foreground">Budget Surplus</p>
          <div className="p-3 rounded-lg bg-[var(--color-expense)]/20">
            <AlertCircle className="w-6 h-6 text-[var(--color-expense)]" />
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <h3 className="text-2xl font-bold" style={{ color: 'var(--color-expense)' }}>
              -${Math.abs(data.availableToApply).toFixed(2)}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">Spending exceeds income</p>
          </div>
          {data.debtToIncomeRatio > 0 && (
            <DebtToIncomeIndicator
              ratio={data.debtToIncomeRatio}
              level={data.debtToIncomeLevel}
              size="small"
            />
          )}
          <p className="text-xs text-muted-foreground">Review your budget and reduce expenses</p>
        </div>
      </Card>
    );
  }

  // Has surplus - show main card
  return (
    <>
      <Card className="p-6 border rounded-xl" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
        <div className="flex items-start justify-between mb-4">
          <p className="text-sm text-muted-foreground">Budget Surplus</p>
          <div className="p-3 rounded-lg bg-[var(--color-income)]/20">
            <TrendingDown className="w-6 h-6 text-[var(--color-income)]" />
          </div>
        </div>

        <div className="space-y-4">
          {/* Surplus amount */}
          <div>
            <h3 className="text-3xl font-bold text-foreground">
              ${data.availableToApply.toFixed(2)}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">Available this month</p>
          </div>

          {/* Debt-to-Income Indicator */}
          <DebtToIncomeIndicator
            ratio={data.debtToIncomeRatio}
            level={data.debtToIncomeLevel}
            size="small"
          />

          {/* Apply button or success message */}
          {applied ? (
            <div className="flex items-center gap-2 rounded-lg p-3 border" style={{ color: 'var(--color-income)', backgroundColor: `color-mix(in oklch, var(--color-income) 10%, transparent)`, borderColor: `color-mix(in oklch, var(--color-income) 30%, transparent)` }}>
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Applied to debt payments!</span>
            </div>
          ) : (
            <Button
              onClick={() => setShowModal(true)}
              className="w-full font-medium bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90"
            >
              Apply to Debt
            </Button>
          )}

          {/* Breakdown */}
          <div className="pt-2 border-t space-y-1" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Income</span>
              <span className="text-foreground">${data.monthlyIncome.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Expenses</span>
              <span className="text-foreground">-${data.totalActualExpenses.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Debt Minimums</span>
              <span className="text-foreground">-${data.totalMinimumPayments.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </Card>

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
