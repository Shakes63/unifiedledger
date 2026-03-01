'use client';

import React from 'react';
import Decimal from 'decimal.js';

export interface DebtBudgetData {
  totalRecommendedPayments: number;
  totalActualPaid: number;
  debts: { debtId: string }[];
}

interface BudgetSummaryCardProps {
  summary: {
    totalIncome: number;
    totalIncomeActual: number;
    totalExpenseBudget: number;
    totalExpenseActual: number;
    totalSavingsBudget: number;
    totalSavingsActual: number;
    budgetedSurplus: number;
    actualSurplus: number;
    adherenceScore: number;
    daysInMonth: number;
    daysRemaining: number;
    daysElapsed: number;
  };
  month: string;
  debtData?: DebtBudgetData | null;
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ── A single stat column ─────────────────────────────────────────────────────
function StatBlock({
  label,
  actual,
  budget,
  pct,
  accentColor,
  invertStatus, // true = more is better (income/savings), false = less is better (expenses)
}: {
  label: string;
  actual: number;
  budget: number;
  pct: number;
  accentColor: string;
  invertStatus?: boolean;
}) {
  const capped = Math.min(100, pct);
  const isGood = invertStatus ? pct >= 80 : pct <= 85;

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-baseline justify-between gap-1 mb-1">
        <span
          className="text-[10px] font-semibold uppercase tracking-widest truncate"
          style={{ color: 'var(--color-muted-foreground)' }}
        >
          {label}
        </span>
        <span
          className="text-[10px] font-mono tabular-nums shrink-0"
          style={{ color: 'var(--color-muted-foreground)' }}
        >
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="flex items-baseline gap-1.5 mb-2">
        <span
          className="text-base font-semibold font-mono tabular-nums leading-none"
          style={{ color: 'var(--color-foreground)' }}
        >
          ${fmt(actual)}
        </span>
        {budget > 0 && (
          <span
            className="text-[11px] font-mono tabular-nums"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            / ${fmt(budget)}
          </span>
        )}
      </div>
      {/* Thin progress bar */}
      <div
        className="h-1 rounded-full overflow-hidden"
        style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 80%, transparent)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${capped}%`,
            backgroundColor: isGood ? accentColor : 'var(--color-error)',
          }}
        />
      </div>
    </div>
  );
}

// ── Surplus block ─────────────────────────────────────────────────────────────
function SurplusBlock({ actual, budgeted }: { actual: number; budgeted: number }) {
  const isPositive = actual >= 0;
  return (
    <div className="flex-1 min-w-0">
      <span
        className="text-[10px] font-semibold uppercase tracking-widest block mb-1"
        style={{ color: 'var(--color-muted-foreground)' }}
      >
        Surplus
      </span>
      <div className="flex items-baseline gap-1.5 mb-2">
        <span
          className="text-base font-semibold font-mono tabular-nums leading-none"
          style={{ color: isPositive ? 'var(--color-success)' : 'var(--color-error)' }}
        >
          {isPositive ? '+' : '-'}${fmt(Math.abs(actual))}
        </span>
      </div>
      <div
        className="h-1 rounded-full overflow-hidden"
        style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 80%, transparent)' }}
      >
        {budgeted > 0 && (
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, (actual / budgeted) * 100)}%`,
              backgroundColor: isPositive ? 'var(--color-success)' : 'var(--color-error)',
            }}
          />
        )}
      </div>
    </div>
  );
}

