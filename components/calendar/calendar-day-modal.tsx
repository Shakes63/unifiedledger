'use client';

import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  TrendingDown,
  TrendingUp,
  ArrowRightLeft,
  Plus,
  Target,
  CreditCard,
  Trophy,
  Clock,
  Wallet,
  Check,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

// ============================================================================
// Types
// ============================================================================

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
  category?: string;
}

interface Bill {
  id: string;
  billId?: string;
  description: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue';
  isDebt?: boolean;
  isAutopayEnabled?: boolean;
  linkedAccountName?: string;
  billType?: 'expense' | 'income' | 'savings_transfer';
}

interface Goal {
  id: string;
  name: string;
  description?: string | null;
  targetAmount: number;
  currentAmount: number;
  progress: number;
  color: string;
  icon: string;
  status: string;
  category?: string | null;
}

interface Debt {
  id: string;
  name: string;
  description?: string | null;
  creditorName: string;
  remainingBalance: number;
  originalAmount: number;
  progress: number;
  color: string;
  icon: string;
  type: string;
  status: string;
  debtType: 'target' | 'milestone';
  milestonePercentage?: number;
  source?: 'debt' | 'account' | 'bill';
}

interface AutopayEvent {
  id: string;
  billId: string;
  billInstanceId: string;
  billName: string;
  amount: number;
  autopayAmountType: string;
  sourceAccountId: string;
  sourceAccountName: string;
  linkedAccountId?: string;
  linkedAccountName?: string;
  dueDate: string;
}

interface UnifiedPayoffDate {
  id: string;
  name: string;
  source: 'account' | 'bill';
  sourceType: string;
  remainingBalance: number;
  monthlyPayment: number;
  projectedPayoffDate: string;
  color?: string;
  interestRate?: number;
}

interface BillMilestone {
  id: string;
  billId?: string;
  accountId?: string;
  name: string;
  percentage: number;
  achievedAt: string;
  color?: string;
  milestoneBalance: number;
  source: 'account' | 'bill';
}

interface CalendarDayModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  transactions?: Transaction[];
  bills?: Bill[];
  goals?: Goal[];
  debts?: Debt[];
  autopayEvents?: AutopayEvent[];
  payoffDates?: UnifiedPayoffDate[];
  billMilestones?: BillMilestone[];
  transactionCounts?: {
    incomeCount: number;
    expenseCount: number;
    transferCount: number;
    totalSpent: number;
    billDueCount: number;
    billOverdueCount: number;
    goalCount?: number;
    debtCount?: number;
    autopayCount?: number;
    payoffDateCount?: number;
    billMilestoneCount?: number;
  };
}

// ============================================================================
// Sub-components
// ============================================================================

function SectionDivider() {
  return (
    <div
      className="h-px mx-0"
      style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 50%, transparent)' }}
    />
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="py-6 text-center">
      <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{message}</p>
    </div>
  );
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ============================================================================
// Main Component
// ============================================================================

type Tab = 'bills' | 'transactions' | 'milestones';

