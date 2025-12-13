'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
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
  // Credit-specific fields
  interestRate?: number;
  interestType?: 'fixed' | 'variable';
  includeInPayoffStrategy?: boolean;
  statementBalance?: number;
  statementDueDate?: string;
  minimumPaymentAmount?: number;
  // Line of credit fields
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
  // Negative balance on credit = overpayment/credit balance
  const hasCredit = isCreditAccount && balance < 0;
  const displayBalance = Math.abs(balance);
  
  // Calculate available credit
  const availableBalance = isCreditAccount
    ? (account.creditLimit || 0) - displayBalance
    : balance;
  const utilization = isCreditAccount && account.creditLimit && account.creditLimit > 0
    ? (displayBalance / account.creditLimit) * 100
    : null;

  // Line of credit draw period status
  const drawPeriodStatus = useMemo(() => {
    if (!isLineOfCredit || !account.drawPeriodEndDate) return null;
    
    const endDate = parseISO(account.drawPeriodEndDate);
    const today = startOfDay(new Date());
    const daysRemaining = differenceInCalendarDays(endDate, today);
    
    if (daysRemaining < 0) {
      return { status: 'ended', label: 'Draw period ended', color: 'var(--color-warning)' };
    } else if (daysRemaining <= 90) {
      return { status: 'ending', label: `Draw period ends in ${daysRemaining} days`, color: 'var(--color-warning)' };
    } else {
      return { status: 'active', label: 'Draw period active', color: 'var(--color-success)' };
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

  return (
    <Card className="p-6 border border-border bg-card rounded-xl hover:border-border transition-all relative group">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: account.color + '20', borderColor: account.color, borderWidth: '2px', color: account.color }}
          >
            <IconComponent className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-foreground font-semibold text-lg">{account.name}</h3>
              <EntityIdBadge id={account.id} label="Account" />
            </div>
            <p className="text-muted-foreground text-sm">{ACCOUNT_TYPE_LABELS[account.type]}</p>
            {account.bankName && (
              <p className="text-muted-foreground text-xs">{account.bankName}</p>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-elevated text-muted-foreground"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-elevated border-border">
            {onEdit && (
              <DropdownMenuItem
                onClick={() => onEdit(account)}
                className="text-foreground cursor-pointer hover:bg-elevated"
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
            )}
            {account.accountNumberLast4 && (
              <DropdownMenuItem
                onClick={handleCopyAccountNumber}
                className="text-foreground cursor-pointer hover:bg-elevated"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Last 4
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem
                onClick={() => onDelete(account.id)}
                className="text-[var(--color-error)] cursor-pointer hover:bg-[var(--color-error)]/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Balances */}
      <div className="space-y-4">
        {isCreditAccount ? (
          <>
            {/* Balance Display - handles overpayment */}
            <div>
              <p className="text-muted-foreground text-xs mb-1">
                {hasCredit ? 'Credit Balance' : 'Balance Owed'}
              </p>
              <p className={`text-2xl font-bold font-mono ${hasCredit ? 'text-[var(--color-income)]' : 'text-[var(--color-error)]'}`}>
                ${displayBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              {hasCredit && (
                <p className="text-xs text-[var(--color-income)] mt-1">Overpayment credit</p>
              )}
            </div>

            {/* APR Display */}
            {account.interestRate !== undefined && account.interestRate !== null && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">APR</span>
                <span className="text-muted-foreground">
                  {account.interestRate.toFixed(2)}%
                  {account.interestType === 'variable' && (
                    <span className="ml-1 text-[var(--color-warning)]">(Variable)</span>
                  )}
                </span>
              </div>
            )}

            {/* Credit Limit & Utilization */}
            {account.creditLimit && account.creditLimit > 0 && (
              <>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Credit Limit</span>
                  <span className="text-muted-foreground font-mono">${account.creditLimit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="w-full bg-elevated rounded-full h-2 overflow-hidden border border-border">
                  <div
                    className={`h-full transition-all ${
                      hasCredit
                        ? 'bg-[var(--color-income)]'
                        : utilization! >= 100
                        ? 'bg-[var(--color-error)]'
                        : utilization! >= 80
                        ? 'bg-[var(--color-warning)]'
                        : utilization! >= 30
                        ? 'bg-[var(--color-primary)]'
                        : 'bg-[var(--color-income)]'
                    }`}
                    style={{ width: hasCredit ? '0%' : `${Math.min(utilization!, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">
                    {hasCredit ? 'Full limit + credit' : 'Available'}
                  </span>
                  <span className={`font-semibold font-mono ${availableBalance < 0 ? 'text-[var(--color-error)]' : 'text-[var(--color-income)]'}`}>
                    ${(hasCredit ? (account.creditLimit + displayBalance) : availableBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </>
            )}

            {/* Line of Credit Draw Period */}
            {drawPeriodStatus && (
              <div className="pt-2 border-t border-border">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: drawPeriodStatus.color }} />
                  <span className="text-xs" style={{ color: drawPeriodStatus.color }}>
                    {drawPeriodStatus.label}
                  </span>
                </div>
              </div>
            )}

            {/* Strategy Inclusion */}
            {account.includeInPayoffStrategy !== undefined && (
              <div className="flex justify-between items-center text-xs pt-1">
                <span className="text-muted-foreground">Payoff Strategy</span>
                <span className={account.includeInPayoffStrategy ? 'text-[var(--color-success)]' : 'text-muted-foreground opacity-50'}>
                  {account.includeInPayoffStrategy ? 'Included' : 'Excluded'}
                </span>
              </div>
            )}
          </>
        ) : (
          <div>
            <p className="text-muted-foreground text-xs mb-1">Balance</p>
            <p
              className="text-3xl font-bold font-mono"
              style={{ color: account.color }}
            >
              ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        )}
      </div>

      {/* Account Number */}
      {account.accountNumberLast4 && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-muted-foreground text-xs">Account ending in</p>
          <p className="text-muted-foreground text-sm font-mono">•••• {account.accountNumberLast4}</p>
        </div>
      )}

      {/* View Transactions Link */}
      <Link href={`/dashboard/transactions?accountId=${account.id}`}>
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-4 text-muted-foreground hover:text-foreground hover:bg-elevated border-border"
        >
          View Transactions
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </Link>
    </Card>
  );
}
