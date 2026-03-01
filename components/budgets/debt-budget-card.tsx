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
    if (isUnpaid) return 'var(--color-destructive)';
    if (isOverpaid) return 'var(--color-primary)';
    if (isPaid) return 'var(--color-success)';
    if (percentage >= 80) return 'var(--color-warning)';
    if (percentage >= 50) return 'var(--color-warning)';
    return 'var(--color-destructive)';
  };

  // Format payoff date
  const formatPayoffDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  return (
    <div
      className="rounded-xl p-4 transition-colors"
      style={{
        backgroundColor: debt.isFocusDebt ? 'color-mix(in oklch, var(--color-primary) 5%, transparent)' : 'var(--color-background)',
        border: debt.isFocusDebt ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className="w-4 h-4 rounded-full shrink-0"
            style={{ backgroundColor: debt.color }}
          />
          <h4 className="font-medium" style={{ color: 'var(--color-foreground)' }}>{debt.debtName}</h4>
          <EntityIdBadge id={debt.debtId} label="Debt" />
          {debt.isFocusDebt && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
              <Star className="w-3 h-3" />
              Focus
            </span>
          )}
          {/* Payment Status Badges */}
          {isUnpaid && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'color-mix(in oklch, var(--color-destructive) 20%, transparent)', color: 'var(--color-destructive)' }}>
              <AlertCircle className="w-3 h-3" />
              Unpaid
            </span>
          )}
          {isOverpaid && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 20%, transparent)', color: 'var(--color-primary)' }}>
              <TrendingUp className="w-3 h-3" />
              +${overpaidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          )}
          {isPaid && !isOverpaid && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 20%, transparent)', color: 'var(--color-success)' }}>
              <CheckCircle2 className="w-3 h-3" />
              Paid
            </span>
          )}
        </div>
        <Link
          href="/dashboard/debts"
          className="transition-colors p-1"
          style={{ color: 'var(--color-muted-foreground)' }}
          title="Go to Debts"
        >
          <ExternalLink className="w-4 h-4" />
        </Link>
      </div>

      {/* Creditor */}
      <p className="text-xs mb-3" style={{ color: 'var(--color-muted-foreground)' }}>{debt.creditorName}</p>

      {/* Payment Progress */}
      <div className="space-y-2 mb-3">
        <div className="flex justify-between items-center text-sm">
          <span style={{ color: 'var(--color-muted-foreground)' }}>
            ${debt.actualPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })} of $
            {debt.recommendedPayment.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
          <span className="font-semibold" style={{ color: isPaid || isOverpaid ? 'var(--color-success)' : 'var(--color-foreground)' }}>
            {Math.min(Math.round(percentage), 100)}%
          </span>
        </div>
        <Progress
          value={Math.min(percentage, 100)}
          className="h-2"
          style={{ backgroundColor: getProgressColor() }}
        />
      </div>

      {/* Payment Details */}
      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
        <div>
          <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Minimum</span>
          <p className="font-mono" style={{ color: 'var(--color-foreground)' }}>
            ${debt.minimumPayment.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        {debt.isFocusDebt ? (
          <div>
            <span className="text-xs flex items-center gap-1" style={{ color: 'var(--color-muted-foreground)' }}>
              <TrendingUp className="w-3 h-3" style={{ color: 'var(--color-primary)' }} />
              Recommended
            </span>
            <p className="font-mono font-semibold" style={{ color: 'var(--color-primary)' }}>
              ${debt.recommendedPayment.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        ) : debt.additionalMonthlyPayment > 0 ? (
          <div>
            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>+ Extra</span>
            <p className="font-mono" style={{ color: 'var(--color-income)' }}>
              +${debt.additionalMonthlyPayment.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        ) : (
          <div>
            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>This Month</span>
            <p className="font-mono" style={{ color: 'var(--color-foreground)' }}>
              ${debt.recommendedPayment.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        )}
      </div>

      {/* Balance and Payoff Info */}
      <div className="flex items-center justify-between pt-3 text-xs" style={{ borderTop: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-2">
          <CreditCard className="w-3 h-3" style={{ color: 'var(--color-muted-foreground)' }} />
          <span style={{ color: 'var(--color-muted-foreground)' }}>
            ${debt.remainingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
          {debt.interestRate > 0 && (
            <span style={{ color: 'var(--color-muted-foreground)' }}>@ {debt.interestRate.toFixed(1)}%</span>
          )}
        </div>
        {debt.payoffMonth > 0 && (
          <div className="flex items-center gap-1" style={{ color: 'var(--color-muted-foreground)' }}>
            <Clock className="w-3 h-3" />
            <span>Payoff: {formatPayoffDate(debt.payoffDate)}</span>
          </div>
        )}
      </div>

      {/* Status Indicators */}
      {isUnpaid && (
        <div className="mt-3 p-2 rounded-lg" style={{ backgroundColor: 'color-mix(in oklch, var(--color-destructive) 10%, transparent)', border: '1px solid color-mix(in oklch, var(--color-destructive) 30%, transparent)' }}>
          <p className="text-xs flex items-center gap-1" style={{ color: 'var(--color-destructive)' }}>
            <AlertCircle className="w-3 h-3" />
            No payment recorded this month - ${debt.recommendedPayment.toLocaleString('en-US', { minimumFractionDigits: 2 })} due
          </p>
        </div>
      )}
      {isPartial && remaining > 0 && (
        <div className="mt-3 p-2 rounded-lg" style={{ backgroundColor: 'color-mix(in oklch, var(--color-warning) 10%, transparent)', border: '1px solid color-mix(in oklch, var(--color-warning) 30%, transparent)' }}>
          <p className="text-xs flex items-center gap-1" style={{ color: 'var(--color-warning)' }}>
            <TrendingDown className="w-3 h-3" />
            ${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })} remaining to pay this month
          </p>
        </div>
      )}
      {isOverpaid && (
        <div className="mt-3 p-2 rounded-lg" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 10%, transparent)', border: '1px solid color-mix(in oklch, var(--color-primary) 30%, transparent)' }}>
          <p className="text-xs flex items-center gap-1" style={{ color: 'var(--color-primary)' }}>
            <TrendingUp className="w-3 h-3" />
            Overpaid by ${overpaidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} this month
          </p>
        </div>
      )}
    </div>
  );
}

