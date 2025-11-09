'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DebtToIncomeIndicator } from '@/components/budgets/debt-to-income-indicator';
import { ApplySurplusModal } from '@/components/budgets/apply-surplus-modal';
import { DollarSign, TrendingDown, AlertCircle, CheckCircle } from 'lucide-react';

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
  const [data, setData] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    fetchBudgetSummary();
  }, []);

  const fetchBudgetSummary = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/budgets/summary');

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
      <Card className="p-6 border border-[#2a2a2a] bg-[#1a1a1a] rounded-xl">
        <div className="animate-pulse">
          <div className="flex items-start justify-between mb-4">
            <div className="h-4 bg-[#242424] rounded w-24"></div>
            <div className="w-10 h-10 bg-[#242424] rounded-lg"></div>
          </div>
          <div className="h-8 bg-[#242424] rounded w-32 mb-4"></div>
          <div className="h-2 bg-[#242424] rounded w-full"></div>
        </div>
      </Card>
    );
  }

  // No data
  if (!data) {
    return (
      <Card className="p-6 border border-[#2a2a2a] bg-[#1a1a1a] rounded-xl">
        <div className="flex flex-col items-center justify-center h-full text-center">
          <AlertCircle className="w-8 h-8 text-gray-500 mb-2" />
          <p className="text-sm text-gray-500">Unable to load budget data</p>
        </div>
      </Card>
    );
  }

  // No income - show message
  if (!data.hasIncome) {
    return (
      <Card className="p-6 border border-[#2a2a2a] bg-[#1a1a1a] rounded-xl">
        <div className="flex items-start justify-between mb-4">
          <p className="text-sm text-gray-400">Budget Surplus</p>
          <div className="p-3 bg-blue-500/20 rounded-lg">
            <DollarSign className="w-6 h-6 text-blue-400" />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-gray-400">Add income transactions to calculate your budget surplus</p>
          <p className="text-xs text-gray-500">Track income to see how much you can apply to debt</p>
        </div>
      </Card>
    );
  }

  // No debts - show savings message
  if (!data.hasDebts) {
    return (
      <Card className="p-6 border border-[#2a2a2a] bg-[#1a1a1a] rounded-xl">
        <div className="flex items-start justify-between mb-4">
          <p className="text-sm text-gray-400">Budget Surplus</p>
          <div className="p-3 bg-emerald-500/20 rounded-lg">
            <CheckCircle className="w-6 h-6 text-emerald-400" />
          </div>
        </div>
        <div>
          <h3 className="text-3xl font-bold text-white mb-2">
            ${data.availableToApply.toFixed(2)}
          </h3>
          <p className="text-sm text-emerald-400 mb-2">Debt-free! Consider saving this surplus</p>
          <p className="text-xs text-gray-500">You have no active debts. Great job!</p>
        </div>
      </Card>
    );
  }

  // Negative surplus - show warning
  if (data.availableToApply <= 0) {
    return (
      <Card className="p-6 border border-[#2a2a2a] bg-[#1a1a1a] rounded-xl">
        <div className="flex items-start justify-between mb-4">
          <p className="text-sm text-gray-400">Budget Surplus</p>
          <div className="p-3 bg-red-500/20 rounded-lg">
            <AlertCircle className="w-6 h-6 text-red-400" />
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <h3 className="text-2xl font-bold text-red-400">
              -${Math.abs(data.availableToApply).toFixed(2)}
            </h3>
            <p className="text-xs text-gray-500 mt-1">Spending exceeds income</p>
          </div>
          {data.debtToIncomeRatio > 0 && (
            <DebtToIncomeIndicator
              ratio={data.debtToIncomeRatio}
              level={data.debtToIncomeLevel}
              size="small"
            />
          )}
          <p className="text-xs text-gray-400">Review your budget and reduce expenses</p>
        </div>
      </Card>
    );
  }

  // Has surplus - show main card
  return (
    <>
      <Card className="p-6 border border-[#2a2a2a] bg-[#1a1a1a] rounded-xl">
        <div className="flex items-start justify-between mb-4">
          <p className="text-sm text-gray-400">Budget Surplus</p>
          <div className="p-3 bg-emerald-500/20 rounded-lg">
            <TrendingDown className="w-6 h-6 text-emerald-400" />
          </div>
        </div>

        <div className="space-y-4">
          {/* Surplus amount */}
          <div>
            <h3 className="text-3xl font-bold text-white">
              ${data.availableToApply.toFixed(2)}
            </h3>
            <p className="text-xs text-gray-500 mt-1">Available this month</p>
          </div>

          {/* Debt-to-Income Indicator */}
          <DebtToIncomeIndicator
            ratio={data.debtToIncomeRatio}
            level={data.debtToIncomeLevel}
            size="small"
          />

          {/* Apply button or success message */}
          {applied ? (
            <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Applied to debt payments!</span>
            </div>
          ) : (
            <Button
              onClick={() => setShowModal(true)}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium"
            >
              Apply to Debt
            </Button>
          )}

          {/* Breakdown */}
          <div className="pt-2 border-t border-[#2a2a2a] space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Income</span>
              <span className="text-white">${data.monthlyIncome.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Expenses</span>
              <span className="text-white">-${data.totalActualExpenses.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Debt Minimums</span>
              <span className="text-white">-${data.totalMinimumPayments.toFixed(2)}</span>
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
