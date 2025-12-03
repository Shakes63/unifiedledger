'use client';

import { useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, Edit2, Trash2, CreditCard, AlertTriangle, History, BarChart3, TrendingUp, Clock, Zap } from 'lucide-react';
import { CreditUtilizationBadge } from './credit-utilization-badge';
import { PaymentHistoryList } from './payment-history-list';
import { DebtAmortizationSection } from './debt-amortization-section';
import { useDebtExpansion } from '@/lib/hooks/use-debt-expansion';
import {
  calculateUtilization,
  calculatePaymentToTarget,
  getUtilizationRecommendation,
} from '@/lib/debts/credit-utilization-utils';
import { EntityIdBadge } from '@/components/dev/entity-id-badge';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';

interface Milestone {
  id: string;
  percentage: number;
  milestoneBalance: number;
  achievedAt?: string;
}

interface DebtData {
  id: string;
  name: string;
  creditorName: string;
  originalAmount: number;
  remainingBalance: number;
  minimumPayment?: number;
  additionalMonthlyPayment?: number;
  interestRate: number;
  type: string;
  color: string;
  status: string;
  targetPayoffDate?: string;
  creditLimit?: number | null;
  loanType?: 'revolving' | 'installment';
  compoundingFrequency?: 'daily' | 'monthly' | 'quarterly' | 'annually';
  billingCycleDays?: number;
}

interface DebtPayment {
  id: string;
  amount: number;
  date: string;
  type: string;
}

interface PayoffTimeline {
  strategyMonths: number;
  strategyDate: Date | string;
  minimumOnlyMonths: number;
  order: number;
  method: string;
}

interface DebtTrackerProps {
  debt: DebtData;
  milestones?: Milestone[];
  payments?: DebtPayment[];
  onEdit?: (debt: DebtData) => void;
  onDelete?: (debtId: string) => void;
  onPayment?: (debtId: string, amount: number) => void;
  defaultExpanded?: boolean;
  payoffTimeline?: PayoffTimeline;
}

