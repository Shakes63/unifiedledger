'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Edit2,
  Trash2,
  CreditCard,
  Wallet,
  Home,
  Car,
  GraduationCap,
  HeartPulse,
  Target,
  TrendingDown,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Clock,
  Zap,
  History,
  BarChart3,
  CheckCircle2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { EntityIdBadge } from '@/components/dev/entity-id-badge';
import { CreditUtilizationBadge } from './credit-utilization-badge';
import { PaymentHistoryList } from './payment-history-list';
import { DebtAmortizationSection } from './debt-amortization-section';
import {
  calculateUtilization,
  calculatePaymentToTarget,
  getUtilizationRecommendation,
} from '@/lib/debts/credit-utilization-utils';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { toast } from 'sonner';

interface Milestone {
  id: string;
  percentage: number;
  milestoneBalance: number;
  achievedAt?: string;
}

interface PayoffTimeline {
  strategyMonths: number;
  strategyDate: Date | string;
  minimumOnlyMonths: number;
  order: number;
  method: string;
}

export interface UnifiedDebt {
  id: string;
  name: string;
  source: 'account' | 'bill' | 'debt';
  sourceType: string;
  balance: number;
  originalBalance?: number;
  creditLimit?: number;
  interestRate?: number;
  interestType?: string;
  minimumPayment?: number;
  additionalMonthlyPayment?: number;
  includeInPayoffStrategy: boolean;
  color?: string;
  statementBalance?: number;
  statementDueDate?: string;
  drawPeriodEndDate?: string;
  repaymentPeriodEndDate?: string;
  debtType?: string;
  isInterestTaxDeductible?: boolean;
  taxDeductionType?: string;
  utilization?: number;
  availableCredit?: number;
  status?: string;
  creditorName?: string;
  loanType?: 'revolving' | 'installment';
  compoundingFrequency?: 'daily' | 'monthly' | 'quarterly' | 'annually';
  billingCycleDays?: number;
}

interface UnifiedDebtCardProps {
  debt: UnifiedDebt;
  onEdit?: (debt: UnifiedDebt) => void;
  onDelete?: (debtId: string) => void;
  onToggleStrategy?: (debtId: string, include: boolean) => void;
  onPayment?: (debtId: string, amount: number) => void;
  defaultExpanded?: boolean;
  expandState?: boolean | null;
  payoffTimeline?: PayoffTimeline;
  milestones?: Milestone[];
}

const DEBT_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  credit:        CreditCard,
  credit_card:   CreditCard,
  line_of_credit: Wallet,
  mortgage:      Home,
  auto_loan:     Car,
  student_loan:  GraduationCap,
  medical:       HeartPulse,
  personal_loan: Wallet,
  other:         TrendingDown,
};

const DEBT_TYPE_LABELS: Record<string, string> = {
  credit:         'Credit Card',
  credit_card:    'Credit Card',
  line_of_credit: 'Line of Credit',
  mortgage:       'Mortgage',
  auto_loan:      'Auto Loan',
  student_loan:   'Student Loan',
  medical:        'Medical Debt',
  personal_loan:  'Personal Loan',
  other:          'Other Debt',
};

