'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';
import Decimal from 'decimal.js';
import Link from 'next/link';

interface MonthlySurplusCardProps {
  budgetedSurplus: number;
  actualSurplus: number;
  totalIncome: number;
}

function fmt(n: number) {
  return Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function MonthlySurplusCard({ budgetedSurplus, actualSurplus, totalIncome }: MonthlySurplusCardProps) {
  const variance = new Decimal(actualSurplus).minus(budgetedSurplus).toNumber();

  const actualPct = totalIncome > 0
    ? new Decimal(actualSurplus).div(totalIncome).times(100).toNumber()
    : 0;

  const budgetedPct = totalIncome > 0
    ? new Decimal(budgetedSurplus).div(totalIncome).times(100).toNumber()
    : 0;

  const isSurplus = actualSurplus >= 0;
  const primaryColor = isSurplus ? 'var(--color-success)' : 'var(--color-error)';
  const StatusIcon = actualSurplus === 0 ? Minus : isSurplus ? TrendingUp : TrendingDown;

  return (
    <div
      className="rounded-xl p-5 h-full flex flex-col"
      style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
    >
      {/* Label row */}
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: 'var(--color-muted-foreground)' }}
        >
          Monthly {isSurplus ? 'Surplus' : 'Shortfall'}
        </span>
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `color-mix(in oklch, ${primaryColor} 15%, transparent)` }}
        >
          <StatusIcon className="w-3.5 h-3.5" style={{ color: primaryColor }} />
        </div>
      </div>

      {/* Hero number */}
      <div className="mb-3">
        <div className="flex items-baseline gap-1 leading-none mb-1">
          <span
            className="text-[2.75rem] font-bold font-mono tabular-nums leading-none"
            style={{ color: primaryColor }}
          >
            {isSurplus ? '+' : '−'}${fmt(actualSurplus)}
          </span>
        </div>
        <span className="text-[11px] font-mono" style={{ color: 'var(--color-muted-foreground)' }}>
          {actualPct.toFixed(1)}% of income
        </span>
      </div>

      {/* Budgeted vs actual */}
      <div
        className="rounded-lg px-3 py-2.5 mb-3 grid grid-cols-2 gap-3"
        style={{ backgroundColor: 'color-mix(in oklch, var(--color-elevated) 60%, transparent)' }}
      >
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-widest block mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
            Budgeted
          </span>
          <span className="text-sm font-mono tabular-nums font-semibold" style={{ color: 'var(--color-foreground)' }}>
            {budgetedSurplus >= 0 ? '+' : '−'}${fmt(budgetedSurplus)}
          </span>
          <span className="text-[10px] font-mono block" style={{ color: 'var(--color-muted-foreground)' }}>
            {budgetedPct.toFixed(1)}%
          </span>
        </div>
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-widest block mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
            Variance
          </span>
          <span
            className="text-sm font-mono tabular-nums font-semibold"
            style={{ color: variance >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}
          >
            {variance >= 0 ? '+' : '−'}${fmt(variance)}
          </span>
          <span
            className="text-[10px] font-mono block"
            style={{ color: variance >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}
          >
            vs plan
          </span>
        </div>
      </div>

      {/* Quick actions or warning */}
      <div className="mt-auto">
        {isSurplus && actualSurplus > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: 'var(--color-muted-foreground)' }}>
              Put your surplus to work
            </p>
            <div className="flex gap-2">
              <Link
                href="/dashboard/debts"
                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                style={{
                  backgroundColor: 'color-mix(in oklch, var(--color-primary) 12%, transparent)',
                  color: 'var(--color-primary)',
                  border: '1px solid color-mix(in oklch, var(--color-primary) 20%, transparent)',
                }}
              >
                Debt
                <ArrowRight className="w-3 h-3" />
              </Link>
              <Link
                href="/dashboard/goals"
                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                style={{
                  backgroundColor: 'color-mix(in oklch, var(--color-success) 12%, transparent)',
                  color: 'var(--color-success)',
                  border: '1px solid color-mix(in oklch, var(--color-success) 20%, transparent)',
                }}
              >
                Savings
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}

        {!isSurplus && (
          <div
            className="rounded-lg px-3 py-2"
            style={{
              backgroundColor: 'color-mix(in oklch, var(--color-error) 8%, transparent)',
              border: '1px solid color-mix(in oklch, var(--color-error) 20%, transparent)',
            }}
          >
            <p className="text-[11px] mb-1.5" style={{ color: 'var(--color-error)' }}>
              Spending exceeds income this month.
            </p>
            <Link
              href="/dashboard/budgets"
              className="inline-flex items-center gap-1 text-[11px] font-medium"
              style={{ color: 'var(--color-error)' }}
            >
              Review Budget <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
