'use client';

import React, { useState } from 'react';
import Decimal from 'decimal.js';
import { AlertTriangle, RefreshCcw, Pencil, Check, X } from 'lucide-react';

interface Category {
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
}

interface CategoryBudgetProgressProps {
  category: Category;
  daysRemaining: number;
  onEdit: (categoryId: string, newBudget: number) => void;
  listRow?: boolean;
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function CategoryBudgetProgress({
  category,
  daysRemaining,
  onEdit,
  listRow = false,
}: CategoryBudgetProgressProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(category.monthlyBudget.toString());

  const handleSave = () => {
    const v = parseFloat(editValue);
    if (!isNaN(v) && v >= 0) { onEdit(category.id, v); setIsEditing(false); }
  };
  const handleCancel = () => { setEditValue(category.monthlyBudget.toString()); setIsEditing(false); };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    else if (e.key === 'Escape') handleCancel();
  };

  const isIncome = category.type === 'income';
  const rolloverEnabled = category.rolloverEnabled || false;
  const rolloverBalance = category.rolloverBalance || 0;
  const effectiveBudget = category.effectiveBudget || category.monthlyBudget;
  const hasRolloverBonus   = rolloverEnabled && rolloverBalance > 0 && !isIncome;
  const hasRolloverPenalty = rolloverEnabled && rolloverBalance < 0 && !isIncome;

  const isPaceTooHigh =
    daysRemaining > 0 &&
    category.budgetedDailyAverage > 0 &&
    (isIncome
      ? category.dailyAverage < category.budgetedDailyAverage * 0.8
      : category.dailyAverage > category.budgetedDailyAverage * 1.2);

  const isProjectedToExceed =
    category.monthlyBudget > 0 &&
    (isIncome
      ? category.projectedMonthEnd < category.monthlyBudget
      : category.projectedMonthEnd > category.monthlyBudget);

  // Bar color
  const barColor =
    category.status === 'exceeded'
      ? isIncome ? 'var(--color-success)' : 'var(--color-error)'
      : category.status === 'warning'
      ? 'var(--color-warning)'
      : category.status === 'on_track'
      ? isIncome ? 'var(--color-income)' : 'var(--color-success)'
      : 'var(--color-muted)';

  // Status pill text + color
  const statusText =
    category.monthlyBudget === 0 ? 'unset'
    : category.remaining === 0 ? 'on target'
    : isIncome
      ? category.remaining > 0 ? `$${fmt(category.remaining)} short` : `+$${fmt(Math.abs(category.remaining))}`
      : category.remaining > 0 ? `$${fmt(category.remaining)} left` : `$${fmt(Math.abs(category.remaining))} over`;

  const statusColor =
    category.monthlyBudget === 0 ? 'var(--color-muted-foreground)'
    : category.remaining === 0 ? 'var(--color-success)'
    : isIncome
      ? category.remaining > 0 ? 'var(--color-warning)' : 'var(--color-success)'
      : category.remaining > 0 ? 'var(--color-success)' : 'var(--color-error)';

