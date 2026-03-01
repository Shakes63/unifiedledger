'use client';

import { useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
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

export interface DebtData {
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
      const response = await postWithHousehold('/api/debts/payments', {
        source: 'debt',
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

  return (
    <div
      className="p-4 transition-colors"
      style={{
        backgroundColor: 'var(--color-background)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div className="space-y-4">
        {/* Clickable Header */}
        <div>
          <div
            onClick={toggleExpanded}
            className="flex items-start justify-between cursor-pointer transition-colors rounded-lg -mx-2 -mt-2 px-2 pt-2 pb-2"
            style={{ backgroundColor: 'transparent' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'color-mix(in oklch, var(--color-elevated) 50%, transparent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <div
                  className="w-4 h-4 rounded-full shrink-0"
                  style={{ backgroundColor: debt.color }}
                />
                <h3 className="font-semibold" style={{ color: 'var(--color-foreground)' }}>{debt.name}</h3>
                <EntityIdBadge id={debt.id} label="Debt" />
                {debt.status === 'paid_off' && (
                  <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'color-mix(in oklch, var(--color-income) 30%, transparent)', color: 'var(--color-income)' }}>
                    Paid Off
                  </span>
                )}
                {debt.status === 'paused' && (
                  <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'color-mix(in oklch, var(--color-warning) 30%, transparent)', color: 'var(--color-warning)' }}>
                    Paused
                  </span>
                )}
                {/* Extra Payment Badge */}
                {(debt.additionalMonthlyPayment ?? 0) > 0 && debt.status !== 'paid_off' && (
                  <span className="text-xs px-2 py-1 rounded flex items-center gap-1" style={{ backgroundColor: 'color-mix(in oklch, var(--color-income) 20%, transparent)', color: 'var(--color-income)' }}>
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
              <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>{debt.creditorName}</p>
            </div>
            <div className="flex gap-2 items-start">
              <ChevronDown
                className={`w-5 h-5 transition-transform duration-300 shrink-0 ${
                  isExpanded ? 'rotate-180' : ''
                }`}
                style={{ color: 'var(--color-muted-foreground)' }}
              />
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                {onEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onEdit(debt)}
                    style={{ color: 'var(--color-muted-foreground)' }}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(debt.id)}
                    style={{ color: 'var(--color-muted-foreground)' }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Collapsed Summary */}
          {!isExpanded && (
            <div className="flex items-center justify-between gap-4 text-sm mt-2 px-2" style={{ color: 'var(--color-muted-foreground)' }}>
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
                <span style={{ color: 'var(--color-muted-foreground)' }}>
                  ${debt.remainingBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })} remaining of $
                  {debt.originalAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </span>
                <span className="font-semibold" style={{ color: 'var(--color-foreground)' }}>{Math.round(progressPercent)}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" style={{ backgroundColor: 'var(--color-elevated)' }} />
            </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 text-center text-sm">
          <div>
            <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Paid Off</p>
            <p className="font-semibold" style={{ color: 'var(--color-foreground)' }}>
              ${paidOff.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </p>
          </div>
          {(debt.minimumPayment || debt.additionalMonthlyPayment) ? (
            <div>
              <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                {(debt.additionalMonthlyPayment ?? 0) > 0 
                  ? 'Planned Payment' 
                  : 'Min Payment'}
              </p>
              <p className="font-semibold" style={{ color: 'var(--color-foreground)' }}>
                ${((debt.minimumPayment || 0) + (debt.additionalMonthlyPayment || 0)).toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </p>
              {(debt.additionalMonthlyPayment ?? 0) > 0 && (
                <p className="text-xs flex items-center justify-center gap-1 mt-0.5" style={{ color: 'var(--color-income)' }}>
                  <TrendingUp className="w-3 h-3" />
                  +${(debt.additionalMonthlyPayment ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} extra
                </p>
              )}
            </div>
          ) : null}
          {daysLeft !== null ? (
            <div>
              <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Days Left</p>
              <p
                className="font-semibold"
                style={{ color: daysLeft < 0 ? 'var(--color-destructive)' : 'var(--color-foreground)' }}
              >
                {daysLeft < 0 ? `${Math.abs(daysLeft)} ago` : daysLeft}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Type</p>
              <p className="font-semibold capitalize" style={{ color: 'var(--color-foreground)' }}>{debt.type.replace(/_/g, ' ')}</p>
            </div>
          )}
        </div>

        {/* Payoff Timeline (Strategy vs Minimum) */}
        {payoffTimeline && debt.status !== 'paid_off' && (
          <div
            className="rounded-lg p-3"
            style={{
              backgroundColor: 'color-mix(in oklch, var(--color-primary) 10%, transparent)',
              border: '1px solid color-mix(in oklch, var(--color-primary) 30%, transparent)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--color-foreground)' }}>
                Payoff Timeline ({payoffTimeline.method})
              </span>
              <span className="text-xs ml-auto" style={{ color: 'var(--color-muted-foreground)' }}>
                #{payoffTimeline.order} priority
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>With Strategy</p>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" style={{ color: 'var(--color-income)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-income)' }}>
                    {payoffTimeline.strategyMonths} months
                  </span>
                </div>
                <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                  {new Date(payoffTimeline.strategyDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Min Payments Only</p>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" style={{ color: 'var(--color-muted-foreground)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-muted-foreground)' }}>
                    {payoffTimeline.minimumOnlyMonths === -1 ? 'Never' : `${payoffTimeline.minimumOnlyMonths} months`}
                  </span>
                </div>
                {payoffTimeline.minimumOnlyMonths > 0 && payoffTimeline.minimumOnlyMonths !== -1 && (
                  <p className="text-xs" style={{ color: 'var(--color-income)' }}>
                    {payoffTimeline.minimumOnlyMonths - payoffTimeline.strategyMonths} months faster!
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Interest Rate */}
        {debt.interestRate > 0 && (
          <div
            className="rounded p-2"
            style={{
              backgroundColor: 'var(--color-elevated)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div className="flex justify-between items-center">
              <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Interest Rate</span>
              <span className="text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>{debt.interestRate.toFixed(2)}%</span>
            </div>
          </div>
        )}

        {/* Credit Utilization Section (Credit Cards Only) */}
        {hasLimit && (
          <div className="pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
            <button
              onClick={() => setShowUtilization(!showUtilization)}
              className="flex items-center gap-2 text-sm transition-colors w-full"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              {showUtilization ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              <CreditCard className="w-4 h-4" />
              <span>Credit Utilization</span>
              {isOverTarget && (
                <AlertTriangle className="w-3 h-3 ml-auto" style={{ color: 'var(--color-warning)' }} />
              )}
            </button>

            {showUtilization && (
              <div
                className="mt-4 space-y-3 rounded-lg p-3"
                style={{
                  backgroundColor: 'var(--color-elevated)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {/* Utilization Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span style={{ color: 'var(--color-muted-foreground)' }}>Utilization</span>
                    <span className="font-semibold" style={{ color: 'var(--color-foreground)' }}>{utilization.toFixed(1)}%</span>
                  </div>
                  <Progress value={utilization} className="h-2" style={{ backgroundColor: 'var(--color-background)' }} />
                  <div className="flex justify-between items-center text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                    <span>0%</span>
                    <span style={{ color: 'var(--color-warning)' }}>30% target</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Credit Info Grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Credit Limit</p>
                    <p className="font-semibold font-mono" style={{ color: 'var(--color-foreground)' }}>
                      ${debt.creditLimit!.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Available Credit</p>
                    <p className="font-semibold font-mono" style={{ color: 'var(--color-success)' }}>
                      ${available.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* Recommendation */}
                {recommendation && (
                  <div
                    className="rounded-lg p-3"
                    style={{
                      backgroundColor: 'var(--color-background)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{recommendation}</p>
                  </div>
                )}

                {/* Payment to Target */}
                {paymentToTarget > 0 && (
                  <div
                    className="rounded-lg p-3"
                    style={{
                      backgroundColor: 'color-mix(in oklch, var(--color-warning) 10%, transparent)',
                      border: '1px solid color-mix(in oklch, var(--color-warning) 30%, transparent)',
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--color-warning)' }} />
                      <div className="flex-1">
                        <p className="text-xs font-semibold mb-1" style={{ color: 'var(--color-foreground)' }}>
                          Pay ${paymentToTarget.toLocaleString()} to reach 30%
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
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
          <div className="pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
            <button
              onClick={() => setShowMilestones(!showMilestones)}
              className="flex items-center gap-2 text-sm transition-colors"
              style={{ color: 'var(--color-muted-foreground)' }}
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
                        <span style={{ color: 'var(--color-muted-foreground)' }}>{milestone.percentage}%</span>
                        <span style={{ color: 'var(--color-muted-foreground)' }}>
                          ${milestone.milestoneBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <Progress
                        value={milestone.achievedAt ? 100 : 0}
                        className="h-1.5"
                        style={{ backgroundColor: 'var(--color-elevated)' }}
                      />
                    </div>
                    {milestone.achievedAt && (
                      <span className="text-xs" style={{ color: 'var(--color-income)' }}>✓</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

            {/* Payment History Section */}
            <div className="pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPaymentHistory(!showPaymentHistory);
                }}
                className="flex items-center justify-between w-full text-sm transition-colors"
                style={{ color: 'var(--color-muted-foreground)' }}
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
              <div className="pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAmortization(!showAmortization);
                  }}
                  className="flex items-center gap-2 text-sm transition-colors"
                  style={{ color: 'var(--color-muted-foreground)' }}
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
              <div className="pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                {!showPayment ? (
                  <Button
                    onClick={() => setShowPayment(true)}
                    className="w-full hover:opacity-90"
                    style={{
                      backgroundColor: 'var(--color-primary)',
                      color: 'var(--color-primary-foreground)',
                    }}
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
                      className="flex-1 rounded px-3 py-2 text-sm"
                      style={{
                        backgroundColor: 'var(--color-elevated)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-foreground)',
                      }}
                      step="0.01"
                      min="0"
                    />
                    <Button
                      onClick={handlePayment}
                      className="hover:opacity-90"
                      style={{
                        backgroundColor: 'var(--color-primary)',
                        color: 'var(--color-primary-foreground)',
                      }}
                    >
                      Record
                    </Button>
                    <Button
                      onClick={() => setShowPayment(false)}
                      variant="outline"
                      style={{
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-muted-foreground)',
                      }}
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
    </div>
  );
}
