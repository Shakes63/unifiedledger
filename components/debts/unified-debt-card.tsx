'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  MoreVertical,
  Edit2,
  CreditCard,
  Wallet,
  Home,
  Car,
  GraduationCap,
  HeartPulse,
  Target,
  TrendingDown,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EntityIdBadge } from '@/components/dev/entity-id-badge';
import { useState } from 'react';

interface UnifiedDebt {
  id: string;
  name: string;
  source: 'account' | 'bill';
  sourceType: string;
  balance: number;
  originalBalance?: number;
  creditLimit?: number;
  interestRate?: number;
  interestType?: string;
  minimumPayment?: number;
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
}

interface UnifiedDebtCardProps {
  debt: UnifiedDebt;
  onEdit?: (debt: UnifiedDebt) => void;
  onToggleStrategy?: (debtId: string, include: boolean) => void;
  defaultExpanded?: boolean;
}

// Map debt types to icons
const DEBT_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  credit: CreditCard,
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
  onToggleStrategy,
  defaultExpanded = false,
}: UnifiedDebtCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const IconComponent = useMemo(() => {
    return DEBT_TYPE_ICONS[debt.sourceType] || DEBT_TYPE_ICONS.other;
  }, [debt.sourceType]);

  const typeLabel = DEBT_TYPE_LABELS[debt.sourceType] || 'Debt';

  // Progress calculation for loans
  const payoffProgress = useMemo(() => {
    if (debt.source === 'bill' && debt.originalBalance && debt.originalBalance > 0) {
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

  return (
    <Card 
      className={`border bg-card rounded-xl transition-all ${
        debt.includeInPayoffStrategy ? 'border-border' : 'border-border opacity-60'
      }`}
    >
      {/* Header */}
      <div className="p-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ 
              backgroundColor: `${cardColor}20`,
              borderColor: cardColor,
              borderWidth: '2px',
            }}
          >
            <IconComponent className="w-5 h-5" style={{ color: cardColor }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-foreground font-semibold">{debt.name}</h3>
              <EntityIdBadge id={debt.id} label={debt.source === 'account' ? 'Account' : 'Bill'} />
            </div>
            <p className="text-muted-foreground text-sm">{typeLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Strategy Badge */}
          <button
            onClick={() => onToggleStrategy?.(debt.id, !debt.includeInPayoffStrategy)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
              debt.includeInPayoffStrategy
                ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <Target className="w-3 h-3" />
            {debt.includeInPayoffStrategy ? 'In Strategy' : 'Excluded'}
          </button>

          {/* Expand/Collapse */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>

          {/* Actions Menu */}
          {onEdit && (
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
                <DropdownMenuItem
                  onClick={() => onEdit(debt)}
                  className="cursor-pointer"
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Balance Section - Always Visible */}
      <div className="px-4 pb-4">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-muted-foreground text-xs">Balance</p>
            <p className="text-2xl font-bold font-mono text-[var(--color-error)]">
              ${debt.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          {debt.minimumPayment && debt.minimumPayment > 0 && (
            <div className="text-right">
              <p className="text-muted-foreground text-xs">Min Payment</p>
              <p className="text-lg font-semibold font-mono text-foreground">
                ${debt.minimumPayment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          )}
        </div>

        {/* Utilization Bar for Credit Accounts */}
        {debt.source === 'account' && debt.creditLimit && debt.creditLimit > 0 && (
          <div className="mt-3">
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-muted-foreground">
                {debt.utilization?.toFixed(0)}% used
              </span>
              <span className="text-muted-foreground">
                ${debt.availableCredit?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} available
              </span>
            </div>
            <div className="w-full bg-elevated rounded-full h-2 overflow-hidden border border-border">
              <div
                className={`h-full transition-all ${
                  (debt.utilization || 0) >= 100
                    ? 'bg-[var(--color-error)]'
                    : (debt.utilization || 0) >= 80
                    ? 'bg-[var(--color-warning)]'
                    : (debt.utilization || 0) >= 30
                    ? 'bg-[var(--color-primary)]'
                    : 'bg-[var(--color-income)]'
                }`}
                style={{ width: `${Math.min(debt.utilization || 0, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Progress Bar for Loan Debts */}
        {payoffProgress !== null && (
          <div className="mt-3">
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-muted-foreground">
                {payoffProgress.toFixed(0)}% paid off
              </span>
              <span className="text-muted-foreground">
                of ${debt.originalBalance?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="w-full bg-elevated rounded-full h-2 overflow-hidden border border-border">
              <div
                className="h-full bg-[var(--color-success)] transition-all"
                style={{ width: `${payoffProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-border space-y-3">
          {/* Interest Rate */}
          {debt.interestRate !== undefined && debt.interestRate !== null && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">APR</span>
              <span className="text-foreground">
                {debt.interestRate.toFixed(2)}%
                {debt.interestType === 'variable' && (
                  <span className="ml-1 text-[var(--color-warning)]">(Variable)</span>
                )}
              </span>
            </div>
          )}

          {/* Credit Limit */}
          {debt.creditLimit && debt.creditLimit > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Credit Limit</span>
              <span className="text-foreground font-mono">
                ${debt.creditLimit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

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

          {/* Original Balance for Loans */}
          {debt.source === 'bill' && debt.originalBalance && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Original Balance</span>
              <span className="text-foreground font-mono">
                ${debt.originalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {/* Tax Deductible Interest */}
          {debt.isInterestTaxDeductible && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Tax Deductible Interest</span>
              <span className="text-[var(--color-success)]">
                {debt.taxDeductionType === 'mortgage' && 'Mortgage Interest'}
                {debt.taxDeductionType === 'student_loan' && 'Student Loan Interest'}
                {debt.taxDeductionType === 'business' && 'Business Interest'}
                {debt.taxDeductionType === 'heloc_home' && 'HELOC (Home Use)'}
                {!debt.taxDeductionType || debt.taxDeductionType === 'none' ? 'Yes' : ''}
              </span>
            </div>
          )}

          {/* Debt Type for Bills */}
          {debt.source === 'bill' && debt.debtType && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Type</span>
              <span className="text-foreground">{DEBT_TYPE_LABELS[debt.debtType] || debt.debtType}</span>
            </div>
          )}

          {/* Source Indicator */}
          <div className="flex justify-between items-center text-sm pt-2 border-t border-border">
            <span className="text-muted-foreground">Source</span>
            <span className="text-xs px-2 py-1 rounded bg-elevated text-muted-foreground">
              {debt.source === 'account' ? 'Credit Account' : 'Debt Bill'}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}

