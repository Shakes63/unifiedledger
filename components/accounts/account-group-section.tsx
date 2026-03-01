'use client';

import { AccountCard } from './account-card';

interface Account {
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

interface AccountGroupSectionProps {
  title: string;
  subtitle?: string;
  accounts: Account[];
  totalLabel: string;
  totalValue: string;
  totalColor?: string;
  secondaryTotal?: { label: string; value: string; color?: string };
  onEdit: (account: Account) => void;
  onDelete: (accountId: string) => void;
  emptyMessage?: string;
}

export function AccountGroupSection({
  title,
  accounts,
  totalLabel,
  totalValue,
  totalColor = 'var(--color-foreground)',
  secondaryTotal,
  onEdit,
  onDelete,
  emptyMessage,
}: AccountGroupSectionProps) {
  if (accounts.length === 0 && !emptyMessage) return null;

  return (
    <div className="mb-8">
      {/* Section header - matching transactions date group style */}
      <div className="flex items-center gap-3 mb-3 px-1">
        <span
          className="text-[11px] font-semibold uppercase tracking-widest shrink-0"
          style={{ color: 'var(--color-muted-foreground)' }}
        >
          {title}
        </span>
        <div
          className="flex-1 h-px"
          style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 50%, transparent)' }}
        />
        <div className="flex items-center gap-3 shrink-0">
          {secondaryTotal && (
            <span className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>
              {secondaryTotal.label}{' '}
              <span className="font-mono tabular-nums font-medium" style={{ color: secondaryTotal.color }}>
                {secondaryTotal.value}
              </span>
            </span>
          )}
          <span className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>
            {totalLabel}{' '}
            <span className="font-mono tabular-nums font-semibold" style={{ color: totalColor }}>
              {totalValue}
            </span>
          </span>
        </div>
      </div>

      {/* Accounts grid */}
      {accounts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {accounts.map((account, idx) => (
            <div
              key={account.id}
              className="account-card-enter"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <AccountCard
                account={account}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </div>
          ))}
        </div>
      ) : (
        emptyMessage && (
          <div
            className="rounded-xl border py-8 text-center"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
          >
            <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>{emptyMessage}</p>
          </div>
        )
      )}
    </div>
  );
}
