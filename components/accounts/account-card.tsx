'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  MoreVertical,
  Edit2,
  Trash2,
  Copy,
  ArrowRight,
  Wallet,
  Building2,
  CreditCard,
  PiggyBank,
  TrendingUp,
  Banknote,
  Coins,
  Briefcase
} from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { EntityIdBadge } from '@/components/dev/entity-id-badge';
import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns';

interface AccountData {
  id: string;
  name: string;
  type: string;
  bankName?: string;
  accountNumberLast4?: string;
  currentBalance: number;
  creditLimit?: number;
  color: string;
  icon: string;
  interestRate?: number;
  interestType?: 'fixed' | 'variable';
  includeInPayoffStrategy?: boolean;
  statementBalance?: number;
  statementDueDate?: string;
  minimumPaymentAmount?: number;
  drawPeriodEndDate?: string;
  repaymentPeriodEndDate?: string;
}

interface AccountCardProps {
  account: AccountData;
  onEdit?: (account: AccountData) => void;
  onDelete?: (accountId: string) => void;
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit: 'Credit Card',
  line_of_credit: 'Line of Credit',
  investment: 'Investment',
  cash: 'Cash',
};

export function AccountCard({ account, onEdit, onDelete }: AccountCardProps) {
  const handleCopyAccountNumber = () => {
    if (account.accountNumberLast4) {
      navigator.clipboard.writeText(account.accountNumberLast4);
      toast.success('Account number copied');
    }
  };

  const isCreditAccount = account.type === 'credit' || account.type === 'line_of_credit';
  const isLineOfCredit = account.type === 'line_of_credit';
  const balance = account.currentBalance;
  const hasCredit = isCreditAccount && balance < 0;
  const displayBalance = Math.abs(balance);

  const availableBalance = isCreditAccount
    ? (account.creditLimit || 0) - displayBalance
    : balance;
  const utilization = isCreditAccount && account.creditLimit && account.creditLimit > 0
    ? (displayBalance / account.creditLimit) * 100
    : null;

  const drawPeriodStatus = useMemo(() => {
    if (!isLineOfCredit || !account.drawPeriodEndDate) return null;
    const endDate = parseISO(account.drawPeriodEndDate);
    const today = startOfDay(new Date());
    const daysRemaining = differenceInCalendarDays(endDate, today);

    if (daysRemaining < 0) {
      return { status: 'ended', label: 'Draw ended', color: 'var(--color-warning)' };
    } else if (daysRemaining <= 90) {
      return { status: 'ending', label: `Draw ends in ${daysRemaining}d`, color: 'var(--color-warning)' };
    } else {
      return { status: 'active', label: 'Draw active', color: 'var(--color-success)' };
    }
  }, [isLineOfCredit, account.drawPeriodEndDate]);

  const IconComponent = useMemo(() => {
    const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
      wallet: Wallet,
      bank: Building2,
      'credit-card': CreditCard,
      'piggy-bank': PiggyBank,
      'trending-up': TrendingUp,
      'dollar-sign': Banknote,
      coins: Coins,
      briefcase: Briefcase,
    };
    return iconMap[account.icon] || Wallet;
  }, [account.icon]);

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const utilizationColor = hasCredit
    ? 'var(--color-income)'
    : utilization !== null && utilization >= 100
    ? 'var(--color-error)'
    : utilization !== null && utilization >= 80
    ? 'var(--color-warning)'
    : utilization !== null && utilization >= 30
    ? 'var(--color-primary)'
    : 'var(--color-income)';

  return (
    <div
      className="rounded-xl border overflow-hidden transition-all duration-200 group"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-background)',
        borderLeftWidth: '3px',
        borderLeftColor: account.color,
      }}
    >
      {/* Header: icon + name + menu */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: account.color + '18', color: account.color }}
            >
              <IconComponent className="w-[18px] h-[18px]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-semibold text-sm truncate" style={{ color: 'var(--color-foreground)' }}>{account.name}</h3>
                <EntityIdBadge id={account.id} label="Acc" />
              </div>
              <p className="text-xs truncate" style={{ color: 'var(--color-muted-foreground)' }}>
                {ACCOUNT_TYPE_LABELS[account.type]}
                {account.bankName && <span> &middot; {account.bankName}</span>}
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 hover:bg-[var(--color-elevated)] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: 'var(--color-muted-foreground)' }}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="border" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}>
              {onEdit && (
                <DropdownMenuItem
                  onClick={() => onEdit(account)}
                  className="cursor-pointer hover:bg-[var(--color-elevated)]"
            style={{ color: 'var(--color-foreground)' }}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              )}
              {account.accountNumberLast4 && (
                <DropdownMenuItem
                  onClick={handleCopyAccountNumber}
                  className="cursor-pointer hover:bg-[var(--color-elevated)]"
            style={{ color: 'var(--color-foreground)' }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Last 4
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={() => onDelete(account.id)}
                  className="cursor-pointer hover:bg-[color-mix(in_oklch,var(--color-destructive)_10%,transparent)]"
            style={{ color: 'var(--color-destructive)' }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Balance section */}
      <div className="px-4 pb-3">
        {isCreditAccount ? (
          <div className="space-y-2.5">
            {/* Balance + APR */}
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-xl font-bold font-mono tabular-nums" style={{ color: hasCredit ? 'var(--color-income)' : 'var(--color-destructive)' }}>
                  ${fmt(displayBalance)}
                </p>
                {hasCredit && (
                  <p className="text-[10px]" style={{ color: 'var(--color-income)' }}>Overpayment credit</p>
                )}
              </div>
              {account.interestRate !== undefined && account.interestRate !== null && (
                <span className="text-xs font-mono tabular-nums" style={{ color: 'var(--color-muted-foreground)' }}>
                  {account.interestRate.toFixed(2)}%
                  {account.interestType === 'variable' && (
                    <span className="ml-0.5" style={{ color: 'var(--color-warning)' }}>var</span>
                  )}
                </span>
              )}
            </div>

            {/* Utilization bar */}
            {account.creditLimit && account.creditLimit > 0 && (
              <>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'var(--color-elevated)' }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: hasCredit ? '0%' : `${Math.min(utilization!, 100)}%`,
                      backgroundColor: utilizationColor,
                    }}
                  />
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span style={{ color: 'var(--color-muted-foreground)' }}>
                    {hasCredit ? 'Full limit' : `${utilization!.toFixed(0)}% of $${account.creditLimit.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                  </span>
                  <span className="font-mono tabular-nums font-medium" style={{ color: availableBalance < 0 ? 'var(--color-destructive)' : 'var(--color-income)' }}>
                    ${fmt(hasCredit ? (account.creditLimit + displayBalance) : availableBalance)} avail
                  </span>
                </div>
              </>
            )}

            {/* Draw period + Payoff strategy (compact inline) */}
            {(drawPeriodStatus || account.includeInPayoffStrategy !== undefined) && (
              <div className="flex items-center gap-3 flex-wrap text-[11px]">
                {drawPeriodStatus && (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: drawPeriodStatus.color }} />
                    <span style={{ color: drawPeriodStatus.color }}>{drawPeriodStatus.label}</span>
                  </span>
                )}
                {account.includeInPayoffStrategy !== undefined && (
                  <span className={account.includeInPayoffStrategy ? 'opacity-100' : 'opacity-50'} style={{ color: account.includeInPayoffStrategy ? 'var(--color-success)' : 'var(--color-muted-foreground)' }}>
                    {account.includeInPayoffStrategy ? 'In payoff strategy' : 'Not in strategy'}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Cash account balance */
          <p
            className="text-xl font-bold font-mono tabular-nums"
            style={{ color: account.color }}
          >
            ${fmt(balance)}
          </p>
        )}
      </div>

      {/* Footer: account number + transactions link */}
      <div
        className="px-4 py-2 flex items-center justify-between"
        style={{ borderTop: '1px solid color-mix(in oklch, var(--color-border) 40%, transparent)' }}
      >
        {account.accountNumberLast4 ? (
          <span className="text-[11px] font-mono tabular-nums" style={{ color: 'var(--color-muted-foreground)' }}>
            &bull;&bull;&bull;&bull; {account.accountNumberLast4}
          </span>
        ) : (
          <span />
        )}
        <Link href={`/dashboard/transactions?accountId=${account.id}`}>
          <span
            className="text-[11px] font-medium flex items-center gap-1 hover:opacity-80 transition-opacity"
            style={{ color: 'var(--color-primary)' }}
          >
            Transactions <ArrowRight className="w-3 h-3" />
          </span>
        </Link>
      </div>
    </div>
  );
}
