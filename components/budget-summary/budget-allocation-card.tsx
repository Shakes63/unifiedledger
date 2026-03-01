'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import Decimal from 'decimal.js';

interface CategoryDetail {
  id: string;
  name: string;
  budgeted: number;
  actual: number;
  percentage: number;
}

interface BudgetAllocationCardProps {
  title: string;
  icon: React.ReactNode;
  budgeted: number;
  actual: number;
  color: string;
  type: 'income' | 'expense' | 'savings' | 'debt';
  categories?: CategoryDetail[];
  defaultExpanded?: boolean;
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function BudgetAllocationCard({
  title,
  icon,
  budgeted,
  actual,
  color,
  type,
  categories = [],
  defaultExpanded = false,
}: BudgetAllocationCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const percentage = budgeted > 0
    ? new Decimal(actual).div(budgeted).times(100).toNumber()
    : 0;

  const variance = new Decimal(actual).minus(budgeted).toNumber();

  // Status: for income/savings, more is better; for expenses/debt, less is better
  const isGoodVariance =
    type === 'income' || type === 'savings'
      ? variance >= 0
      : variance <= 0;

  const barColor =
    type === 'income' || type === 'savings'
      ? percentage >= 80 ? 'var(--color-success)' : percentage >= 50 ? 'var(--color-warning)' : 'var(--color-error)'
      : percentage <= 80 ? 'var(--color-success)' : percentage <= 100 ? 'var(--color-warning)' : 'var(--color-error)';

  const varianceText =
    type === 'income'
      ? variance >= 0 ? `+$${fmt(variance)} above target` : `$${fmt(-variance)} below target`
      : type === 'savings'
      ? variance >= 0 ? `+$${fmt(variance)} ahead` : `$${fmt(-variance)} behind`
      : variance <= 0 ? `$${fmt(-variance)} under budget` : `$${fmt(variance)} over budget`;

  const hasCategories = categories.length > 0;

  // Sort categories by actual descending
  const sortedCategories = [...categories].sort((a, b) => b.actual - a.actual);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
    >
      {/* Header */}
      <div
        className="px-4 pt-4 pb-3"
        style={{ borderLeft: `3px solid ${color}` }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded flex items-center justify-center"
              style={{
                backgroundColor: `color-mix(in oklch, ${color} 15%, transparent)`,
                color,
              }}
            >
              {icon}
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)' }}>
              {title}
            </span>
          </div>
          {hasCategories && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 text-[10px] uppercase tracking-widest transition-opacity"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              {isExpanded ? 'Less' : `${categories.length} categories`}
              {isExpanded
                ? <ChevronUp className="w-3 h-3" />
                : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>

        {/* Numbers */}
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-xl font-bold font-mono tabular-nums leading-none" style={{ color }}>
            ${fmt(actual)}
          </span>
          <span className="text-xs font-mono tabular-nums" style={{ color: 'var(--color-muted-foreground)' }}>
            / ${fmt(budgeted)}
          </span>
        </div>

        {/* Progress bar */}
        <div
          className="h-1.5 rounded-full overflow-hidden mb-1.5"
          style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 80%, transparent)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, percentage)}%`, backgroundColor: barColor }}
          />
        </div>

        {/* Status row */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono tabular-nums" style={{ color: 'var(--color-muted-foreground)' }}>
            {percentage.toFixed(1)}%
          </span>
          <span
            className="text-[10px] font-mono tabular-nums"
            style={{ color: isGoodVariance ? 'var(--color-success)' : 'var(--color-error)' }}
          >
            {varianceText}
          </span>
        </div>
      </div>

      {/* Expanded category list */}
      {isExpanded && hasCategories && (
        <div style={{ borderTop: '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)' }}>
          {sortedCategories.map((cat, i) => {
            const catPct = cat.budgeted > 0 ? (cat.actual / cat.budgeted) * 100 : 0;
            const catBar =
              type === 'income' || type === 'savings'
                ? catPct >= 80 ? 'var(--color-success)' : 'var(--color-warning)'
                : catPct <= 80 ? 'var(--color-success)' : catPct <= 100 ? 'var(--color-warning)' : 'var(--color-error)';

            return (
              <div
                key={cat.id}
                className="group flex items-center gap-3 px-4 py-2.5 transition-colors"
                style={{
                  borderBottom: i < sortedCategories.length - 1
                    ? '1px solid color-mix(in oklch, var(--color-border) 30%, transparent)'
                    : 'none',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'color-mix(in oklch, var(--color-elevated) 50%, transparent)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                {/* Name */}
                <span
                  className="text-[12px] truncate flex-1 min-w-0"
                  style={{ color: 'var(--color-foreground)' }}
                >
                  {cat.name}
                </span>

                {/* Mini bar */}
                <div
                  className="w-16 h-1 rounded-full overflow-hidden shrink-0"
                  style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 80%, transparent)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, catPct)}%`, backgroundColor: catBar }}
                  />
                </div>

                {/* Amount */}
                <span
                  className="text-[11px] font-mono tabular-nums shrink-0"
                  style={{ color: 'var(--color-foreground)' }}
                >
                  ${fmt(cat.actual)}
                </span>
                <span
                  className="text-[10px] font-mono tabular-nums shrink-0"
                  style={{ color: 'var(--color-muted-foreground)' }}
                >
                  / ${fmt(cat.budgeted)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
