'use client';

import React from 'react';
import { Progress } from '@/components/ui/progress';
import { CreditCard, Star, TrendingUp, Clock, ExternalLink, AlertCircle, CheckCircle2, TrendingDown } from 'lucide-react';
import { EntityIdBadge } from '@/components/dev/entity-id-badge';
import Link from 'next/link';
import Decimal from 'decimal.js';

interface DebtBudgetItem {
  debtId: string;
  debtName: string;
  creditorName: string;
  minimumPayment: number;
  additionalMonthlyPayment: number;
  recommendedPayment: number;
  isFocusDebt: boolean;
  actualPaid: number;
  remainingBalance: number;
  interestRate: number;
  payoffMonth: number;
  payoffDate: string;
  color: string;
  type: string;
}

interface DebtBudgetCardProps {
  debt: DebtBudgetItem;
}

// Payment status type for clear categorization
type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'overpaid';

export function DebtBudgetCard({ debt }: DebtBudgetCardProps) {
  const percentage = debt.recommendedPayment > 0
    ? new Decimal(debt.actualPaid).div(debt.recommendedPayment).times(100).toNumber()
    : 0;

  // Determine payment status
  const getPaymentStatus = (): PaymentStatus => {
    if (debt.actualPaid === 0 && debt.recommendedPayment > 0) return 'unpaid';
    if (debt.actualPaid > debt.recommendedPayment) return 'overpaid';
    if (debt.actualPaid >= debt.recommendedPayment) return 'paid';
    return 'partial';
  };

  const paymentStatus = getPaymentStatus();
  const isUnpaid = paymentStatus === 'unpaid';
  const isPartial = paymentStatus === 'partial';
  const isPaid = paymentStatus === 'paid';
  const isOverpaid = paymentStatus === 'overpaid';
  
  const remaining = new Decimal(debt.recommendedPayment).minus(debt.actualPaid).toNumber();
  const overpaidAmount = isOverpaid 
    ? new Decimal(debt.actualPaid).minus(debt.recommendedPayment).toNumber() 
    : 0;

  // Determine status for coloring
  const getProgressColor = () => {
    if (isUnpaid) return 'bg-[var(--color-error)]';
    if (isOverpaid) return 'bg-[var(--color-primary)]';
    if (isPaid) return 'bg-[var(--color-success)]';
    if (percentage >= 80) return 'bg-[var(--color-warning)]';
    if (percentage >= 50) return 'bg-[var(--color-warning)]';
    return 'bg-[var(--color-error)]';
  };

  // Format payoff date
  const formatPayoffDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  return (
    <div
      className={`bg-card border rounded-xl p-4 transition-colors ${
        debt.isFocusDebt
          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
          : 'border-border'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className="w-4 h-4 rounded-full flex-shrink-0"
            style={{ backgroundColor: debt.color }}
          />
          <h4 className="font-medium text-foreground">{debt.debtName}</h4>
          <EntityIdBadge id={debt.debtId} label="Debt" />
          {debt.isFocusDebt && (
            <span className="inline-flex items-center gap-1 text-xs bg-[var(--color-primary)] text-[var(--color-primary-foreground)] px-2 py-0.5 rounded-full">
              <Star className="w-3 h-3" />
              Focus
            </span>
          )}
          {/* Payment Status Badges */}
          {isUnpaid && (
            <span className="inline-flex items-center gap-1 text-xs bg-[var(--color-error)]/20 text-[var(--color-error)] px-2 py-0.5 rounded-full">
              <AlertCircle className="w-3 h-3" />
              Unpaid
            </span>
          )}
          {isOverpaid && (
            <span className="inline-flex items-center gap-1 text-xs bg-[var(--color-primary)]/20 text-[var(--color-primary)] px-2 py-0.5 rounded-full">
              <TrendingUp className="w-3 h-3" />
              +${overpaidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          )}
          {isPaid && !isOverpaid && (
            <span className="inline-flex items-center gap-1 text-xs bg-[var(--color-success)]/20 text-[var(--color-success)] px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" />
              Paid
            </span>
          )}
        </div>
        <Link
          href="/dashboard/debts"
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
          title="Go to Debts"
        >
          <ExternalLink className="w-4 h-4" />
        </Link>
      </div>

      {/* Creditor */}
      <p className="text-xs text-muted-foreground mb-3">{debt.creditorName}</p>

      {/* Payment Progress */}
      <div className="space-y-2 mb-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">
            ${debt.actualPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })} of $
            {debt.recommendedPayment.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
          <span className={`font-semibold ${isComplete ? 'text-[var(--color-success)]' : 'text-foreground'}`}>
            {Math.min(Math.round(percentage), 100)}%
          </span>
        </div>
        <Progress value={Math.min(percentage, 100)} className={`h-2 bg-elevated ${getProgressColor()}`} />
      </div>

      {/* Payment Details */}
      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
        <div>
          <span className="text-muted-foreground text-xs">Minimum</span>
          <p className="font-mono text-foreground">
            ${debt.minimumPayment.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        {debt.isFocusDebt ? (
          <div>
            <span className="text-muted-foreground text-xs flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-[var(--color-primary)]" />
              Recommended
            </span>
            <p className="font-mono font-semibold text-[var(--color-primary)]">
              ${debt.recommendedPayment.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        ) : debt.additionalMonthlyPayment > 0 ? (
          <div>
            <span className="text-muted-foreground text-xs">+ Extra</span>
            <p className="font-mono text-[var(--color-income)]">
              +${debt.additionalMonthlyPayment.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        ) : (
          <div>
            <span className="text-muted-foreground text-xs">This Month</span>
            <p className="font-mono text-foreground">
              ${debt.recommendedPayment.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        )}
      </div>

      {/* Balance and Payoff Info */}
      <div className="flex items-center justify-between pt-3 border-t border-border text-xs">
        <div className="flex items-center gap-2">
          <CreditCard className="w-3 h-3 text-muted-foreground" />
          <span className="text-muted-foreground">
            ${debt.remainingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
          {debt.interestRate > 0 && (
            <span className="text-muted-foreground">@ {debt.interestRate.toFixed(1)}%</span>
          )}
        </div>
        {debt.payoffMonth > 0 && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>Payoff: {formatPayoffDate(debt.payoffDate)}</span>
          </div>
        )}
      </div>

      {/* Status Indicators */}
      {isUnpaid && (
        <div className="mt-3 p-2 bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded-lg">
          <p className="text-xs text-[var(--color-error)] flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            No payment recorded this month - ${debt.recommendedPayment.toLocaleString('en-US', { minimumFractionDigits: 2 })} due
          </p>
        </div>
      )}
      {isPartial && remaining > 0 && (
        <div className="mt-3 p-2 bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 rounded-lg">
          <p className="text-xs text-[var(--color-warning)] flex items-center gap-1">
            <TrendingDown className="w-3 h-3" />
            ${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })} remaining to pay this month
          </p>
        </div>
      )}
      {isOverpaid && (
        <div className="mt-3 p-2 bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 rounded-lg">
          <p className="text-xs text-[var(--color-primary)] flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Overpaid by ${overpaidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} this month
          </p>
        </div>
      )}
    </div>
  );
}

