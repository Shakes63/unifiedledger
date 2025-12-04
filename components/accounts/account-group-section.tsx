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
  subtitle,
  accounts,
  totalLabel,
  totalValue,
  totalColor = 'var(--color-foreground)',
  secondaryTotal,
  onEdit,
  onDelete,
  emptyMessage,
}: AccountGroupSectionProps) {
  // Don't render section if no accounts and no empty message
  if (accounts.length === 0 && !emptyMessage) return null;

  return (
    <div className="mb-12">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{title}</h2>
          {subtitle && <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>}
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">{totalLabel}</p>
          <p className="text-xl font-bold font-mono" style={{ color: totalColor }}>
            {totalValue}
          </p>
          {secondaryTotal && (
            <div className="mt-1">
              <p className="text-xs text-muted-foreground">{secondaryTotal.label}</p>
              <p className="text-sm font-medium font-mono" style={{ color: secondaryTotal.color }}>
                {secondaryTotal.value}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Accounts Grid */}
      {accounts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : (
        emptyMessage && (
          <div className="p-8 border border-border bg-card rounded-xl text-center">
            <p className="text-muted-foreground">{emptyMessage}</p>
          </div>
        )
      )}
    </div>
  );
}

