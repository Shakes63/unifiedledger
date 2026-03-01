'use client';

import React, { useMemo } from 'react';
import Decimal from 'decimal.js';

interface AllocationChartData {
  expenses: number;
  savings: number;
  debtPayments: number;
  surplus: number;
  totalIncome: number;
}

interface BudgetAllocationChartProps {
  data: AllocationChartData;
  showActual?: boolean;
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

interface Segment {
  key: string;
  label: string;
  value: number;
  color: string;
  pct: number;
}

export function BudgetAllocationChart({ data }: BudgetAllocationChartProps) {
  const total = data.totalIncome || 1;

  const segments: Segment[] = useMemo(() => {
    const raw = [
      { key: 'expenses',     label: 'Expenses', value: data.expenses,     color: 'var(--color-expense)' },
      { key: 'savings',      label: 'Savings',  value: data.savings,      color: 'var(--color-success)' },
      { key: 'debtPayments', label: 'Debt',     value: data.debtPayments, color: 'var(--color-error)' },
      { key: 'surplus',      label: 'Surplus',  value: data.surplus,      color: 'var(--color-income)' },
    ];
    return raw
      .filter(s => s.value > 0)
      .map(s => ({
        ...s,
        pct: new Decimal(s.value).div(total).times(100).toNumber(),
      }));
  }, [data, total]);

  if (segments.length === 0) {
    return (
      <div
        className="rounded-xl p-5 flex items-center justify-center h-full min-h-[120px]"
        style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
      >
        <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>No budget data available</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-5 h-full"
      style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
    >
      {/* Header */}
      <div className="flex items-baseline justify-between mb-4">
        <span
          className="text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: 'var(--color-muted-foreground)' }}
        >
          Income Allocation
        </span>
        <span className="text-xs font-mono tabular-nums" style={{ color: 'var(--color-muted-foreground)' }}>
          ${fmt(data.totalIncome)} total
        </span>
      </div>

      {/* Stacked horizontal bar */}
      <div className="flex h-7 rounded-lg overflow-hidden gap-px mb-5">
        {segments.map(seg => (
          <div
            key={seg.key}
            className="h-full transition-all duration-500 relative group"
            style={{ width: `${seg.pct}%`, backgroundColor: seg.color, flexShrink: 0 }}
            title={`${seg.label}: $${fmt(seg.value)} (${seg.pct.toFixed(1)}%)`}
          >
            {/* Hover tooltip */}
            <div
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded text-[10px] font-mono whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10"
              style={{
                backgroundColor: 'var(--color-foreground)',
                color: 'var(--color-background)',
              }}
            >
              {seg.label} · ${fmt(seg.value)} · {seg.pct.toFixed(1)}%
            </div>
          </div>
        ))}
      </div>

      {/* Segment labels */}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${segments.length}, 1fr)` }}>
        {segments.map(seg => (
          <div key={seg.key}>
            {/* Colored indicator */}
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
              <span className="text-[10px] font-semibold uppercase tracking-widest truncate" style={{ color: 'var(--color-muted-foreground)' }}>
                {seg.label}
              </span>
            </div>
            <div className="font-mono tabular-nums text-sm font-semibold leading-none mb-0.5" style={{ color: seg.color }}>
              ${fmt(seg.value)}
            </div>
            <div className="text-[10px] font-mono tabular-nums" style={{ color: 'var(--color-muted-foreground)' }}>
              {seg.pct.toFixed(1)}%
            </div>
          </div>
        ))}
      </div>

      {/* Bottom line: unaccounted */}
      {(() => {
        const accounted = segments.reduce((s, seg) => s + seg.value, 0);
        const unaccounted = data.totalIncome - accounted;
        if (Math.abs(unaccounted) < 1) return null;
        return (
          <div
            className="mt-4 pt-3 flex items-center justify-between text-[11px]"
            style={{ borderTop: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)' }}
          >
            <span style={{ color: 'var(--color-muted-foreground)' }}>Unallocated</span>
            <span className="font-mono tabular-nums" style={{ color: unaccounted > 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
              {unaccounted > 0 ? '+' : ''}${fmt(unaccounted)}
            </span>
          </div>
        );
      })()}
    </div>
  );
}