  // ── List row layout ───────────────────────────────────────────────────────
  if (listRow) {
    return (
      <div className="group flex items-center gap-3 px-4 py-3 transition-colors" style={{ backgroundColor: 'transparent' }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'color-mix(in oklch, var(--color-elevated) 50%, transparent)')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        {/* Name + badges */}
        <div className="w-40 sm:w-48 shrink-0 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[13px] font-medium truncate" style={{ color: 'var(--color-foreground)' }}>
              {category.name}
            </span>
            {rolloverEnabled && (
              <span
                className="inline-flex items-center gap-0.5 text-[9px] font-mono px-1 py-px rounded"
                style={{
                  backgroundColor: hasRolloverPenalty
                    ? 'color-mix(in oklch, var(--color-error) 15%, transparent)'
                    : hasRolloverBonus
                    ? 'color-mix(in oklch, var(--color-success) 15%, transparent)'
                    : 'color-mix(in oklch, var(--color-muted) 30%, transparent)',
                  color: hasRolloverPenalty
                    ? 'var(--color-error)'
                    : hasRolloverBonus
                    ? 'var(--color-success)'
                    : 'var(--color-muted-foreground)',
                }}
              >
                <RefreshCcw className="w-2 h-2" />
                {rolloverBalance !== 0 && `${rolloverBalance >= 0 ? '+' : ''}${rolloverBalance.toFixed(0)}`}
              </span>
            )}
            {isPaceTooHigh && (
              <AlertTriangle className="w-3 h-3 shrink-0" style={{ color: 'var(--color-warning)' }} />
            )}
          </div>
          {category.incomeFrequency && category.incomeFrequency !== 'variable' && (
            <span className="text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>
              {category.incomeFrequency === 'biweekly' ? 'bi-weekly' : category.incomeFrequency}
            </span>
          )}
        </div>

        {/* Progress bar — the visual centerpiece */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>$</span>
              <input
                type="number"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 min-w-0 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1"
                style={{
                  backgroundColor: 'var(--color-input)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-foreground)',
                }}
                autoFocus
                min="0"
                step="0.01"
              />
              <button onClick={handleSave} title="Save">
                <Check className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} />
              </button>
              <button onClick={handleCancel} title="Cancel">
                <X className="w-3.5 h-3.5" style={{ color: 'var(--color-error)' }} />
              </button>
            </div>
          ) : (
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 80%, transparent)' }}
            >
              {category.monthlyBudget > 0 && (
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, category.percentage)}%`, backgroundColor: barColor }}
                />
              )}
            </div>
          )}

          {/* Projection hint — visible on hover when days remaining */}
          {!isEditing && isProjectedToExceed && daysRemaining > 0 && (
            <div className="text-[10px] mt-0.5 font-mono opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: isIncome ? 'var(--color-warning)' : 'var(--color-error)' }}>
              Proj. ${fmt(category.projectedMonthEnd)}
            </div>
          )}
        </div>

        {/* Amounts */}
        <div className="w-28 sm:w-32 shrink-0 text-right">
          <span className="text-[12px] font-mono tabular-nums" style={{ color: 'var(--color-foreground)' }}>
            ${fmt(category.actualSpent)}
          </span>
          {category.monthlyBudget > 0 && (
            <span className="text-[11px] font-mono tabular-nums" style={{ color: 'var(--color-muted-foreground)' }}>
              {' '}/ ${fmt(hasRolloverBonus ? effectiveBudget : category.monthlyBudget)}
            </span>
          )}
        </div>

        {/* Status */}
        <div className="w-20 sm:w-24 shrink-0 text-right">
          <span className="text-[11px] font-mono tabular-nums" style={{ color: statusColor }}>
            {statusText}
          </span>
        </div>

        {/* Edit button — revealed on hover */}
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            title="Edit budget"
          >
            <Pencil className="w-3.5 h-3.5" style={{ color: 'var(--color-muted-foreground)' }} />
          </button>
        )}
        {isEditing && <div className="w-3.5 shrink-0" />}
      </div>
    );
  }

  // ── Card layout (original, for BudgetGroupSection) ───────────────────────
  return (
    <div
      className="rounded-xl p-4 transition-colors"
      style={{
        backgroundColor: 'var(--color-background)',
        border: '1px solid var(--color-border)',
      }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-elevated)')}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--color-background)')}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-medium truncate" style={{ color: 'var(--color-foreground)' }}>
              {category.name}
            </h3>
            {category.incomeFrequency && category.incomeFrequency !== 'variable' && (
              <span
                className="px-1.5 py-px text-[10px] rounded-full font-medium"
                style={{ backgroundColor: 'color-mix(in oklch, var(--color-income) 15%, transparent)', color: 'var(--color-income)' }}
              >
                {category.incomeFrequency === 'biweekly' ? 'bi-weekly' : category.incomeFrequency}
              </span>
            )}
            {rolloverEnabled && (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-px rounded-full"
                style={{
                  backgroundColor: hasRolloverPenalty
                    ? 'color-mix(in oklch, var(--color-error) 15%, transparent)'
                    : hasRolloverBonus
                    ? 'color-mix(in oklch, var(--color-success) 15%, transparent)'
                    : 'color-mix(in oklch, var(--color-muted) 30%, transparent)',
                  color: hasRolloverPenalty ? 'var(--color-error)' : hasRolloverBonus ? 'var(--color-success)' : 'var(--color-muted-foreground)',
                }}
                title={`Rollover ${rolloverBalance >= 0 ? '+' : ''}$${rolloverBalance.toFixed(2)}`}
              >
                <RefreshCcw className="w-2.5 h-2.5" />
                {rolloverBalance !== 0 && `${rolloverBalance >= 0 ? '+' : ''}$${rolloverBalance.toFixed(0)}`}
              </span>
            )}
          </div>
          <span className="text-[10px] capitalize" style={{ color: 'var(--color-muted-foreground)' }}>
            {category.type.replace(/_/g, ' ')}
          </span>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-xs transition-opacity"
            style={{ color: 'var(--color-primary)' }}
          >
            Edit
          </button>
        )}
      </div>

      {/* Amount */}
      <div className="mb-2">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>$</span>
            <input
              type="number"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
              style={{
                backgroundColor: 'var(--color-input)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-foreground)',
              }}
              autoFocus min="0" step="0.01"
            />
            <button
              onClick={handleSave}
              className="px-2.5 py-1.5 text-xs rounded-lg"
              style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="px-2.5 py-1.5 text-xs rounded-lg"
              style={{ backgroundColor: 'var(--color-muted)', color: 'var(--color-foreground)' }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-semibold font-mono tabular-nums" style={{ color: 'var(--color-foreground)' }}>
                ${category.actualSpent.toFixed(2)}
              </span>
              <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>/</span>
              <span className="text-xs font-mono tabular-nums" style={{ color: 'var(--color-muted-foreground)' }}>
                ${hasRolloverBonus ? effectiveBudget.toFixed(2) : category.monthlyBudget.toFixed(2)}
              </span>
            </div>
            {hasRolloverBonus && (
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                ${category.monthlyBudget.toFixed(2)} base + ${rolloverBalance.toFixed(2)} rollover
              </div>
            )}
            {hasRolloverPenalty && (
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-error)' }}>
                ${rolloverBalance.toFixed(2)} rollover deficit
              </div>
            )}
          </div>
        )}
      </div>

      {/* Progress bar */}
      {category.monthlyBudget > 0 && (
        <>
          <div
            className="w-full h-2 rounded-full overflow-hidden mb-2"
            style={{ backgroundColor: 'color-mix(in oklch, var(--color-muted) 50%, transparent)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, category.percentage)}%`, backgroundColor: barColor }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span
              style={{ color: category.isOverBudget
                ? isIncome ? 'var(--color-success)' : 'var(--color-error)'
                : 'var(--color-muted-foreground)' }}
            >
              {category.percentage.toFixed(1)}%
            </span>
            <span style={{ color: statusColor }}>{statusText}</span>
          </div>
        </>
      )}

      {category.monthlyBudget === 0 && (
        <div className="text-[10px] italic" style={{ color: 'var(--color-muted-foreground)' }}>No budget set</div>
      )}

      {/* Daily pace details */}
      {category.monthlyBudget > 0 && daysRemaining > 0 && category.shouldShowDailyAverage && (
        <div
          className="mt-3 pt-3 space-y-1"
          style={{ borderTop: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)' }}
        >
          <div className="flex items-center justify-between text-[10px]">
            <span style={{ color: 'var(--color-muted-foreground)' }}>Daily avg:</span>
            <span
              className={isPaceTooHigh ? 'flex items-center gap-1' : ''}
              style={{ color: isPaceTooHigh ? 'var(--color-warning)' : 'var(--color-foreground)' }}
            >
              ${category.dailyAverage.toFixed(2)}
              {isPaceTooHigh && <AlertTriangle className="w-3 h-3" />}
            </span>
          </div>
          {isPaceTooHigh && (
            <div className="text-[10px]" style={{ color: 'var(--color-warning)' }}>
              {isIncome
                ? `Target: $${category.budgetedDailyAverage.toFixed(2)}/day`
                : `Budget: $${category.budgetedDailyAverage.toFixed(2)}/day`}
            </div>
          )}
          {isProjectedToExceed && (
            <div className="text-[10px]" style={{ color: isIncome ? 'var(--color-warning)' : 'var(--color-error)' }}>
              Projected ${category.projectedMonthEnd.toFixed(2)} (
              {isIncome
                ? `short $${new Decimal(category.monthlyBudget).minus(category.projectedMonthEnd).toNumber().toFixed(2)}`
                : `over $${new Decimal(category.projectedMonthEnd).minus(category.monthlyBudget).toNumber().toFixed(2)}`}
              )
            </div>
          )}
          {!isProjectedToExceed && category.projectedMonthEnd > 0 && (
            <div className="text-[10px]" style={{ color: 'var(--color-success)' }}>
              Projected ${category.projectedMonthEnd.toFixed(2)} ✓
            </div>
          )}
          <div className="text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>
            {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left
          </div>
        </div>
      )}

      {category.monthlyBudget > 0 && daysRemaining > 0 && isIncome && !category.shouldShowDailyAverage && category.incomeFrequency && (
        <div
          className="mt-3 pt-3 space-y-1"
          style={{ borderTop: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)' }}
        >
          <div className="text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>
            Expected ${category.monthlyBudget.toFixed(2)} this month
          </div>
          {category.actualSpent < category.monthlyBudget && (
            <div className="text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>
              Awaiting {category.incomeFrequency} payment
            </div>
          )}
        </div>
      )}
    </div>
  );
}