export function DebtPayoffTracker({
  debt,
  milestones = [],
  payments: _payments = [],
  onEdit,
  onDelete,
  onPayment,
  defaultExpanded = false,
  payoffTimeline,
}: DebtTrackerProps) {
  const { selectedHouseholdId } = useHousehold();
  const { postWithHousehold } = useHouseholdFetch();
  const { isExpanded, toggle: toggleExpanded } = useDebtExpansion(debt.id, defaultExpanded);
  const [showMilestones, setShowMilestones] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showUtilization, setShowUtilization] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [showAmortization, setShowAmortization] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');

  const progressPercent = Math.min((debt.originalAmount - debt.remainingBalance) / debt.originalAmount * 100, 100);
  const paidOff = debt.originalAmount - debt.remainingBalance;
  const daysLeft = debt.targetPayoffDate
    ? Math.ceil(
        (new Date(debt.targetPayoffDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      )
    : null;

  // Credit utilization calculations (for credit cards only)
  const isCreditCard = debt.type === 'credit_card';
  const hasLimit = isCreditCard && debt.creditLimit && debt.creditLimit > 0;
  const utilization = hasLimit ? calculateUtilization(debt.remainingBalance, debt.creditLimit!) : 0;
  const available = hasLimit ? Math.max(0, debt.creditLimit! - debt.remainingBalance) : 0;
  const paymentToTarget = hasLimit ? calculatePaymentToTarget(debt.remainingBalance, debt.creditLimit!, 30) : 0;
  const recommendation = hasLimit ? getUtilizationRecommendation(utilization) : '';
  const isOverTarget = utilization > 30;

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
      const response = await postWithHousehold(`/api/debts/${debt.id}/payments`, {
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

  return (
    <Card className="bg-card border-border p-4 hover:border-border transition-colors">
      <div className="space-y-4">
        {/* Clickable Header */}
        <div>
          <div
            onClick={toggleExpanded}
            className="flex items-start justify-between cursor-pointer hover:bg-elevated/50 transition-colors rounded-lg -mx-2 -mt-2 px-2 pt-2 pb-2"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: debt.color }}
                />
                <h3 className="font-semibold text-foreground">{debt.name}</h3>
                <EntityIdBadge id={debt.id} label="Debt" />
                {debt.status === 'paid_off' && (
                  <span className="text-xs bg-[var(--color-income)]/30 text-[var(--color-income)] px-2 py-1 rounded">
                    Paid Off
                  </span>
                )}
                {debt.status === 'paused' && (
                  <span className="text-xs bg-[var(--color-warning)]/30 text-[var(--color-warning)] px-2 py-1 rounded">
                    Paused
                  </span>
                )}
                {/* Extra Payment Badge */}
                {(debt.additionalMonthlyPayment ?? 0) > 0 && debt.status !== 'paid_off' && (
                  <span className="text-xs bg-[var(--color-income)]/20 text-[var(--color-income)] px-2 py-1 rounded flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    Extra
                  </span>
                )}
                {/* Credit Utilization Badge */}
                {hasLimit && (
                  <CreditUtilizationBadge
                    balance={debt.remainingBalance}
                    creditLimit={debt.creditLimit!}
                    size="sm"
                    showPercentage={true}
                    showTooltip={true}
                  />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{debt.creditorName}</p>
            </div>
            <div className="flex gap-2 items-start">
              <ChevronDown
                className={`w-5 h-5 text-muted-foreground transition-transform duration-300 flex-shrink-0 ${
                  isExpanded ? 'rotate-180' : ''
                }`}
              />
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                {onEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onEdit(debt)}
                    className="text-muted-foreground hover:text-foreground hover:bg-elevated"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(debt.id)}
                    className="text-muted-foreground hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Collapsed Summary */}
          {!isExpanded && (
            <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground mt-2 px-2">
              <span className="font-mono">
                ${debt.remainingBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })} / ${debt.originalAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </span>
              <span className="font-semibold">{Math.round(progressPercent)}% paid</span>
              {daysLeft !== null && daysLeft >= 0 && (
                <span className="hidden sm:inline">{daysLeft} days left</span>
              )}
            </div>
          )}
        </div>

        {/* Expandable Content */}
        {isExpanded && (
          <div className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">
                  ${debt.remainingBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })} remaining of $
                  {debt.originalAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </span>
                <span className="text-foreground font-semibold">{Math.round(progressPercent)}%</span>
              </div>
              <Progress value={progressPercent} className="h-2 bg-elevated" />
            </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 text-center text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Paid Off</p>
            <p className="text-foreground font-semibold">
              ${paidOff.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </p>
          </div>
          {(debt.minimumPayment || debt.additionalMonthlyPayment) ? (
            <div>
              <p className="text-muted-foreground text-xs">
                {(debt.additionalMonthlyPayment ?? 0) > 0 
                  ? 'Planned Payment' 
                  : 'Min Payment'}
              </p>
              <p className="text-foreground font-semibold">
                ${((debt.minimumPayment || 0) + (debt.additionalMonthlyPayment || 0)).toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </p>
              {(debt.additionalMonthlyPayment ?? 0) > 0 && (
                <p className="text-xs text-[var(--color-income)] flex items-center justify-center gap-1 mt-0.5">
                  <TrendingUp className="w-3 h-3" />
                  +${(debt.additionalMonthlyPayment ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} extra
                </p>
              )}
            </div>
          ) : null}
          {daysLeft !== null ? (
            <div>
              <p className="text-muted-foreground text-xs">Days Left</p>
              <p className={`font-semibold ${daysLeft < 0 ? 'text-[var(--color-error)]' : 'text-foreground'}`}>
                {daysLeft < 0 ? `${Math.abs(daysLeft)} ago` : daysLeft}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-muted-foreground text-xs">Type</p>
              <p className="text-foreground font-semibold capitalize">{debt.type.replace(/_/g, ' ')}</p>
            </div>
          )}
        </div>

        {/* Payoff Timeline (Strategy vs Minimum) */}
        {payoffTimeline && debt.status !== 'paid_off' && (
          <div className="bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-[var(--color-primary)]" />
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
                  <Clock className="w-3 h-3 text-[var(--color-income)]" />
                  <span className="text-sm font-semibold text-[var(--color-income)]">
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
                  <p className="text-xs text-[var(--color-income)]">
                    {payoffTimeline.minimumOnlyMonths - payoffTimeline.strategyMonths} months faster!
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Interest Rate */}
        {debt.interestRate > 0 && (
          <div className="bg-elevated border border-border rounded p-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Interest Rate</span>
              <span className="text-sm text-foreground font-semibold">{debt.interestRate.toFixed(2)}%</span>
            </div>
          </div>
        )}

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
              <span>Credit Utilization</span>
              {isOverTarget && (
                <AlertTriangle className="w-3 h-3 text-[var(--color-warning)] ml-auto" />
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
                    <span className="text-[var(--color-warning)]">30% target</span>
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
                    <p className="text-[var(--color-success)] font-semibold font-mono">
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
                  <div className="bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-[var(--color-warning)] mt-0.5 flex-shrink-0" />
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

        {/* Milestones */}
        {milestones.length > 0 && (
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
                      <span className="text-[var(--color-income)] text-xs">✓</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

            {/* Payment History Section */}
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
                  <PaymentHistoryList debtId={debt.id} />
                </div>
              )}
            </div>

            {/* Amortization Schedule Section */}
            {debt.interestRate > 0 && (
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
                    <DebtAmortizationSection debt={debt} />
                  </div>
                )}
              </div>
            )}

            {/* Record Payment Button */}
            {debt.status !== 'paid_off' && (
              <div className="border-t border-border pt-3">
                {!showPayment ? (
                  <Button
                    onClick={() => setShowPayment(true)}
                    className="w-full bg-[var(--color-primary)] hover:opacity-90 text-[var(--color-primary-foreground)]"
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
                      className="flex-1 bg-elevated border border-border rounded px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-[var(--color-income)]"
                      step="0.01"
                      min="0"
                    />
                    <Button
                      onClick={handlePayment}
                      className="bg-[var(--color-primary)] hover:opacity-90 text-[var(--color-primary-foreground)]"
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
      </div>
    </Card>
  );
}