export function BudgetSummaryCard({ summary, debtData }: BudgetSummaryCardProps) {
  const incomeActual  = summary.totalIncomeActual;
  const incomeBudget  = summary.totalIncome;
  const incomePct     = incomeBudget > 0 ? new Decimal(incomeActual).div(incomeBudget).times(100).toNumber() : 0;

  const expenseActual = summary.totalExpenseActual;
  const expenseBudget = summary.totalExpenseBudget;
  const expensePct    = expenseBudget > 0 ? new Decimal(expenseActual).div(expenseBudget).times(100).toNumber() : 0;

  const savingsActual = summary.totalSavingsActual;
  const savingsBudget = summary.totalSavingsBudget;
  const savingsPct    = savingsBudget > 0 ? new Decimal(savingsActual).div(savingsBudget).times(100).toNumber() : 0;

  const debtActual     = debtData?.totalActualPaid ?? 0;
  const debtRecommended = debtData?.totalRecommendedPayments ?? 0;
  const debtPct        = debtRecommended > 0 ? (debtActual / debtRecommended) * 100 : 0;
  const showDebt       = (debtData?.debts.length ?? 0) > 0;

  const adherenceLabel =
    summary.adherenceScore >= 90 ? 'Excellent'
    : summary.adherenceScore >= 70 ? 'Good'
    : summary.adherenceScore >= 50 ? 'Fair'
    : 'Needs work';

  const adherenceColor =
    summary.adherenceScore >= 90 ? 'var(--color-success)'
    : summary.adherenceScore >= 70 ? 'var(--color-income)'
    : summary.adherenceScore >= 50 ? 'var(--color-warning)'
    : 'var(--color-error)';

  const daysProgress = summary.daysInMonth > 0
    ? (summary.daysElapsed / summary.daysInMonth) * 100
    : 0;

  return (
    <div
      className="rounded-xl px-5 pt-4 pb-3.5"
      style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
    >
      {/* Stats row */}
      <div className="flex items-start gap-4 sm:gap-6">
        <StatBlock
          label="Income"
          actual={incomeActual}
          budget={incomeBudget}
          pct={incomePct}
          accentColor="var(--color-income)"
          invertStatus
        />

        {/* Divider */}
        <div className="w-px self-stretch" style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 60%, transparent)' }} />

        <StatBlock
          label="Expenses"
          actual={expenseActual}
          budget={expenseBudget}
          pct={expensePct}
          accentColor="var(--color-expense)"
        />

        {savingsBudget > 0 && (
          <>
            <div className="w-px self-stretch" style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 60%, transparent)' }} />
            <StatBlock
              label="Savings"
              actual={savingsActual}
              budget={savingsBudget}
              pct={savingsPct}
              accentColor="var(--color-success)"
              invertStatus
            />
          </>
        )}

        {showDebt && (
          <>
            <div className="w-px self-stretch" style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 60%, transparent)' }} />
            <StatBlock
              label="Debt Pmts"
              actual={debtActual}
              budget={debtRecommended}
              pct={debtPct}
              accentColor="var(--color-success)"
              invertStatus
            />
          </>
        )}

        <div className="w-px self-stretch" style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 60%, transparent)' }} />

        <SurplusBlock actual={summary.actualSurplus} budgeted={summary.budgetedSurplus} />
      </div>

      {/* Footer: adherence + days remaining */}
      <div
        className="flex items-center justify-between mt-3 pt-2.5"
        style={{ borderTop: '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)' }}
      >
        {/* Adherence */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)' }}>
            Adherence
          </span>
          <span className="text-[11px] font-semibold font-mono" style={{ color: adherenceColor }}>
            {summary.adherenceScore}%
          </span>
          <span className="text-[10px]" style={{ color: adherenceColor }}>{adherenceLabel}</span>
        </div>

        {/* Month timeline */}
        <div className="flex items-center gap-2">
          <div
            className="relative w-20 h-1 rounded-full overflow-hidden hidden sm:block"
            style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 80%, transparent)' }}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${daysProgress}%`, backgroundColor: 'var(--color-muted-foreground)' }}
            />
          </div>
          <span className="text-[10px] font-mono tabular-nums" style={{ color: 'var(--color-muted-foreground)' }}>
            {summary.daysRemaining > 0 ? `${summary.daysRemaining}d left` : 'Complete'}
          </span>
        </div>
      </div>
    </div>
  );
}
