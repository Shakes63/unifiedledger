'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, TrendingUp } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';

interface BudgetStatus {
  categoryId: string;
  categoryName: string;
  monthlyBudget: number;
  spent: number;
  remaining: number;
  percentage: number;
  warningLevel: 'none' | 'warning' | 'exceeded';
  isOverBudget: boolean;
}

interface BudgetWarningProps {
  categoryId?: string;
  transactionAmount?: number;
  onBudgetCheck?: (status: BudgetStatus | null) => void;
}

export function BudgetWarning({
  categoryId,
  transactionAmount = 0,
  onBudgetCheck,
}: BudgetWarningProps) {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus | null>(null);
  const [_loading, setLoading] = useState(false);
  const [projectedPercentage, setProjectedPercentage] = useState(0);

  useEffect(() => {
    if (!categoryId || !selectedHouseholdId) {
      setBudgetStatus(null);
      onBudgetCheck?.(null);
      return;
    }

    const checkBudget = async () => {
      try {
        setLoading(true);
        const response = await fetchWithHousehold(`/api/budgets/check?categoryId=${categoryId}`);

        if (!response.ok) {
          console.error('Failed to check budget');
          return;
        }

        const data: BudgetStatus = await response.json();
        setBudgetStatus(data);

        // Calculate projected percentage with new transaction
        if (data.monthlyBudget > 0) {
          const projectedSpending = data.spent + transactionAmount;
          const projected = (projectedSpending / data.monthlyBudget) * 100;
          setProjectedPercentage(Math.round(projected));
        }

        onBudgetCheck?.(data);
      } catch (error) {
        console.error('Error checking budget:', error);
        if (error instanceof Error && error.message === 'No household selected') {
          setBudgetStatus(null);
          onBudgetCheck?.(null);
        }
      } finally {
        setLoading(false);
      }
    };

    checkBudget();
  }, [categoryId, transactionAmount, selectedHouseholdId, fetchWithHousehold, onBudgetCheck]);

  if (!budgetStatus || budgetStatus.monthlyBudget === 0) {
    return null;
  }

  const {
    categoryName,
    monthlyBudget,
    spent,
    remaining,
    percentage,
    warningLevel,
    isOverBudget: _isOverBudget,
  } = budgetStatus;

  // Determine colors based on warning level
  let bgColor = 'bg-blue-500/10';
  let borderColor = 'border-blue-500/20';
  let textColor = 'text-blue-400';
  let _progressColor = 'bg-blue-500';

  if (warningLevel === 'warning') {
    bgColor = 'bg-amber-500/10';
    borderColor = 'border-amber-500/20';
    textColor = 'text-amber-400';
    _progressColor = 'bg-amber-500';
  } else if (warningLevel === 'exceeded') {
    bgColor = 'bg-red-500/10';
    borderColor = 'border-red-500/20';
    textColor = 'text-red-400';
    _progressColor = 'bg-red-500';
  }

  return (
    <div className={`p-3 rounded-lg border ${bgColor} ${borderColor} space-y-2`}>
      <div className="flex items-center gap-2">
        {warningLevel !== 'none' && (
          <AlertCircle className={`w-4 h-4 ${textColor}`} />
        )}
        <span className={`text-sm font-medium ${textColor}`}>
          {categoryName} Budget
        </span>
        <span className={`text-xs ml-auto ${textColor}`}>
          {percentage}% used
        </span>
      </div>

      <Progress
        value={Math.min(percentage, 100)}
        className="h-2 bg-[#242424]"
      />

      <div className="flex justify-between text-xs text-gray-400">
        <span>
          Spent: ${spent.toFixed(2)} of ${monthlyBudget.toFixed(2)}
        </span>
        <span className={remaining > 0 ? 'text-emerald-400' : 'text-red-400'}>
          {remaining > 0 ? `$${remaining.toFixed(2)} left` : `Over by $${Math.abs(remaining).toFixed(2)}`}
        </span>
      </div>

      {transactionAmount > 0 && (
        <div className="flex items-center gap-2 pt-1 border-t border-[#2a2a2a]">
          <TrendingUp className="w-3 h-3 text-gray-500" />
          <span className="text-xs text-gray-400">
            After this transaction: <span className={`font-medium ${projectedPercentage > 100 ? 'text-red-400' : 'text-gray-300'}`}>
              {projectedPercentage}%
            </span>
          </span>
        </div>
      )}

      {warningLevel === 'warning' && (
        <p className={`text-xs ${textColor} pt-1 flex items-center gap-1`}>
          <AlertCircle className="w-3 h-3" />
          You're nearing your budget limit
        </p>
      )}

      {warningLevel === 'exceeded' && (
        <p className={`text-xs ${textColor} pt-1 flex items-center gap-1`}>
          <AlertCircle className="w-3 h-3" />
          You've exceeded your budget for this category
        </p>
      )}
    </div>
  );
}
