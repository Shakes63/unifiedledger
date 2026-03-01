'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { CategoryBudgetProgress } from './category-budget-progress';
import Decimal from 'decimal.js';

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
}

interface BudgetGroup {
  id: string;
  name: string;
  type: string;
  targetAllocation: number | null;
  totalBudget: number;
  totalSpent: number;
}

interface BudgetGroupSectionProps {
  group: BudgetGroup;
  categories: CategoryData[];
  monthlyIncome?: number;
  daysRemaining: number;
  onEditBudget: (categoryId: string, newBudget: number) => void;
  defaultExpanded?: boolean;
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function BudgetGroupSection({
  group,
  categories,
  monthlyIncome = 0,
  daysRemaining,
  onEditBudget,
  defaultExpanded = true,
}: BudgetGroupSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const totalBudget = categories.reduce((s, c) => new Decimal(s).plus(c.monthlyBudget || 0).toNumber(), 0);
  const totalSpent  = categories.reduce((s, c) => new Decimal(s).plus(c.actualSpent || 0).toNumber(), 0);
  const remaining   = new Decimal(totalBudget).minus(totalSpent).toNumber();
  const percentage  = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const targetAmount = group.targetAllocation && monthlyIncome > 0
    ? new Decimal(monthlyIncome).times(group.targetAllocation / 100).toNumber()
    : null;

  const status: 'on_track' | 'warning' | 'exceeded' | 'unbudgeted' =
    totalBudget === 0 ? 'unbudgeted'
    : percentage > 100 ? 'exceeded'
    : percentage >= 80 ? 'warning'
    : 'on_track';

  const barColor =
    status === 'exceeded' ? 'var(--color-error)'
    : status === 'warning' ? 'var(--color-warning)'
    : status === 'on_track' ? 'var(--color-success)'
    : 'var(--color-muted-foreground)';

  if (categories.length === 0) return null;

  return (
    <div>
      {/* Group header row */}
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 group"
        >
          <div
            className="w-4 h-4 rounded flex items-center justify-center transition-colors"
            style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 80%, transparent)' }}
          >
            {isExpanded
              ? <ChevronDown className="w-3 h-3" style={{ color: 'var(--color-muted-foreground)' }} />
              : <ChevronRight className="w-3 h-3" style={{ color: 'var(--color-muted-foreground)' }} />}
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-foreground)' }}>
            {group.name}
          </span>
          {group.targetAllocation && (
            <span
              className="text-[10px] px-1.5 py-px rounded-full"
              style={{
                backgroundColor: 'color-mix(in oklch, var(--color-elevated) 80%, transparent)',
                color: 'var(--color-muted-foreground)',
              }}
            >
              {group.targetAllocation}% target
            </span>
          )}
        </button>

        {/* Progress bar inline */}
        <div
          className="flex-1 h-1 rounded-full overflow-hidden"
          style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 80%, transparent)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, percentage)}%`, backgroundColor: barColor }}
          />
        </div>

        {/* Totals */}
        <span className="text-[11px] font-mono tabular-nums shrink-0" style={{ color: 'var(--color-muted-foreground)' }}>
          ${fmt(totalSpent)} <span style={{ color: 'color-mix(in oklch, var(--color-muted-foreground) 50%, transparent)' }}>/ ${fmt(totalBudget)}</span>
        </span>
        <span
          className="text-[11px] font-mono tabular-nums shrink-0"
          style={{ color: barColor }}
        >
          {remaining >= 0 ? `$${fmt(remaining)} left` : `$${fmt(Math.abs(remaining))} over`}
        </span>
      </div>

      {/* Target hint */}
      {targetAmount !== null && totalBudget !== targetAmount && (
        <div className="ml-8 mb-2 text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>
          Target: ${fmt(targetAmount)}
        </div>
      )}

      {/* Expanded: connected list of categories */}
      {isExpanded && (
        <div
          className="rounded-xl overflow-hidden ml-8"
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
                onEdit={onEditBudget}
                listRow
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