function fmt(n: number, decimals = 0) {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function UnifiedDebtCard({
  debt,
  onEdit,
  onDelete,
  onToggleStrategy,
  onPayment,
  defaultExpanded = false,
  expandState = null,
  payoffTimeline,
  milestones = [],
}: UnifiedDebtCardProps) {
  const { selectedHouseholdId } = useHousehold();
  const { postWithHousehold } = useHouseholdFetch();

  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [showUtilization, setShowUtilization] = useState(false);
  const [showMilestones, setShowMilestones] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [showAmortization, setShowAmortization] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  useEffect(() => {
    if (expandState === null || expandState === undefined) return;
    setIsExpanded(expandState);
  }, [expandState]);

  const IconComponent = useMemo(() => DEBT_TYPE_ICONS[debt.sourceType] || DEBT_TYPE_ICONS.other, [debt.sourceType]);
  const typeLabel = DEBT_TYPE_LABELS[debt.sourceType] || 'Debt';

  const isCreditCard = debt.sourceType === 'credit_card' || debt.sourceType === 'credit';
  const hasLimit = isCreditCard && debt.creditLimit && debt.creditLimit > 0;
  const utilization = hasLimit ? calculateUtilization(debt.balance, debt.creditLimit!) : 0;
  const available = hasLimit ? Math.max(0, debt.creditLimit! - debt.balance) : 0;
  const paymentToTarget = hasLimit ? calculatePaymentToTarget(debt.balance, debt.creditLimit!, 30) : 0;
  const recommendation = hasLimit ? getUtilizationRecommendation(utilization) : '';
  const isOverTarget = utilization > 30;

  const payoffProgress = useMemo(() => {
    if ((debt.source === 'bill' || debt.source === 'debt') && debt.originalBalance && debt.originalBalance > 0) {
      return Math.min(100, Math.max(0, ((debt.originalBalance - debt.balance) / debt.originalBalance) * 100));
    }
    return null;
  }, [debt.source, debt.originalBalance, debt.balance]);

  const drawPeriodStatus = useMemo(() => {
    if (debt.sourceType !== 'line_of_credit' || !debt.drawPeriodEndDate) return null;
    const daysLeft = Math.ceil((new Date(debt.drawPeriodEndDate).getTime() - Date.now()) / 86_400_000);
    if (daysLeft < 0) return { label: 'Draw period ended', color: 'var(--color-warning)' };
    if (daysLeft <= 90) return { label: `Draw ends in ${daysLeft}d`, color: 'var(--color-warning)' };
    return { label: 'Draw period active', color: 'var(--color-success)' };
  }, [debt.sourceType, debt.drawPeriodEndDate]);

  const cardColor = debt.color || 'var(--color-error)';
  const isPaidOff = debt.status === 'paid_off';
  const paidOff = Math.max(0, (debt.originalBalance || debt.balance) - debt.balance);

  // Utilization bar color
  const utilizationColor =
    utilization >= 100 ? 'var(--color-error)'
    : utilization >= 80 ? 'var(--color-warning)'
    : utilization >= 30 ? 'var(--color-primary)'
    : 'var(--color-success)';

  const handlePayment = async () => {
    if (!selectedHouseholdId) { toast.error('Please select a household'); return; }
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    try {
      setSubmittingPayment(true);
      const res = await postWithHousehold('/api/debts/payments', {
        source: debt.source, id: debt.id, amount,
        paymentDate: new Date().toISOString(),
      });
      if (!res.ok) throw new Error();
      onPayment?.(debt.id, amount);
      setPaymentAmount('');
      toast.success(`Payment of $${fmt(amount, 2)} recorded!`);
    } catch { toast.error('Failed to record payment'); }
    finally { setSubmittingPayment(false); }
  };

  const debtForAmortization = {
    id: debt.id,
    name: debt.name,
    remainingBalance: debt.balance,
    minimumPayment: debt.minimumPayment,
    interestRate: debt.interestRate || 0,
    type: debt.sourceType,
    loanType: debt.loanType,
    compoundingFrequency: debt.compoundingFrequency,
    billingCycleDays: debt.billingCycleDays,
  };

  return (
    <div
      className="rounded-xl overflow-hidden transition-shadow duration-200"
      style={{
        border: '1px solid var(--color-border)',
        borderLeft: `3px solid ${cardColor}`,
        backgroundColor: 'var(--color-background)',
        opacity: debt.includeInPayoffStrategy ? 1 : 0.62,
        boxShadow: '0 1px 3px color-mix(in oklch, var(--color-foreground) 4%, transparent)',
      }}
      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 16px color-mix(in oklch, ${cardColor} 14%, transparent)`}
      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px color-mix(in oklch, var(--color-foreground) 4%, transparent)'}
    >
      {/* ── Clickable header ─────────────────────────────────────────────── */}
      <div
        className="px-4 pt-3.5 pb-2.5 cursor-pointer"
        onClick={() => setIsExpanded(e => !e)}
        onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.backgroundColor = 'color-mix(in oklch, var(--color-elevated) 45%, transparent)')}
        onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent')}
      >
        {/* Top row: icon + name + badges + balance + actions */}
        <div className="flex items-start gap-2.5">
          {/* Type icon */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
            style={{ backgroundColor: `color-mix(in oklch, ${cardColor} 14%, transparent)` }}
          >
            <IconComponent className="w-4 h-4" style={{ color: cardColor }} />
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--color-foreground)' }}>
                {debt.name}
              </span>
              <EntityIdBadge id={debt.id} label={debt.source === 'account' ? 'Account' : debt.source === 'debt' ? 'Debt' : 'Bill'} />
              {isPaidOff && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-px rounded-full" style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 14%, transparent)', color: 'var(--color-success)' }}>
                  <CheckCircle2 className="w-2.5 h-2.5" /> Paid Off
                </span>
              )}
              {debt.status === 'paused' && (
                <span className="text-[10px] font-semibold px-1.5 py-px rounded-full" style={{ backgroundColor: 'color-mix(in oklch, var(--color-warning) 14%, transparent)', color: 'var(--color-warning)' }}>
                  Paused
                </span>
              )}
              {(debt.additionalMonthlyPayment ?? 0) > 0 && !isPaidOff && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-px rounded-full" style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 14%, transparent)', color: 'var(--color-success)' }}>
                  <TrendingUp className="w-2.5 h-2.5" /> Extra
                </span>
              )}
              {hasLimit && (
                <CreditUtilizationBadge balance={debt.balance} creditLimit={debt.creditLimit!} size="sm" showPercentage showTooltip />
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] px-1.5 py-px rounded" style={{ backgroundColor: 'var(--color-elevated)', color: 'var(--color-muted-foreground)' }}>
                {debt.creditorName || typeLabel}
              </span>
              {debt.interestRate !== undefined && debt.interestRate > 0 && (
                <span className="text-[10px] font-mono" style={{ color: 'var(--color-muted-foreground)' }}>
                  {debt.interestRate.toFixed(2)}% APR
                  {debt.interestType === 'variable' && <span style={{ color: 'var(--color-warning)' }}> var</span>}
                </span>
              )}
            </div>
          </div>

          {/* Balance */}
          <div className="text-right shrink-0" onClick={e => e.stopPropagation()}>
            <div
              className="text-[15px] font-bold font-mono tabular-nums"
              style={{ color: isPaidOff ? 'var(--color-success)' : 'var(--color-error)' }}
            >
              ${fmt(debt.balance, 2)}
            </div>
            {debt.minimumPayment && debt.minimumPayment > 0 && (
              <div className="text-[10px] font-mono tabular-nums" style={{ color: 'var(--color-muted-foreground)' }}>
                ${fmt((debt.minimumPayment || 0) + (debt.additionalMonthlyPayment || 0), 0)}/mo
              </div>
            )}
          </div>

          {/* Actions — stop propagation so click doesn't toggle card */}
          <div className="flex items-center gap-0.5 shrink-0 mt-0.5" onClick={e => e.stopPropagation()}>
            {/* Strategy toggle */}
            {onToggleStrategy ? (
              <button
                onClick={() => onToggleStrategy(debt.id, !debt.includeInPayoffStrategy)}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors"
                style={{
                  backgroundColor: debt.includeInPayoffStrategy
                    ? 'color-mix(in oklch, var(--color-success) 14%, transparent)'
                    : 'var(--color-elevated)',
                  color: debt.includeInPayoffStrategy ? 'var(--color-success)' : 'var(--color-muted-foreground)',
                }}
              >
                <Target className="w-2.5 h-2.5" />
                {debt.includeInPayoffStrategy ? 'In' : 'Out'}
              </button>
            ) : (
              <span
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 14%, transparent)', color: 'var(--color-success)' }}
              >
                <Target className="w-2.5 h-2.5" /> In
              </span>
            )}

            {/* Edit / Delete */}
            {(onEdit || onDelete) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="w-6 h-6 rounded flex items-center justify-center transition-colors"
                    style={{ color: 'var(--color-muted-foreground)' }}
                    onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-elevated)')}
                    onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
                    </svg>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="border" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}>
                  {onEdit && (
                    <DropdownMenuItem onClick={() => onEdit(debt)} className="cursor-pointer">
                      <Edit2 className="h-3.5 w-3.5 mr-2" /> Edit
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <DropdownMenuItem onClick={() => onDelete(debt.id)} className="cursor-pointer" style={{ color: 'var(--color-destructive)' }}>
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Expand chevron */}
            <button
              onClick={() => setIsExpanded(e => !e)}
              className="w-6 h-6 rounded flex items-center justify-center transition-colors"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* ── Progress bar — always visible ─────────────────────────────── */}
        <div className="mt-3">
          {/* Credit card utilization bar */}
          {debt.source === 'account' && hasLimit && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>
                <span className="font-mono tabular-nums">{(debt.utilization || utilization).toFixed(0)}% used</span>
                <span className="font-mono tabular-nums">${fmt(debt.availableCredit ?? available)} avail</span>
              </div>
              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ backgroundColor: 'color-mix(in oklch, var(--color-elevated) 80%, transparent)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(debt.utilization || utilization, 100)}%`,
                    backgroundColor: utilizationColor,
                  }}
                />
              </div>
            </div>
          )}

          {/* Loan / debt payoff progress bar */}
          {payoffProgress !== null && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>
                <span className="font-mono tabular-nums" style={{ color: 'var(--color-success)' }}>
                  {payoffProgress.toFixed(0)}% paid off
                </span>
                <span className="font-mono tabular-nums">${fmt(debt.originalBalance ?? debt.balance)} orig</span>
              </div>
              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ backgroundColor: 'color-mix(in oklch, var(--color-elevated) 80%, transparent)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${payoffProgress}%`,
                    background: `linear-gradient(to right, color-mix(in oklch, var(--color-success) 70%, transparent), var(--color-success))`,
                  }}
                />
              </div>
            </div>
          )}

          {/* No progress bar — just a thin line divider */}
          {!hasLimit && payoffProgress === null && (
            <div className="h-px mt-1" style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 50%, transparent)' }} />
          )}
        </div>
      </div>

      {/* ── Expanded content ─────────────────────────────────────────────── */}
      {isExpanded && (
        <div
          className="px-4 pb-4 pt-2 space-y-4"
          style={{ borderTop: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)' }}
        >
          {/* Balance + payment row */}
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Balance</p>
              <p className="text-2xl font-bold font-mono tabular-nums" style={{ color: 'var(--color-error)' }}>
                ${fmt(debt.balance, 2)}
              </p>
              {payoffProgress !== null && paidOff > 0 && (
                <p className="text-[11px] font-mono tabular-nums mt-0.5" style={{ color: 'var(--color-success)' }}>
                  ${fmt(paidOff, 2)} paid off
                </p>
              )}
            </div>
            {debt.minimumPayment && debt.minimumPayment > 0 && (
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                  {(debt.additionalMonthlyPayment ?? 0) > 0 ? 'Planned' : 'Min'}
                </p>
                <p className="text-lg font-semibold font-mono tabular-nums" style={{ color: 'var(--color-foreground)' }}>
                  ${fmt((debt.minimumPayment || 0) + (debt.additionalMonthlyPayment || 0), 2)}/mo
                </p>
                {(debt.additionalMonthlyPayment ?? 0) > 0 && (
                  <p className="text-[10px] font-mono tabular-nums flex items-center justify-end gap-0.5" style={{ color: 'var(--color-success)' }}>
                    <TrendingUp className="w-2.5 h-2.5" />
                    +${fmt(debt.additionalMonthlyPayment ?? 0, 2)} extra
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Payoff timeline */}
          {payoffTimeline && !isPaidOff && (
            <div
              className="rounded-lg p-3"
              style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 8%, transparent)', border: '1px solid color-mix(in oklch, var(--color-primary) 22%, var(--color-border))' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} />
                <span className="text-[11px] font-semibold capitalize" style={{ color: 'var(--color-foreground)' }}>
                  {payoffTimeline.method} strategy
                </span>
                <span className="text-[10px] ml-auto font-mono" style={{ color: 'var(--color-muted-foreground)' }}>
                  #{payoffTimeline.order} priority
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--color-muted-foreground)' }}>With Strategy</p>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" style={{ color: 'var(--color-success)' }} />
                    <span className="text-[13px] font-semibold font-mono" style={{ color: 'var(--color-success)' }}>
                      {payoffTimeline.strategyMonths}mo
                    </span>
                  </div>
                  <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                    {new Date(payoffTimeline.strategyDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Min Only</p>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" style={{ color: 'var(--color-muted-foreground)' }} />
                    <span className="text-[13px] font-semibold font-mono" style={{ color: 'var(--color-muted-foreground)' }}>
                      {payoffTimeline.minimumOnlyMonths === -1 ? 'Never' : `${payoffTimeline.minimumOnlyMonths}mo`}
                    </span>
                  </div>
                  {payoffTimeline.minimumOnlyMonths > 0 && payoffTimeline.minimumOnlyMonths !== -1 && (
                    <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--color-success)' }}>
                      {payoffTimeline.minimumOnlyMonths - payoffTimeline.strategyMonths}mo faster!
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Extra details */}
          <div
            className="space-y-2 pt-1 pb-0.5"
            style={{ borderTop: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)' }}
          >
            {debt.statementBalance !== undefined && debt.statementBalance !== null && (
              <div className="flex justify-between text-[12px]">
                <span style={{ color: 'var(--color-muted-foreground)' }}>Statement Balance</span>
                <span className="font-mono tabular-nums" style={{ color: 'var(--color-foreground)' }}>${fmt(debt.statementBalance, 2)}</span>
              </div>
            )}
            {debt.statementDueDate && (
              <div className="flex justify-between text-[12px]">
                <span style={{ color: 'var(--color-muted-foreground)' }}>Statement Due</span>
                <span style={{ color: 'var(--color-foreground)' }}>Day {debt.statementDueDate}</span>
              </div>
            )}
            {drawPeriodStatus && (
              <div className="flex items-center gap-1.5 text-[12px]">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: drawPeriodStatus.color }} />
                <span style={{ color: drawPeriodStatus.color }}>{drawPeriodStatus.label}</span>
              </div>
            )}
            {debt.isInterestTaxDeductible && (
              <div className="flex justify-between text-[12px]">
                <span style={{ color: 'var(--color-muted-foreground)' }}>Tax Deductible</span>
                <span style={{ color: 'var(--color-success)' }}>
                  {debt.taxDeductionType === 'mortgage' && 'Mortgage Interest'}
                  {debt.taxDeductionType === 'student_loan' && 'Student Loan'}
                  {debt.taxDeductionType === 'business' && 'Business Interest'}
                  {debt.taxDeductionType === 'heloc_home' && 'HELOC'}
                  {(!debt.taxDeductionType || debt.taxDeductionType === 'none') && 'Yes'}
                </span>
              </div>
            )}
            <div className="flex justify-between text-[12px]">
              <span style={{ color: 'var(--color-muted-foreground)' }}>Source</span>
              <span className="px-1.5 py-px rounded text-[10px]" style={{ backgroundColor: 'var(--color-elevated)', color: 'var(--color-muted-foreground)' }}>
                {debt.source === 'account' ? 'Credit Account' : debt.source === 'debt' ? 'Standalone Debt' : 'Debt Bill'}
              </span>
            </div>
          </div>

          {/* Credit utilization details (collapsible) */}
          {hasLimit && (
            <div style={{ borderTop: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)', paddingTop: '0.75rem' }}>
              <button
                onClick={() => setShowUtilization(v => !v)}
                className="flex items-center gap-1.5 w-full text-[12px] transition-colors"
                style={{ color: 'var(--color-muted-foreground)' }}
                onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-foreground)')}
                onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted-foreground)')}
              >
                {showUtilization ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                <CreditCard className="w-3.5 h-3.5" />
                Utilization Details
                {isOverTarget && <AlertTriangle className="w-3 h-3 ml-auto" style={{ color: 'var(--color-warning)' }} />}
              </button>
              {showUtilization && (
                <div className="mt-3 rounded-lg p-3 space-y-3" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
                  <div className="grid grid-cols-2 gap-3 text-[12px]">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Limit</p>
                      <p className="font-semibold font-mono tabular-nums" style={{ color: 'var(--color-foreground)' }}>${fmt(debt.creditLimit!, 2)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Available</p>
                      <p className="font-semibold font-mono tabular-nums" style={{ color: 'var(--color-success)' }}>${fmt(available, 2)}</p>
                    </div>
                  </div>
                  {recommendation && (
                    <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>{recommendation}</p>
                  )}
                  {paymentToTarget > 0 && (
                    <div
                      className="rounded-lg p-2.5 flex items-start gap-2"
                      style={{ backgroundColor: 'color-mix(in oklch, var(--color-warning) 10%, transparent)', border: '1px solid color-mix(in oklch, var(--color-warning) 25%, transparent)' }}
                    >
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
                      <p className="text-[11px]" style={{ color: 'var(--color-foreground)' }}>
                        Pay <strong>${fmt(paymentToTarget)}</strong> to reach 30% utilization target.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Milestones (standalone debts only) */}
          {debt.source === 'debt' && milestones.length > 0 && (
            <div style={{ borderTop: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)', paddingTop: '0.75rem' }}>
              <button
                onClick={() => setShowMilestones(v => !v)}
                className="flex items-center gap-1.5 text-[12px] transition-colors"
                style={{ color: 'var(--color-muted-foreground)' }}
                onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-foreground)')}
                onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted-foreground)')}
              >
                {showMilestones ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                Milestones
              </button>
              {showMilestones && (
                <div className="mt-3 space-y-2">
                  {milestones.map(m => (
                    <div key={m.id} className="flex items-center gap-3 text-[12px]">
                      <span className="w-8 text-right font-mono" style={{ color: 'var(--color-muted-foreground)' }}>{m.percentage}%</span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-elevated)' }}>
                        <div className="h-full rounded-full" style={{ width: m.achievedAt ? '100%' : '0%', backgroundColor: 'var(--color-success)' }} />
                      </div>
                      <span className="font-mono tabular-nums" style={{ color: 'var(--color-muted-foreground)' }}>${fmt(m.milestoneBalance)}</span>
                      {m.achievedAt && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-success)' }} />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Payment history */}
          <div style={{ borderTop: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)', paddingTop: '0.75rem' }}>
            <button
              onClick={() => setShowPaymentHistory(v => !v)}
              className="flex items-center gap-1.5 w-full text-[12px] transition-colors"
              style={{ color: 'var(--color-muted-foreground)' }}
              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-foreground)')}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted-foreground)')}
            >
              {showPaymentHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <History className="w-3.5 h-3.5" />
              Payment History
            </button>
            {showPaymentHistory && (
              <div className="mt-3">
                <PaymentHistoryList debtId={debt.id} source={debt.source} />
              </div>
            )}
          </div>

          {/* Amortization (debts with interest only) */}
          {debt.source === 'debt' && (debt.interestRate ?? 0) > 0 && (
            <div style={{ borderTop: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)', paddingTop: '0.75rem' }}>
              <button
                onClick={() => setShowAmortization(v => !v)}
                className="flex items-center gap-1.5 text-[12px] transition-colors"
                style={{ color: 'var(--color-muted-foreground)' }}
                onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-foreground)')}
                onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted-foreground)')}
              >
                {showAmortization ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                <BarChart3 className="w-3.5 h-3.5" />
                Amortization Schedule
              </button>
              {showAmortization && (
                <div className="mt-3">
                  <DebtAmortizationSection debt={debtForAmortization} />
                </div>
              )}
            </div>
          )}

          {/* Record payment — always visible at bottom when expanded */}
          {!isPaidOff && (
            <div
              className="flex items-center gap-2 pt-1"
              style={{ borderTop: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)' }}
            >
              <div
                className="flex-1 flex items-center gap-1.5 rounded-lg px-3 h-8"
                style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-elevated)' }}
              >
                <span className="text-[12px] font-mono" style={{ color: 'var(--color-muted-foreground)' }}>$</span>
                <input
                  type="number"
                  placeholder="Payment amount"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handlePayment()}
                  className="flex-1 bg-transparent text-[12px] font-mono outline-none tabular-nums min-w-0"
                  style={{ color: 'var(--color-foreground)' }}
                  step="0.01"
                  min="0"
                />
              </div>
              <Button
                size="sm"
                disabled={submittingPayment || !paymentAmount}
                onClick={handlePayment}
                className="h-8 px-3 text-xs shrink-0"
                style={{ backgroundColor: cardColor, color: '#fff', opacity: (submittingPayment || !paymentAmount) ? 0.4 : 1 }}
              >
                {submittingPayment ? '…' : 'Record'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
