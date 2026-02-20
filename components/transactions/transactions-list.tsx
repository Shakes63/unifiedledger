'use client';

import Link from 'next/link';
import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
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
import { Card } from '@/components/ui/card';
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

  if (loading) {
    return (
      <Card
        className="p-6 border text-center py-12 rounded-xl"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}
      >
        <p className="text-muted-foreground">Loading transactions...</p>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card
        className="p-6 border text-center py-12 rounded-xl"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}
      >
        <p className="text-muted-foreground mb-4">No transactions yet.</p>
        <Link href="/dashboard/transactions/new">
          <Button className="font-medium bg-primary text-primary-foreground hover:opacity-90">
            Add Transaction
          </Button>
        </Link>
      </Card>
    );
  }

  const visibleTransactions = getFilteredTransactions(transactions, {
    accountIdFromUrl,
    filterAccountIds: currentFilters?.accountIds || [],
    combinedTransferView,
  });

  return (
    <>
      <div className="space-y-2">
        {visibleTransactions.map((transaction) => {
          const display = getTransactionDisplay(transaction);
          const accountName = getAccountName(transaction.accountId);
          const isTransfer = transaction.type === 'transfer_out' || transaction.type === 'transfer_in';
          const hasMissingInfo = !isTransfer && (!transaction.categoryId || !transaction.merchantId);

          return (
            <Card
              key={transaction.id}
              className="p-2 border transition-colors rounded-lg"
              style={{
                borderColor: hasMissingInfo ? 'color-mix(in oklch, var(--color-warning) 50%, transparent)' : 'var(--color-border)',
                backgroundColor: 'var(--color-card)',
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="p-1.5 rounded shrink-0" style={{ backgroundColor: 'var(--color-elevated)' }}>
                    {getTransactionIcon(transaction.type)}
                  </div>
                  <div className="relative shrink-0 w-16">
                    <InlineDateEdit
                      value={transaction.date}
                      transactionId={transaction.id}
                      onUpdate={onUpdateTransaction}
                      disabled={updatingTxId === transaction.id}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isTransfer ? (
                        <div className="font-semibold text-foreground text-sm flex items-center gap-1 flex-wrap">
                          {transaction.type === 'transfer_out' ? (
                            <>
                              <span>{getAccountName(getTransferSourceAccountId(transaction, transactions) || transaction.accountId)}</span>
                              <span className="text-muted-foreground">→</span>
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
                              <span className="text-muted-foreground">→</span>
                              <span>{getAccountName(getTransferDestinationAccountId(transaction) || transaction.accountId)}</span>
                            </>
                          ) : (
                            <span>{display.merchant}</span>
                          )}
                        </div>
                      ) : (
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
                      )}
                      <EntityIdBadge id={transaction.id} label="TX" />
                    </div>
                    <InlineDescriptionEdit
                      value={transaction.description}
                      transactionId={transaction.id}
                      onUpdate={onUpdateTransaction}
                      disabled={updatingTxId === transaction.id}
                    />
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {!isTransfer && transaction.merchantId && (
                        <EntityIdBadge id={transaction.merchantId} label="Mer" />
                      )}
                      <EntityIdBadge id={transaction.accountId} label="Acc" />
                      {transaction.isSplit && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <Split className="w-3 h-3" /> Split
                        </span>
                      )}
                      {transaction.type === 'income' &&
                        !transaction.isSalesTaxable &&
                        isAccountSalesTaxEnabled(transaction.accountId) && (
                          <Badge
                            variant="outline"
                            className="text-xs border-warning/50 text-warning bg-warning/10 flex items-center gap-0.5 px-1.5 py-0"
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
                  {!isTransfer && (
                    <div className="shrink-0">
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
                      {transaction.categoryId && (
                        <EntityIdBadge id={transaction.categoryId} label="Cat" />
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <div className="text-right">
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
                        />
                      );
                    })()}
                    {isTransfer ? (
                      <p className="text-xs text-muted-foreground truncate max-w-[100px]">
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
                  <div className="flex flex-col gap-0.5">
                    <Link href={`/dashboard/transactions/${transaction.id}`}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
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
                      className="h-7 w-7 shrink-0"
                      style={{ color: 'var(--color-muted-foreground)' }}
                      title="Repeat this transaction with today's date"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onCreateRuleFromTransaction(transaction.id, transaction.description)}
                      className="h-7 w-7 shrink-0"
                      style={{ color: 'var(--color-primary)' }}
                      title="Create rule from this transaction"
                    >
                      <Zap className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {transactions.length > 0 && totalResults > pageSize && (
        <div className="mt-8 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {paginationOffset + 1}-{Math.min(paginationOffset + transactions.length, totalResults)} of {totalResults}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => void onPreviousPage()}
              disabled={paginationOffset === 0 || searchLoading}
              className="text-foreground disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-elevated)' }}
            >
              Previous
            </Button>
            <Button
              onClick={() => void onNextPage()}
              disabled={!hasMore || searchLoading}
              className="text-foreground disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-elevated)' }}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
