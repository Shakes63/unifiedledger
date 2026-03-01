'use client';

import Link from 'next/link';
import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Copy,
  Pencil,
  ShieldOff,
  Split,
  Target,
  Zap,
} from 'lucide-react';

import { EntityIdBadge } from '@/components/dev/entity-id-badge';
import { InlineAccountSelect } from '@/components/transactions/inline-account-select';
import { InlineAmountEdit } from '@/components/transactions/inline-amount-edit';
import { InlineDateEdit } from '@/components/transactions/inline-date-edit';
import { InlineDescriptionEdit } from '@/components/transactions/inline-description-edit';
import { InlineTransactionDropdown } from '@/components/transactions/inline-transaction-dropdown';
import { InlineTransferAccountSelect } from '@/components/transactions/inline-transfer-account-select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  getFilteredTransactions,
  getTransferDestinationAccountId,
  getTransferDisplayProps,
  getTransferSourceAccountId,
} from '@/lib/transactions/transfer-display';
import type {
  AccountListItem,
  CategoryListItem,
  MerchantListItem,
  TransactionListItem,
  TransactionSearchFilters,
} from '@/lib/types/transactions-ui';

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  if (date.getFullYear() === today.getFullYear()) {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

type UpdateField = 'categoryId' | 'merchantId' | 'accountId' | 'date' | 'amount' | 'description';

interface TransactionsListProps {
  loading: boolean;
  transactions: TransactionListItem[];
  totalResults: number;
  pageSize: number;
  paginationOffset: number;
  hasMore: boolean;
  searchLoading: boolean;
  accountIdFromUrl: string | null;
  currentFilters: TransactionSearchFilters | null;
  combinedTransferView: boolean;
  accounts: AccountListItem[];
  categories: CategoryListItem[];
  merchants: MerchantListItem[];
  updatingTxId: string | null;
  repeatingTxId: string | null;
  onUpdateTransaction: (transactionId: string, field: UpdateField, value: string | number) => Promise<void>;
  onUpdateTransferAccount: (
    transactionId: string,
    transactionType: 'transfer_out' | 'transfer_in',
    accountId: string
  ) => Promise<void>;
  onInlineCreate: (
    transactionId: string,
    type: 'category' | 'merchant',
    name: string
  ) => Promise<void>;
  onRepeatTransaction: (transaction: TransactionListItem) => Promise<void>;
  onCreateRuleFromTransaction: (transactionId: string, description: string) => void;
  onPreviousPage: () => Promise<void>;
  onNextPage: () => Promise<void>;
}

export function TransactionsList({
  loading,
  transactions,
  totalResults,
  pageSize,
  paginationOffset,
  hasMore,
  searchLoading,
  accountIdFromUrl,
  currentFilters,
  combinedTransferView,
  accounts,
  categories,
  merchants,
  updatingTxId,
  repeatingTxId,
  onUpdateTransaction,
  onUpdateTransferAccount,
  onInlineCreate,
  onRepeatTransaction,
  onCreateRuleFromTransaction,
  onPreviousPage,
  onNextPage,
}: TransactionsListProps) {
  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'income':
        return <ArrowDownLeft className="w-4 h-4" style={{ color: 'var(--color-income)' }} />;
      case 'expense':
        return <ArrowUpRight className="w-4 h-4" style={{ color: 'var(--color-expense)' }} />;
      case 'transfer':
      case 'transfer_in':
      case 'transfer_out':
        return <ArrowRightLeft className="w-4 h-4" style={{ color: 'var(--color-transfer)' }} />;
      default:
        return null;
    }
  };

  const getMerchantName = (merchantId?: string): string | null => {
    if (!merchantId) return null;
    const merchant = merchants.find((merchantItem) => merchantItem.id === merchantId);
    return merchant?.name || null;
  };

  const getAccountName = (accountId?: string | null): string => {
    if (!accountId) return 'Unknown';
    const account = accounts.find((accountItem) => accountItem.id === accountId);
    return account?.name || 'Unknown';
  };

  const isAccountSalesTaxEnabled = (accountId?: string): boolean => {
    if (!accountId) return false;
    const account = accounts.find((accountItem) => accountItem.id === accountId);
    return account?.enableSalesTax ?? false;
  };

  const getFilteredCategories = (transactionType: string) => {
    if (transactionType === 'income') {
      return categories.filter((category) => category.type === 'income');
    }
    if (transactionType === 'expense') {
      return categories.filter((category) => category.type !== 'income');
    }
    return categories;
  };

  const getFilteredMerchants = (transactionType: string) => {
    if (transactionType === 'income') {
      return merchants.filter((merchant) => {
        if (!merchant.categoryId) return true;
        const category = categories.find((categoryItem) => categoryItem.id === merchant.categoryId);
        return category?.type === 'income';
      });
    }
    if (transactionType === 'expense') {
      return merchants.filter((merchant) => {
        if (!merchant.categoryId) return true;
        const category = categories.find((categoryItem) => categoryItem.id === merchant.categoryId);
        return category?.type !== 'income';
      });
    }
    return merchants;
  };

  const getTransactionDisplay = (transaction: TransactionListItem): { merchant: string | null; description: string } => {
    if (transaction.type === 'transfer_out' || transaction.type === 'transfer_in') {
      const sourceAccountId = getTransferSourceAccountId(transaction, transactions);
      const destinationAccountId = getTransferDestinationAccountId(transaction);

      if (sourceAccountId && destinationAccountId) {
        return {
          merchant: `${getAccountName(sourceAccountId)} → ${getAccountName(destinationAccountId)}`,
          description: transaction.description,
        };
      }
      return {
        merchant: `Transfer → ${getAccountName(destinationAccountId || transaction.accountId)}`,
        description: transaction.description,
      };
    }

    return {
      merchant: getMerchantName(transaction.merchantId),
      description: transaction.description,
    };
  };

  // --- Loading skeleton ---
  if (loading) {
    return (
      <div className="space-y-6">
        {[0, 1, 2].map((groupIdx) => (
          <div key={groupIdx}>
            <div className="flex items-center gap-3 mb-2 px-1">
              <div className="h-2.5 w-14 rounded-sm animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
              <div className="flex-1 h-px" style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 60%, transparent)' }} />
            </div>
            <div
              className="rounded-xl overflow-hidden border"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
            >
              {[0, 1, 2].map((rowIdx) => (
                <div
                  key={rowIdx}
                  className="flex items-center gap-2.5 px-3 py-2.5"
                  style={{
                    borderBottom: rowIdx < 2 ? '1px solid color-mix(in oklch, var(--color-border) 40%, transparent)' : 'none',
                  }}
                >
                  <div className="w-7 h-7 rounded-lg animate-pulse shrink-0" style={{ backgroundColor: 'var(--color-elevated)' }} />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-20 rounded animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
                      <div className="h-3 w-16 rounded animate-pulse" style={{ backgroundColor: 'color-mix(in oklch, var(--color-elevated) 60%, transparent)' }} />
                    </div>
                    <div className="h-2.5 w-36 rounded animate-pulse" style={{ backgroundColor: 'color-mix(in oklch, var(--color-elevated) 40%, transparent)' }} />
                  </div>
                  <div className="h-3.5 w-14 rounded animate-pulse shrink-0" style={{ backgroundColor: 'var(--color-elevated)' }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // --- Empty state ---
  if (transactions.length === 0) {
    return (
      <div
        className="rounded-xl border py-16 text-center"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
      >
        <div
          className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4"
          style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 15%, transparent)' }}
        >
          <ArrowRightLeft className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
        </div>
        <p className="font-medium mb-1" style={{ color: 'var(--color-foreground)' }}>No transactions yet</p>
        <p className="text-sm mb-6" style={{ color: 'var(--color-muted-foreground)' }}>Add your first transaction to get started.</p>
        <Link href="/dashboard/transactions/new">
          <Button className="hover:opacity-90 font-medium rounded-lg" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
            Add Transaction
          </Button>
        </Link>
      </div>
    );
  }

  // --- Filtered and grouped transactions ---
  const visibleTransactions = getFilteredTransactions(transactions, {
    accountIdFromUrl,
    filterAccountIds: currentFilters?.accountIds || [],
    combinedTransferView,
  });

  const dateGroups: Array<{ date: string; label: string; items: TransactionListItem[] }> = [];
  let currentGroupDate = '';

  for (const tx of visibleTransactions) {
    const txDate = tx.date.split('T')[0];
    if (txDate !== currentGroupDate) {
      currentGroupDate = txDate;
      dateGroups.push({ date: txDate, label: formatDateLabel(txDate), items: [tx] });
    } else if (dateGroups.length > 0) {
      dateGroups[dateGroups.length - 1].items.push(tx);
    }
  }

  let rowCounter = 0;

  return (
    <>
      <div className="space-y-5">
        {dateGroups.map((group) => (
          <div key={group.date}>
            {/* Date group header */}
            <div className="flex items-center gap-3 mb-1.5 px-1">
              <span
                className="text-[11px] font-semibold uppercase tracking-widest shrink-0"
                style={{ color: 'var(--color-muted-foreground)' }}
              >
                {group.label}
              </span>
              <div
                className="flex-1 h-px"
                style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 50%, transparent)' }}
              />
              <span
                className="text-[11px] font-mono tabular-nums shrink-0"
                style={{ color: 'var(--color-muted-foreground)' }}
              >
                {group.items.length}
              </span>
            </div>

            {/* Transaction rows */}
            <div
              className="rounded-xl overflow-hidden border"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
            >
              {group.items.map((transaction, txIdx) => {
                const accountName = getAccountName(transaction.accountId);
                const isTransfer = transaction.type === 'transfer_out' || transaction.type === 'transfer_in';
                const hasMissingInfo = !isTransfer && (!transaction.categoryId || !transaction.merchantId);
                const animDelay = rowCounter++;

                return (
                  <div
                    key={transaction.id}
                    className="tx-row-enter tx-row-hover group flex items-start gap-2 px-2.5 sm:px-3 py-2 sm:py-2.5"
                    style={{
                      animationDelay: `${animDelay * 20}ms`,
                      borderBottom:
                        txIdx < group.items.length - 1
                          ? '1px solid color-mix(in oklch, var(--color-border) 40%, transparent)'
                          : 'none',
                      ...(hasMissingInfo && {
                        boxShadow: 'inset 3px 0 0 var(--color-warning)',
                      }),
                    }}
                  >
                    {/* Type icon */}
                    <div
                      className="mt-0.5 p-1.5 rounded-lg shrink-0"
                      style={{ backgroundColor: 'color-mix(in oklch, var(--color-elevated) 70%, transparent)' }}
                    >
                      {getTransactionIcon(transaction.type)}
                    </div>

                    {/* Content area: left info + right amount, balanced by justify-between */}
                    <div className="flex-1 min-w-0 flex items-start justify-between gap-3">
                      {/* Left: merchant/transfer, category, description, metadata */}
                      <div className="min-w-0">
                        {/* Primary line: Merchant + Category (inline) */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isTransfer ? (
                            <div className="font-semibold text-sm flex items-center gap-1 flex-wrap" style={{ color: 'var(--color-foreground)' }}>
                              {transaction.type === 'transfer_out' ? (
                                <>
                                  <span>{getAccountName(getTransferSourceAccountId(transaction, transactions) || transaction.accountId)}</span>
                                  <span style={{ color: 'var(--color-muted-foreground)' }}>&rarr;</span>
                                  {getAccountName(getTransferDestinationAccountId(transaction) || undefined) === 'Unknown' ? (
                                    <InlineTransferAccountSelect
                                      value={getTransferDestinationAccountId(transaction)}
                                      transactionId={transaction.id}
                                      transactionType="transfer_out"
                                      excludeAccountId={transaction.accountId}
                                      accounts={accounts}
                                      onUpdate={onUpdateTransferAccount}
                                      disabled={updatingTxId === transaction.id}
                                    />
                                  ) : (
                                    <span>{getAccountName(getTransferDestinationAccountId(transaction) || undefined)}</span>
                                  )}
                                </>
                              ) : transaction.type === 'transfer_in' ? (
                                <>
                                  {(() => {
                                    const sourceAccountId = getTransferSourceAccountId(transaction, transactions);
                                    const sourceName = getAccountName(sourceAccountId || undefined);
                                    return sourceName === 'Unknown' ? (
                                      <InlineTransferAccountSelect
                                        value={sourceAccountId}
                                        transactionId={transaction.id}
                                        transactionType="transfer_in"
                                        excludeAccountId={transaction.accountId}
                                        accounts={accounts}
                                        onUpdate={onUpdateTransferAccount}
                                        disabled={updatingTxId === transaction.id}
                                      />
                                    ) : (
                                      <span>{sourceName}</span>
                                    );
                                  })()}
                                  <span style={{ color: 'var(--color-muted-foreground)' }}>&rarr;</span>
                                  <span>{getAccountName(getTransferDestinationAccountId(transaction) || transaction.accountId)}</span>
                                </>
                              ) : null}
                            </div>
                          ) : (
                            <>
                              <InlineTransactionDropdown
                                type="merchant"
                                value={transaction.merchantId || null}
                                transactionId={transaction.id}
                                transactionType={transaction.type as 'income' | 'expense' | 'transfer_out' | 'transfer_in'}
                                options={getFilteredMerchants(transaction.type)}
                                onUpdate={onUpdateTransaction}
                                onCreate={onInlineCreate}
                                disabled={updatingTxId === transaction.id}
                              />
                              <span
                                className="text-[10px] select-none"
                                style={{ color: 'var(--color-muted-foreground)' }}
                              >
                                &middot;
                              </span>
                              <InlineTransactionDropdown
                                type="category"
                                value={transaction.categoryId || null}
                                transactionId={transaction.id}
                                transactionType={transaction.type as 'income' | 'expense' | 'transfer_out' | 'transfer_in'}
                                options={getFilteredCategories(transaction.type)}
                                onUpdate={onUpdateTransaction}
                                onCreate={onInlineCreate}
                                disabled={updatingTxId === transaction.id}
                              />
                            </>
                          )}
                          <EntityIdBadge id={transaction.id} label="TX" />
                        </div>

                        {/* Description */}
                        <InlineDescriptionEdit
                          value={transaction.description}
                          transactionId={transaction.id}
                          onUpdate={onUpdateTransaction}
                          disabled={updatingTxId === transaction.id}
                        />

                        {/* Metadata line: date + badges */}
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <div className="shrink-0">
                            <InlineDateEdit
                              value={transaction.date}
                              transactionId={transaction.id}
                              onUpdate={onUpdateTransaction}
                              disabled={updatingTxId === transaction.id}
                            />
                          </div>
                          {!isTransfer && transaction.merchantId && (
                            <EntityIdBadge id={transaction.merchantId} label="Mer" />
                          )}
                          {!isTransfer && transaction.categoryId && (
                            <EntityIdBadge id={transaction.categoryId} label="Cat" />
                          )}
                          <EntityIdBadge id={transaction.accountId} label="Acc" />
                          {transaction.isSplit && (
                            <span className="text-xs flex items-center gap-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                              <Split className="w-3 h-3" /> Split
                            </span>
                          )}
                          {transaction.type === 'income' &&
                            !transaction.isSalesTaxable &&
                            isAccountSalesTaxEnabled(transaction.accountId) && (
                              <Badge
                                variant="outline"
                                className="text-xs flex items-center gap-0.5 px-1.5 py-0"
                                style={{ borderColor: 'color-mix(in oklch, var(--color-warning) 50%, transparent)', color: 'var(--color-warning)', backgroundColor: 'color-mix(in oklch, var(--color-warning) 10%, transparent)' }}
                                title="This income is excluded from sales tax calculations"
                              >
                                <ShieldOff className="w-3 h-3" />
                                Tax Exempt
                              </Badge>
                          )}
                          {transaction.savingsGoalId && transaction.savingsGoalName && (
                            <Badge
                              variant="outline"
                              className="text-xs flex items-center gap-1 px-1.5 py-0"
                              style={{
                                borderColor: `color-mix(in oklch, ${transaction.savingsGoalColor || 'var(--color-primary)'} 50%, transparent)`,
                                color: transaction.savingsGoalColor || 'var(--color-primary)',
                                backgroundColor: `color-mix(in oklch, ${transaction.savingsGoalColor || 'var(--color-primary)'} 15%, transparent)`,
                              }}
                              title={`Contributing to: ${transaction.savingsGoalName}`}
                            >
                              <Target className="w-3 h-3" />
                              {transaction.savingsGoalName}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Right: Amount + Account */}
                      <div className="text-right shrink-0">
                        {(() => {
                          const isTransferTx = transaction.type === 'transfer_out' || transaction.type === 'transfer_in';
                          const displayProps = isTransferTx
                            ? getTransferDisplayProps(transaction, {
                                accountIdFromUrl,
                                filterAccountIds: currentFilters?.accountIds || [],
                                combinedTransferView,
                                allTransactions: transactions,
                              })
                            : {
                                color: transaction.type === 'income'
                                  ? 'var(--color-income)'
                                  : 'var(--color-expense)',
                                sign: transaction.type === 'income' ? '+' : '-',
                                effectiveType: transaction.type as 'income' | 'expense',
                              };

                          return (
                            <InlineAmountEdit
                              value={transaction.amount}
                              transactionId={transaction.id}
                              type={transaction.type as 'income' | 'expense' | 'transfer_out' | 'transfer_in'}
                              sign={displayProps.sign}
                              color={displayProps.color}
                              onUpdate={onUpdateTransaction}
                              disabled={updatingTxId === transaction.id}
                              className="font-mono tabular-nums"
                            />
                          );
                        })()}
                        {isTransfer ? (
                          <p className="text-xs truncate max-w-[100px]" style={{ color: 'var(--color-muted-foreground)' }}>
                            {accountName}
                          </p>
                        ) : (
                          <InlineAccountSelect
                            value={transaction.accountId}
                            transactionId={transaction.id}
                            accounts={accounts}
                            onUpdate={onUpdateTransaction}
                            disabled={updatingTxId === transaction.id}
                          />
                        )}
                      </div>
                    </div>

                    {/* Actions: hover-revealed on desktop, always visible on mobile */}
                    <div className="flex flex-col gap-0.5 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-150">
                      <Link href={`/dashboard/transactions/${transaction.id}`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          style={{ color: 'var(--color-muted-foreground)' }}
                          title="Edit transaction"
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void onRepeatTransaction(transaction)}
                        disabled={repeatingTxId === transaction.id}
                        className="h-6 w-6 shrink-0"
                        style={{ color: 'var(--color-muted-foreground)' }}
                        title="Repeat this transaction with today's date"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onCreateRuleFromTransaction(transaction.id, transaction.description)}
                        className="h-6 w-6 shrink-0"
                        style={{ color: 'var(--color-primary)' }}
                        title="Create rule from this transaction"
                      >
                        <Zap className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {transactions.length > 0 && totalResults > pageSize && (
        <div className="mt-6 flex items-center justify-between">
          <span className="text-xs font-mono tabular-nums" style={{ color: 'var(--color-muted-foreground)' }}>
            {paginationOffset + 1}&ndash;{Math.min(paginationOffset + transactions.length, totalResults)} of {totalResults.toLocaleString()}
          </span>
          <div className="flex gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void onPreviousPage()}
              disabled={paginationOffset === 0 || searchLoading}
              className="h-8 px-3 rounded-lg disabled:opacity-30"
              style={{ color: 'var(--color-foreground)' }}
              style={{
                backgroundColor: paginationOffset === 0 ? 'transparent' : 'var(--color-elevated)',
              }}
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" />
              Prev
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void onNextPage()}
              disabled={!hasMore || searchLoading}
              className="h-8 px-3 rounded-lg disabled:opacity-30"
              style={{ color: 'var(--color-foreground)' }}
              style={{
                backgroundColor: !hasMore ? 'transparent' : 'var(--color-elevated)',
              }}
            >
              Next
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
