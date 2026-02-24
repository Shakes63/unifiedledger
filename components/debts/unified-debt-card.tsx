'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  MoreVertical,
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
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

// Map debt types to icons
const DEBT_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  credit: CreditCard,
  credit_card: CreditCard,
  line_of_credit: Wallet,
  mortgage: Home,
  auto_loan: Car,
  student_loan: GraduationCap,
  medical: HeartPulse,
  personal_loan: Wallet,
  other: TrendingDown,
};

// Map debt types to labels
const DEBT_TYPE_LABELS: Record<string, string> = {
  credit: 'Credit Card',
  credit_card: 'Credit Card',
  line_of_credit: 'Line of Credit',
  mortgage: 'Mortgage',
  auto_loan: 'Auto Loan',
  student_loan: 'Student Loan',
  medical: 'Medical Debt',
  personal_loan: 'Personal Loan',
  other: 'Other Debt',
};

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
  const [showPayment, setShowPayment] = useState(false);

  useEffect(() => {
    if (expandState === null || expandState === undefined) return;
    setIsExpanded(expandState);
  }, [expandState]);
  const [paymentAmount, setPaymentAmount] = useState('');

  const IconComponent = useMemo(() => {
    return DEBT_TYPE_ICONS[debt.sourceType] || DEBT_TYPE_ICONS.other;
  }, [debt.sourceType]);

  const typeLabel = DEBT_TYPE_LABELS[debt.sourceType] || 'Debt';

  // Credit utilization calculations (for credit cards only)
  const isCreditCard = debt.sourceType === 'credit_card' || debt.sourceType === 'credit';
  const hasLimit = isCreditCard && debt.creditLimit && debt.creditLimit > 0;
  const utilization = hasLimit ? calculateUtilization(debt.balance, debt.creditLimit!) : 0;
  const available = hasLimit ? Math.max(0, debt.creditLimit! - debt.balance) : 0;
  const paymentToTarget = hasLimit ? calculatePaymentToTarget(debt.balance, debt.creditLimit!, 30) : 0;
  const recommendation = hasLimit ? getUtilizationRecommendation(utilization) : '';
  const isOverTarget = utilization > 30;

  // Progress calculation for loans and standalone debts
  const payoffProgress = useMemo(() => {
    if ((debt.source === 'bill' || debt.source === 'debt') && debt.originalBalance && debt.originalBalance > 0) {
      const paid = debt.originalBalance - debt.balance;
      return Math.min(100, Math.max(0, (paid / debt.originalBalance) * 100));
    }
    return null;
  }, [debt.source, debt.originalBalance, debt.balance]);

  // Draw period status for lines of credit
  const drawPeriodStatus = useMemo(() => {
    if (debt.sourceType !== 'line_of_credit' || !debt.drawPeriodEndDate) return null;

    const endDate = new Date(debt.drawPeriodEndDate);
    const today = new Date();
    const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) {
      return { status: 'ended', label: 'Draw period ended', color: 'var(--color-warning)' };
    } else if (daysRemaining <= 90) {
      return { status: 'ending', label: `Draw period ends in ${daysRemaining} days`, color: 'var(--color-warning)' };
    } else {
      return { status: 'active', label: 'Draw period active', color: 'var(--color-success)' };
    }
  }, [debt.sourceType, debt.drawPeriodEndDate]);

  const cardColor = debt.color || 'var(--color-error)';
  const isPaidOff = debt.status === 'paid_off';
  const paidOff = (debt.originalBalance || debt.balance) - debt.balance;

  const handlePayment = async () => {
    if (!selectedHouseholdId) {
      toast.error('Please select a household');
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      const response = await postWithHousehold('/api/debts/payments', {
        source: debt.source,
        id: debt.id,
        amount,
        paymentDate: new Date().toISOString(),
      });

      if (!response.ok) throw new Error('Failed to record payment');

      onPayment?.(debt.id, amount);
      setPaymentAmount('');
      setShowPayment(false);
      toast.success(`Payment of $${amount.toFixed(2)} recorded!`);
    } catch (_error) {
      toast.error('Failed to record payment');
    }
  };

  // For DebtAmortizationSection compatibility
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
    <Card
      className={`border bg-card rounded-xl transition-all ${
        debt.includeInPayoffStrategy ? 'border-border' : 'border-border opacity-60'
      }`}
    >
      {/* Header */}
      <div
        className="p-4 flex items-start justify-between cursor-pointer hover:bg-elevated/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{
              backgroundColor: `${cardColor}20`,
              borderColor: cardColor,
              borderWidth: '2px',
            }}
          >
            <span style={{ color: cardColor }}><IconComponent className="w-5 h-5" /></span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-foreground font-semibold">{debt.name}</h3>
              <EntityIdBadge id={debt.id} label={debt.source === 'account' ? 'Account' : debt.source === 'debt' ? 'Debt' : 'Bill'} />
              {isPaidOff && (
                <span className="text-xs bg-income/30 text-income px-2 py-1 rounded">
                  Paid Off
                </span>
              )}
              {debt.status === 'paused' && (
                <span className="text-xs bg-warning/30 text-warning px-2 py-1 rounded">
                  Paused
                </span>
              )}
              {/* Extra Payment Badge */}
              {(debt.additionalMonthlyPayment ?? 0) > 0 && !isPaidOff && (
                <span className="text-xs bg-income/20 text-income px-2 py-1 rounded flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Extra
                </span>
              )}
              {/* Credit Utilization Badge */}
              {hasLimit && (
                <CreditUtilizationBadge
                  balance={debt.balance}
                  creditLimit={debt.creditLimit!}
                  size="sm"
                  showPercentage={true}
                  showTooltip={true}
                />
              )}
            </div>
            <p className="text-muted-foreground text-sm">{debt.creditorName || typeLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {/* Strategy Badge */}
          {onToggleStrategy ? (
            <button
              onClick={() => onToggleStrategy(debt.id, !debt.includeInPayoffStrategy)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                debt.includeInPayoffStrategy
                  ? 'bg-success/10 text-success'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <Target className="w-3 h-3" />
              {debt.includeInPayoffStrategy ? 'In Strategy' : 'Excluded'}
            </button>
          ) : (
            <span className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-success/10 text-success">
              <Target className="w-3 h-3" />
              In Strategy
            </span>
          )}

          {/* Expand/Collapse */}
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>

          {/* Actions Menu */}
          {(onEdit || onDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-elevated border-border">
                {onEdit && (
                  <DropdownMenuItem
                    onClick={() => onEdit(debt)}
                    className="cursor-pointer"
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem
                    onClick={() => onDelete(debt.id)}
                    className="cursor-pointer text-error hover:text-error"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Collapsed Summary */}
      {!isExpanded && (
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
            <span className="font-mono text-foreground font-semibold">
              ${debt.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {debt.originalBalance && (
              <span>
                / ${debt.originalBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
            )}
            {payoffProgress !== null && (
              <span className="font-semibold">{Math.round(payoffProgress)}% paid</span>
            )}
            {hasLimit && (
              <span>{utilization.toFixed(0)}% used</span>
            )}
          </div>
        </div>
      )}

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Balance Section */}
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-muted-foreground text-xs">Balance</p>
              <p className="text-2xl font-bold font-mono text-error">
                ${debt.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            {debt.minimumPayment && debt.minimumPayment > 0 && (
              <div className="text-right">
                <p className="text-muted-foreground text-xs">
                  {(debt.additionalMonthlyPayment ?? 0) > 0 ? 'Planned Payment' : 'Min Payment'}
                </p>
                <p className="text-lg font-semibold font-mono text-foreground">
                  ${((debt.minimumPayment || 0) + (debt.additionalMonthlyPayment || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                {(debt.additionalMonthlyPayment ?? 0) > 0 && (
                  <p className="text-xs text-income flex items-center justify-end gap-1">
                    <TrendingUp className="w-3 h-3" />
                    +${(debt.additionalMonthlyPayment ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} extra
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Utilization Bar for Credit Accounts */}
          {debt.source === 'account' && debt.creditLimit && debt.creditLimit > 0 && (
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-muted-foreground">
                  {debt.utilization?.toFixed(0) || utilization.toFixed(0)}% used
                </span>
                <span className="text-muted-foreground">
                  ${(debt.availableCredit ?? available).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} available
                </span>
              </div>
              <div className="w-full bg-elevated rounded-full h-2 overflow-hidden border border-border">
                <div
                  className={`h-full transition-all ${
                    (debt.utilization || utilization) >= 100
                      ? 'bg-error'
                      : (debt.utilization || utilization) >= 80
                      ? 'bg-warning'
                      : (debt.utilization || utilization) >= 30
                      ? 'bg-primary'
                      : 'bg-income'
                  }`}
                  style={{ width: `${Math.min(debt.utilization || utilization, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Progress Bar for Loan Debts */}
          {payoffProgress !== null && (
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-muted-foreground">
                  {payoffProgress.toFixed(0)}% paid off
                </span>
                <span className="text-muted-foreground">
                  of ${debt.originalBalance?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <Progress value={payoffProgress} className="h-2 bg-elevated" />
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Paid Off</p>
              <p className="text-foreground font-semibold">
                ${paidOff.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </p>
            </div>
            {debt.interestRate !== undefined && debt.interestRate > 0 && (
              <div>
                <p className="text-muted-foreground text-xs">APR</p>
                <p className="text-foreground font-semibold">
                  {debt.interestRate.toFixed(2)}%
                  {debt.interestType === 'variable' && (
                    <span className="text-warning text-xs ml-1">(Var)</span>
                  )}
                </p>
              </div>
            )}
            {debt.creditLimit && debt.creditLimit > 0 ? (
              <div>
                <p className="text-muted-foreground text-xs">Credit Limit</p>
                <p className="text-foreground font-semibold font-mono">
                  ${debt.creditLimit.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-muted-foreground text-xs">Type</p>
                <p className="text-foreground font-semibold capitalize text-xs">{typeLabel}</p>
              </div>
            )}
          </div>

          {/* Payoff Timeline (Strategy vs Minimum) */}
          {payoffTimeline && !isPaidOff && (
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">
                  Payoff Timeline ({payoffTimeline.method})
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  #{payoffTimeline.order} priority
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">With Strategy</p>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-income" />
                    <span className="text-sm font-semibold text-income">
                      {payoffTimeline.strategyMonths} months
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(payoffTimeline.strategyDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Min Payments Only</p>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-sm font-semibold text-muted-foreground">
                      {payoffTimeline.minimumOnlyMonths === -1 ? 'Never' : `${payoffTimeline.minimumOnlyMonths} months`}
                    </span>
                  </div>
                  {payoffTimeline.minimumOnlyMonths > 0 && payoffTimeline.minimumOnlyMonths !== -1 && (
                    <p className="text-xs text-income">
                      {payoffTimeline.minimumOnlyMonths - payoffTimeline.strategyMonths} months faster!
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Expanded Details Section */}
          <div className="border-t border-border pt-3 space-y-2">
            {/* Statement Info for Credit Cards */}
            {debt.statementBalance !== undefined && debt.statementBalance !== null && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Statement Balance</span>
                <span className="text-foreground font-mono">
                  ${debt.statementBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {debt.statementDueDate && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Due Date</span>
                <span className="text-foreground">Day {debt.statementDueDate}</span>
              </div>
            )}

            {/* Draw Period Status for Lines of Credit */}
            {drawPeriodStatus && (
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: drawPeriodStatus.color }} />
                <span style={{ color: drawPeriodStatus.color }}>
                  {drawPeriodStatus.label}
                </span>
              </div>
            )}

            {/* Tax Deductible Interest */}
            {debt.isInterestTaxDeductible && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Tax Deductible Interest</span>
                <span className="text-success">
                  {debt.taxDeductionType === 'mortgage' && 'Mortgage Interest'}
                  {debt.taxDeductionType === 'student_loan' && 'Student Loan Interest'}
                  {debt.taxDeductionType === 'business' && 'Business Interest'}
                  {debt.taxDeductionType === 'heloc_home' && 'HELOC (Home Use)'}
                  {!debt.taxDeductionType || debt.taxDeductionType === 'none' ? 'Yes' : ''}
                </span>
              </div>
            )}

            {/* Source Indicator */}
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Source</span>
              <span className="text-xs px-2 py-1 rounded bg-elevated text-muted-foreground">
                {debt.source === 'account' ? 'Credit Account' : debt.source === 'debt' ? 'Standalone Debt' : 'Debt Bill'}
              </span>
            </div>
          </div>

          {/* Credit Utilization Section (Credit Cards Only) */}
          {hasLimit && (
            <div className="border-t border-border pt-3">
              <button
                onClick={() => setShowUtilization(!showUtilization)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                {showUtilization ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                <CreditCard className="w-4 h-4" />
                <span>Credit Utilization Details</span>
                {isOverTarget && (
                  <AlertTriangle className="w-3 h-3 text-warning ml-auto" />
                )}
              </button>

              {showUtilization && (
                <div className="mt-4 space-y-3 bg-elevated rounded-lg p-3 border border-border">
                  {/* Utilization Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Utilization</span>
                      <span className="text-foreground font-semibold">{utilization.toFixed(1)}%</span>
                    </div>
                    <Progress value={utilization} className="h-2 bg-card" />
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span>0%</span>
                      <span className="text-warning">30% target</span>
                      <span>100%</span>
                    </div>
                  </div>

                  {/* Credit Info Grid */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Credit Limit</p>
                      <p className="text-foreground font-semibold font-mono">
                        ${debt.creditLimit!.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Available Credit</p>
                      <p className="text-success font-semibold font-mono">
                        ${available.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  {/* Recommendation */}
                  {recommendation && (
                    <div className="bg-card rounded-lg p-3 border border-border">
                      <p className="text-xs text-muted-foreground">{recommendation}</p>
                    </div>
                  )}

                  {/* Payment to Target */}
                  {paymentToTarget > 0 && (
                    <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-foreground mb-1">
                            Pay ${paymentToTarget.toLocaleString()} to reach 30%
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Keeping utilization below 30% helps maintain a healthy credit score.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Milestones - Only for standalone debts */}
          {debt.source === 'debt' && milestones.length > 0 && (
            <div className="border-t border-border pt-3">
              <button
                onClick={() => setShowMilestones(!showMilestones)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {showMilestones ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                Milestones
              </button>
              {showMilestones && (
                <div className="mt-3 space-y-2">
                  {milestones.map((milestone) => (
                    <div key={milestone.id} className="flex items-center gap-3 text-sm">
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-muted-foreground">{milestone.percentage}%</span>
                          <span className="text-muted-foreground">
                            ${milestone.milestoneBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <Progress
                          value={milestone.achievedAt ? 100 : 0}
                          className="h-1.5 bg-elevated"
                        />
                      </div>
                      {milestone.achievedAt && (
                        <span className="text-income text-xs">✓</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Payment History Section - Unified across debt sources */}
          <div className="border-t border-border pt-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPaymentHistory(!showPaymentHistory);
                }}
                className="flex items-center justify-between w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="flex items-center gap-2">
                  {showPaymentHistory ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                  <History className="w-4 h-4" />
                  Payment History
                </span>
              </button>
              {showPaymentHistory && (
                <div className="mt-3">
                  <PaymentHistoryList debtId={debt.id} source={debt.source} />
                </div>
              )}
          </div>

          {/* Amortization Schedule Section - Only for debts with interest */}
          {debt.source === 'debt' && (debt.interestRate ?? 0) > 0 && (
            <div className="border-t border-border pt-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAmortization(!showAmortization);
                }}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {showAmortization ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                <BarChart3 className="w-4 h-4" />
                Amortization Schedule
              </button>
              {showAmortization && (
                <div className="mt-3">
                  <DebtAmortizationSection debt={debtForAmortization} />
                </div>
              )}
            </div>
          )}

          {/* Record Payment Button - Unified across debt sources */}
          {!isPaidOff && (
            <div className="border-t border-border pt-3">
              {!showPayment ? (
                <Button
                  onClick={() => setShowPayment(true)}
                  className="w-full bg-primary hover:opacity-90 text-primary-foreground"
                >
                  Record Payment
                </Button>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Amount"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="flex-1 bg-elevated border border-border rounded px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-income"
                    step="0.01"
                    min="0"
                  />
                  <Button
                    onClick={handlePayment}
                    className="bg-primary hover:opacity-90 text-primary-foreground"
                  >
                    Record
                  </Button>
                  <Button
                    onClick={() => setShowPayment(false)}
                    variant="outline"
                    className="border-border text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