export function CalendarDayModal({
  open,
  onOpenChange,
  date,
  transactions = [],
  bills = [],
  goals = [],
  debts = [],
  autopayEvents = [],
  payoffDates = [],
  billMilestones = [],
  transactionCounts,
}: CalendarDayModalProps) {
  const hasMilestones = goals.length > 0 || debts.length > 0 || payoffDates.length > 0 || billMilestones.length > 0;
  const hasBills = bills.length > 0 || autopayEvents.length > 0;

  const defaultTab: Tab = hasBills ? 'bills' : transactions.length > 0 ? 'transactions' : 'milestones';
  const [tab, setTab] = useState<Tab>(defaultTab);

  // Reset tab whenever the modal opens (including programmatic open from parent)
  useEffect(() => {
    if (open) {
      setTab(hasBills ? 'bills' : transactions.length > 0 ? 'transactions' : 'milestones');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleOpenChange = (v: boolean) => {
    onOpenChange(v);
  };

  // Summary stats
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  const overdueCount = bills.filter((b) => b.status === 'overdue').length;
  const billsDueCount = bills.filter((b) => b.status === 'pending').length;

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'bills', label: 'Bills', count: bills.length + autopayEvents.length },
    { id: 'transactions', label: 'Transactions', count: transactions.length },
    { id: 'milestones', label: 'Goals & Debts', count: goals.length + debts.length + payoffDates.length + billMilestones.length },
  ];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden"
        style={{
          maxWidth: '520px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--color-background)',
          border: '1px solid var(--color-border)',
          borderRadius: '14px',
          boxShadow: '0 24px 80px color-mix(in oklch, var(--color-background) 10%, black 40%)',
        }}
      >
        {/* ---------------------------------------------------------------- */}
        {/* Header — date stamp + summary bar                                */}
        {/* ---------------------------------------------------------------- */}
        <div
          style={{
            borderBottom: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-background)',
          }}
        >
          {/* Date */}
          <div className="px-5 pt-5 pb-4 flex items-end justify-between gap-4">
            <div>
              <DialogTitle className="sr-only">
                {format(date, 'EEEE, MMMM d, yyyy')}
              </DialogTitle>
              <div
                className="text-[52px] font-bold leading-none tabular-nums"
                style={{ color: 'var(--color-foreground)', letterSpacing: '-0.03em' }}
              >
                {format(date, 'd')}
              </div>
              <div
                className="text-sm font-medium mt-0.5 tracking-wide"
                style={{ color: 'var(--color-muted-foreground)' }}
              >
                {format(date, 'EEEE · MMMM yyyy')}
              </div>
            </div>

            {/* Quick stats — only render if there's anything */}
            {(totalIncome > 0 || totalExpense > 0 || overdueCount > 0 || billsDueCount > 0) && (
              <div className="flex items-center gap-3 pb-0.5">
                {totalIncome > 0 && (
                  <div className="text-right">
                    <div
                      className="text-[11px] uppercase tracking-widest font-semibold"
                      style={{ color: 'var(--color-income)' }}
                    >
                      In
                    </div>
                    <div
                      className="text-sm font-mono font-semibold tabular-nums"
                      style={{ color: 'var(--color-income)' }}
                    >
                      +${fmt(totalIncome)}
                    </div>
                  </div>
                )}
                {totalExpense > 0 && (
                  <div className="text-right">
                    <div
                      className="text-[11px] uppercase tracking-widest font-semibold"
                      style={{ color: 'var(--color-expense)' }}
                    >
                      Out
                    </div>
                    <div
                      className="text-sm font-mono font-semibold tabular-nums"
                      style={{ color: 'var(--color-expense)' }}
                    >
                      -${fmt(totalExpense)}
                    </div>
                  </div>
                )}
                {overdueCount > 0 && (
                  <div className="text-right">
                    <div
                      className="text-[11px] uppercase tracking-widest font-semibold"
                      style={{ color: 'var(--color-error)' }}
                    >
                      Overdue
                    </div>
                    <div
                      className="text-sm font-mono font-semibold tabular-nums"
                      style={{ color: 'var(--color-error)' }}
                    >
                      {overdueCount}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tab bar */}
          <div className="flex px-5 gap-0">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="relative flex items-center gap-1.5 py-2.5 pr-4 text-[12px] font-medium transition-colors"
                style={{
                  color: tab === t.id ? 'var(--color-foreground)' : 'var(--color-muted-foreground)',
                }}
              >
                {t.label}
                {t.count > 0 && (
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums"
                    style={{
                      backgroundColor: tab === t.id
                        ? 'color-mix(in oklch, var(--color-primary) 18%, transparent)'
                        : 'color-mix(in oklch, var(--color-border) 60%, transparent)',
                      color: tab === t.id ? 'var(--color-primary)' : 'var(--color-muted-foreground)',
                    }}
                  >
                    {t.count}
                  </span>
                )}
                {/* Active underline */}
                {tab === t.id && (
                  <span
                    className="absolute bottom-0 left-0 right-4 h-0.5 rounded-t-full"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Scrollable content                                               */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex-1 overflow-y-auto">

          {/* ---- BILLS TAB ---- */}
          {tab === 'bills' && (
            <div>
              {/* Autopay events */}
              {autopayEvents.length > 0 && (
                <>
                  <div
                    className="px-5 py-2 flex items-center gap-2"
                    style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 5%, transparent)' }}
                  >
                    <span
                      className="text-[10px] uppercase tracking-widest font-semibold"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      Autopay
                    </span>
                  </div>
                  {autopayEvents.map((autopay, i) => (
                    <div
                      key={autopay.id}
                      className="day-brief-item"
                      style={{ animationDelay: `${i * 30}ms` }}
                    >
                      <div
                        className="flex items-center gap-3 px-5 py-3"
                        style={{ borderLeft: '3px solid var(--color-primary)' }}
                      >
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                          style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 15%, transparent)' }}
                        >
                          <Clock className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--color-foreground)' }}>
                            {autopay.billName}
                          </p>
                          <p className="text-[11px] flex items-center gap-1" style={{ color: 'var(--color-muted-foreground)' }}>
                            <Wallet className="w-3 h-3" />
                            {autopay.sourceAccountName}
                            {autopay.linkedAccountName && <> → {autopay.linkedAccountName}</>}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-mono font-semibold tabular-nums" style={{ color: 'var(--color-primary)' }}>
                            ${fmt(autopay.amount)}
                          </p>
                          <span
                            className="text-[10px] font-medium"
                            style={{ color: 'var(--color-primary)' }}
                          >
                            Autopay
                          </span>
                        </div>
                      </div>
                      <SectionDivider />
                    </div>
                  ))}
                </>
              )}

              {/* Bills grouped by status */}
              {bills.length === 0 && autopayEvents.length === 0 && (
                <EmptyRow message="No bills scheduled for this day" />
              )}

              {/* Overdue */}
              {bills.filter(b => b.status === 'overdue').length > 0 && (
                <>
                  <div
                    className="px-5 py-2"
                    style={{ backgroundColor: 'color-mix(in oklch, var(--color-error) 5%, transparent)' }}
                  >
                    <span
                      className="text-[10px] uppercase tracking-widest font-semibold flex items-center gap-1"
                      style={{ color: 'var(--color-error)' }}
                    >
                      <AlertCircle className="w-3 h-3" />
                      Overdue
                    </span>
                  </div>
                  {bills.filter(b => b.status === 'overdue').map((bill, i) => (
                    <BillRow key={bill.id} bill={bill} index={i} offset={autopayEvents.length} />
                  ))}
                </>
              )}

              {/* Pending / due */}
              {bills.filter(b => b.status === 'pending').length > 0 && (
                <>
                  <div
                    className="px-5 py-2"
                    style={{ backgroundColor: 'color-mix(in oklch, var(--color-warning) 5%, transparent)' }}
                  >
                    <span
                      className="text-[10px] uppercase tracking-widest font-semibold"
                      style={{ color: 'var(--color-warning)' }}
                    >
                      Due
                    </span>
                  </div>
                  {bills.filter(b => b.status === 'pending').map((bill, i) => (
                    <BillRow key={bill.id} bill={bill} index={i} offset={autopayEvents.length + bills.filter(b => b.status === 'overdue').length} />
                  ))}
                </>
              )}

              {/* Paid */}
              {bills.filter(b => b.status === 'paid').length > 0 && (
                <>
                  <div
                    className="px-5 py-2"
                    style={{ backgroundColor: 'color-mix(in oklch, var(--color-income) 5%, transparent)' }}
                  >
                    <span
                      className="text-[10px] uppercase tracking-widest font-semibold"
                      style={{ color: 'var(--color-income)' }}
                    >
                      Paid
                    </span>
                  </div>
                  {bills.filter(b => b.status === 'paid').map((bill, i) => (
                    <BillRow key={bill.id} bill={bill} index={i} offset={autopayEvents.length + bills.filter(b => b.status !== 'paid').length} />
                  ))}
                </>
              )}

              {/* Footer link */}
              {hasBills && (
                <div className="px-5 py-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <Link
                    href="/dashboard/bills"
                    className="flex items-center justify-center gap-1 text-[11px] font-medium transition-colors"
                    style={{ color: 'var(--color-muted-foreground)' }}
                  >
                    Open Bills
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* ---- TRANSACTIONS TAB ---- */}
          {tab === 'transactions' && (
            <div>
              {transactions.length === 0 ? (
                <div className="py-8 text-center px-5">
                  <p className="text-xs mb-4" style={{ color: 'var(--color-muted-foreground)' }}>
                    No transactions recorded for this day
                  </p>
                  <Link
                    href="/dashboard/transactions/new"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: 'color-mix(in oklch, var(--color-primary) 15%, transparent)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Transaction
                  </Link>
                </div>
              ) : (
                <>
                  {/* Group: income */}
                  {transactions.filter(t => t.type === 'income').length > 0 && (
                    <>
                      <div
                        className="px-5 py-2"
                        style={{ backgroundColor: 'color-mix(in oklch, var(--color-income) 5%, transparent)' }}
                      >
                        <span
                          className="text-[10px] uppercase tracking-widest font-semibold"
                          style={{ color: 'var(--color-income)' }}
                        >
                          Income
                        </span>
                      </div>
                      {transactions.filter(t => t.type === 'income').map((tx, i) => (
                        <TxRow key={tx.id} tx={tx} index={i} />
                      ))}
                    </>
                  )}
                  {/* Group: expense */}
                  {transactions.filter(t => t.type === 'expense').length > 0 && (
                    <>
                      <div
                        className="px-5 py-2"
                        style={{ backgroundColor: 'color-mix(in oklch, var(--color-expense) 5%, transparent)' }}
                      >
                        <span
                          className="text-[10px] uppercase tracking-widest font-semibold"
                          style={{ color: 'var(--color-expense)' }}
                        >
                          Expenses
                        </span>
                      </div>
                      {transactions.filter(t => t.type === 'expense').map((tx, i) => (
                        <TxRow key={tx.id} tx={tx} index={i} offset={transactions.filter(t => t.type === 'income').length} />
                      ))}
                    </>
                  )}
                  {/* Group: transfers */}
                  {transactions.filter(t => t.type === 'transfer_in' || t.type === 'transfer_out').length > 0 && (
                    <>
                      <div
                        className="px-5 py-2"
                        style={{ backgroundColor: 'color-mix(in oklch, var(--color-transfer, var(--color-primary)) 5%, transparent)' }}
                      >
                        <span
                          className="text-[10px] uppercase tracking-widest font-semibold"
                          style={{ color: 'var(--color-transfer, var(--color-primary))' }}
                        >
                          Transfers
                        </span>
                      </div>
                      {transactions.filter(t => t.type === 'transfer_in' || t.type === 'transfer_out').map((tx, i) => (
                        <TxRow key={tx.id} tx={tx} index={i} offset={transactions.filter(t => t.type !== 'transfer_in' && t.type !== 'transfer_out').length} />
                      ))}
                    </>
                  )}

                  {/* Footer */}
                  <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--color-border)' }}>
                    <Link
                      href="/dashboard/transactions"
                      className="flex items-center gap-1 text-[11px] font-medium"
                      style={{ color: 'var(--color-muted-foreground)' }}
                    >
                      View all
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                    <Link
                      href="/dashboard/transactions/new"
                      className="flex items-center gap-1 text-[11px] font-medium"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </Link>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ---- MILESTONES TAB ---- */}
          {tab === 'milestones' && (
            <div>
              {!hasMilestones && (
                <EmptyRow message="No goals or milestones for this day" />
              )}

              {/* Goals */}
              {goals.length > 0 && (
                <>
                  <div
                    className="px-5 py-2"
                    style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 5%, transparent)' }}
                  >
                    <span
                      className="text-[10px] uppercase tracking-widest font-semibold"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      Goal Deadlines
                    </span>
                  </div>
                  {goals.map((goal, i) => (
                    <div
                      key={goal.id}
                      className="day-brief-item"
                      style={{ animationDelay: `${i * 30}ms` }}
                    >
                      <div className="flex items-center gap-3 px-5 py-3">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `color-mix(in oklch, ${goal.color} 15%, transparent)` }}
                        >
                          <Target className="w-3.5 h-3.5" style={{ color: goal.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--color-foreground)' }}>
                            {goal.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${Math.min(goal.progress, 100)}%`, backgroundColor: goal.color }}
                              />
                            </div>
                            <span className="text-[10px] font-mono tabular-nums shrink-0" style={{ color: goal.color }}>
                              {goal.progress}%
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-mono tabular-nums font-semibold" style={{ color: 'var(--color-foreground)' }}>
                            ${goal.currentAmount.toLocaleString()}
                          </p>
                          <p className="text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>
                            of ${goal.targetAmount.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <SectionDivider />
                    </div>
                  ))}
                </>
              )}

              {/* Payoff dates */}
              {payoffDates.length > 0 && (
                <>
                  <div
                    className="px-5 py-2"
                    style={{ backgroundColor: 'color-mix(in oklch, var(--color-income) 5%, transparent)' }}
                  >
                    <span
                      className="text-[10px] uppercase tracking-widest font-semibold"
                      style={{ color: 'var(--color-income)' }}
                    >
                      Projected Payoff
                    </span>
                  </div>
                  {payoffDates.map((payoff, i) => (
                    <div
                      key={payoff.id}
                      className="day-brief-item"
                      style={{ animationDelay: `${(goals.length + i) * 30}ms` }}
                    >
                      <div className="flex items-center gap-3 px-5 py-3">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `color-mix(in oklch, ${payoff.color || 'var(--color-income)'} 15%, transparent)` }}
                        >
                          <Check className="w-3.5 h-3.5" style={{ color: payoff.color || 'var(--color-income)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--color-foreground)' }}>
                            {payoff.name}
                            <span className="ml-1.5 text-[10px] font-normal px-1.5 py-0.5 rounded capitalize"
                              style={{
                                backgroundColor: `color-mix(in oklch, ${payoff.color || 'var(--color-income)'} 12%, transparent)`,
                                color: payoff.color || 'var(--color-income)',
                              }}
                            >
                              Debt Free
                            </span>
                          </p>
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                            ${payoff.monthlyPayment.toLocaleString()}/mo
                            {payoff.interestRate ? ` · ${payoff.interestRate.toFixed(1)}% APR` : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-mono tabular-nums" style={{ color: 'var(--color-muted-foreground)' }}>
                            ${payoff.remainingBalance.toLocaleString()}
                          </p>
                          <p className="text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>remaining</p>
                        </div>
                      </div>
                      <SectionDivider />
                    </div>
                  ))}
                </>
              )}

              {/* Debt milestones */}
              {debts.length > 0 && (
                <>
                  <div
                    className="px-5 py-2"
                    style={{ backgroundColor: 'color-mix(in oklch, var(--color-warning) 5%, transparent)' }}
                  >
                    <span
                      className="text-[10px] uppercase tracking-widest font-semibold"
                      style={{ color: 'var(--color-warning)' }}
                    >
                      Debt Milestones
                    </span>
                  </div>
                  {debts.map((debt, i) => (
                    <div
                      key={debt.id}
                      className="day-brief-item"
                      style={{ animationDelay: `${(goals.length + payoffDates.length + i) * 30}ms` }}
                    >
                      <div className="flex items-center gap-3 px-5 py-3">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `color-mix(in oklch, ${debt.color} 15%, transparent)` }}
                        >
                          {debt.debtType === 'milestone' ? (
                            <Trophy className="w-3.5 h-3.5" style={{ color: debt.color }} />
                          ) : (
                            <CreditCard className="w-3.5 h-3.5" style={{ color: debt.color }} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--color-foreground)' }}>
                            {debt.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${Math.min(debt.progress, 100)}%`, backgroundColor: debt.color }}
                              />
                            </div>
                            <span className="text-[10px] font-mono tabular-nums shrink-0" style={{ color: debt.color }}>
                              {debt.progress}%
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] font-medium" style={{ color: debt.color }}>
                            {debt.debtType === 'milestone'
                              ? `${debt.milestonePercentage}% milestone`
                              : 'Target date'}
                          </p>
                          <p className="text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>
                            {debt.creditorName}
                          </p>
                        </div>
                      </div>
                      <SectionDivider />
                    </div>
                  ))}
                </>
              )}

              {/* Bill milestones */}
              {billMilestones.length > 0 && (
                <>
                  <div
                    className="px-5 py-2"
                    style={{ backgroundColor: 'color-mix(in oklch, var(--color-income) 5%, transparent)' }}
                  >
                    <span
                      className="text-[10px] uppercase tracking-widest font-semibold"
                      style={{ color: 'var(--color-income)' }}
                    >
                      Payoff Milestones
                    </span>
                  </div>
                  {billMilestones.map((ms, i) => (
                    <div
                      key={ms.id}
                      className="day-brief-item"
                      style={{ animationDelay: `${(goals.length + payoffDates.length + debts.length + i) * 30}ms` }}
                    >
                      <div className="flex items-center gap-3 px-5 py-3">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `color-mix(in oklch, ${ms.color || 'var(--color-income)'} 15%, transparent)` }}
                        >
                          <Trophy className="w-3.5 h-3.5" style={{ color: ms.color || 'var(--color-income)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--color-foreground)' }}>
                            {ms.name}
                          </p>
                          <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>
                            Balance at milestone: ${ms.milestoneBalance.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p
                            className="text-xs font-semibold"
                            style={{ color: ms.color || 'var(--color-income)' }}
                          >
                            {ms.percentage}%
                          </p>
                          <p className="text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>milestone</p>
                        </div>
                      </div>
                      <SectionDivider />
                    </div>
                  ))}
                </>
              )}

              {hasMilestones && (
                <div className="px-5 py-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <Link
                    href="/dashboard/goals"
                    className="flex items-center justify-center gap-1 text-[11px] font-medium"
                    style={{ color: 'var(--color-muted-foreground)' }}
                  >
                    View Goals & Debts
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Row components
// ============================================================================

function BillRow({ bill, index, offset = 0 }: { bill: Bill; index: number; offset?: number }) {
  const isIncome = bill.billType === 'income';

  const accentColor = bill.status === 'overdue'
    ? 'var(--color-error)'
    : bill.status === 'paid'
    ? 'var(--color-income)'
    : isIncome
    ? 'var(--color-income)'
    : 'var(--color-warning)';

  const statusLabel = isIncome
    ? bill.status === 'paid' ? 'received' : bill.status === 'overdue' ? 'late' : 'expected'
    : bill.status;

  return (
    <div
      className="day-brief-item"
      style={{ animationDelay: `${(offset + index) * 30}ms` }}
    >
      <div
        className="flex items-center gap-3 px-5 py-3"
        style={{ borderLeft: `3px solid ${accentColor}` }}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: `color-mix(in oklch, ${accentColor} 12%, transparent)` }}
        >
          {bill.status === 'paid' ? (
            <Check className="w-3.5 h-3.5" style={{ color: accentColor }} />
          ) : isIncome ? (
            <TrendingUp className="w-3.5 h-3.5" style={{ color: accentColor }} />
          ) : (
            <TrendingDown className="w-3.5 h-3.5" style={{ color: accentColor }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--color-foreground)' }}>
            {bill.description}
            {bill.isAutopayEnabled && (
              <span
                className="ml-1.5 text-[9px] px-1 py-0.5 rounded uppercase tracking-wide font-bold"
                style={{
                  backgroundColor: 'color-mix(in oklch, var(--color-primary) 12%, transparent)',
                  color: 'var(--color-primary)',
                }}
              >
                Auto
              </span>
            )}
          </p>
          <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>
            {isIncome ? 'Expected' : 'Due'} {format(parseISO(bill.dueDate), 'MMM d')}
            {bill.linkedAccountName && ` · ${bill.linkedAccountName}`}
            {bill.isDebt && ' · Debt payment'}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p
            className="text-sm font-mono font-semibold tabular-nums"
            style={{ color: accentColor }}
          >
            {isIncome ? '+' : ''}${bill.amount.toFixed(2)}
          </p>
          <span
            className="text-[10px] font-medium capitalize"
            style={{ color: accentColor }}
          >
            {statusLabel}
          </span>
        </div>
      </div>
      <div
        className="h-px mx-5"
        style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 40%, transparent)' }}
      />
    </div>
  );
}

function TxRow({ tx, index, offset = 0 }: { tx: Transaction; index: number; offset?: number }) {
  const isIncome = tx.type === 'income';
  const isTransfer = tx.type === 'transfer_in' || tx.type === 'transfer_out';
  const isOut = tx.type === 'expense' || tx.type === 'transfer_out';

  const color = isIncome
    ? 'var(--color-income)'
    : isTransfer
    ? 'var(--color-transfer, var(--color-primary))'
    : 'var(--color-expense)';

  const Icon = isIncome ? TrendingUp : isTransfer ? ArrowRightLeft : TrendingDown;

  return (
    <div
      className="day-brief-item"
      style={{ animationDelay: `${(offset + index) * 30}ms` }}
    >
      <div className="flex items-center gap-3 px-5 py-3">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: `color-mix(in oklch, ${color} 12%, transparent)` }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--color-foreground)' }}>
            {tx.description}
          </p>
          {tx.category && (
            <p className="text-[11px] truncate" style={{ color: 'var(--color-muted-foreground)' }}>
              {tx.category}
            </p>
          )}
        </div>
        <p
          className="text-sm font-mono font-semibold tabular-nums shrink-0"
          style={{ color }}
        >
          {isOut ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)}
        </p>
      </div>
      <div
        className="h-px mx-5"
        style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 40%, transparent)' }}
      />
    </div>
  );
}
